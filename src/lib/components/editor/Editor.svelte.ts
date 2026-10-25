import { invalidateAll } from '$app/navigation';
import { tick } from 'svelte';
import {
	createConceptRecord,
	ensureConceptByTitle,
	updateConceptRecord,
	updateConceptTitleFromInstanceRecord
} from '$lib/client/concepts';
import {
	deleteConceptInstanceRecord,
	importChildrenFromConceptInstance,
	updateConceptInstanceRecord,
	updateConceptInstancesBatch
} from '$lib/client/conceptInstances';
import { CanvasController } from '$lib/components/editor/canvas/CanvasController.svelte';
import { conceptSizePresets, type ConceptSizePreset } from '$lib/components/editor/canvas/layout';
import type {
	ContextMenu,
	CreateConceptOptions,
	EditorData,
	MainView,
	SidebarTab,
	TitleConflictState
} from '$lib/components/editor/EditorTypes';
import type { Concept } from '$lib/model/Concept';
import type { ConceptCardView } from '$lib/model/ConceptCardView';
import type { ConceptInstance } from '$lib/model/ConceptInstance';
import { normalizeConcept } from '$lib/model/normalizeConcept';
import { normalizeConceptInstance } from '$lib/model/normalizeConceptInstance';
import { getRelationshipsForConcept } from '$lib/model/relationshipQueries';
import type { TitleConflictMode } from '$lib/model/TitleConflictMode';
import { SvelteSet } from 'svelte/reactivity';

export class Editor {
	canvas: CanvasController;

	// Keep a detached baseline so failed optimistic edits can be reverted even while offline.
	private lastLoadedData: EditorData = {
		concepts: [],
		instances: [],
		relationships: [],
		relationshipDefinitions: []
	};

	concepts = $state<EditorData['concepts']>([]);
	instances = $state<EditorData['instances']>([]);
	relationships = $state<EditorData['relationships']>([]);
	relationshipDefinitions = $state<EditorData['relationshipDefinitions']>([]);

	activeInstanceId = $state<string | null>(null);
	pendingFocusInstanceId = $state<string | null>(null);
	currentCanvasOwnerInstanceId = $state<string | null>(null);
	selectedInstanceIds = $state<Set<string>>(new Set());

	sidebarVisible = $state(true);
	sidebarTab = $state<SidebarTab>('concept');
	mainView = $state<MainView>('canvas');

	saveError = $state<string | null>(null);
	titleConflict = $state<TitleConflictState | null>(null);
	contextMenu = $state<ContextMenu>({
		visible: false,
		x: 0,
		y: 0,
		targetType: null,
		instanceId: null
	});
	importChildrenMenu = $state<{
		visible: boolean;
		x: number;
		y: number;
		targetInstanceId: string | null;
	}>({
		visible: false,
		x: 0,
		y: 0,
		targetInstanceId: null
	});

	conceptsById = $derived.by(() => {
		return new Map(this.concepts.map((concept) => [concept.id, concept]));
	});

	cards = $derived.by((): ConceptCardView[] => {
		return this.instances.flatMap((instance) => {
			const concept = this.conceptsById.get(instance.conceptId);

			return concept ? [{ concept, instance }] : [];
		});
	});

	cardsByInstanceId = $derived.by(() => {
		return new Map(this.cards.map((card) => [card.instance.id, card]));
	});

	cardsInCurrentCanvas = $derived(
		this.cards.filter(
			(card) => card.instance.parentInstanceId === this.currentCanvasOwnerInstanceId
		)
	);

	currentBreadcrumb = $derived.by(() => {
		if (this.currentCanvasOwnerInstanceId === null) {
			return [];
		}

		return this.getInstanceBreadcrumb(this.currentCanvasOwnerInstanceId);
	});

	currentCanvasOwnerCard = $derived.by(() => {
		if (this.currentCanvasOwnerInstanceId === null) {
			return null;
		}

		return this.getCard(this.currentCanvasOwnerInstanceId) ?? null;
	});

	currentConceptRelationships = $derived.by(() => {
		if (!this.currentCanvasOwnerCard) {
			return [];
		}

		return getRelationshipsForConcept(this.relationships, this.currentCanvasOwnerCard.concept.id);
	});

	importChildrenOptions = $derived.by(() => {
		if (!this.importChildrenMenu.visible || !this.importChildrenMenu.targetInstanceId) {
			return [];
		}

		return this.getImportChildrenOptions(this.importChildrenMenu.targetInstanceId);
	});

	constructor(data: EditorData) {
		this.canvas = new CanvasController(this);
		this.replaceData(data);
	}

	selectOnlyInstance(instanceId: string) {
		this.selectedInstanceIds = new Set([instanceId]);
		this.activeInstanceId = instanceId;
	}

	toggleInstanceSelection(instanceId: string) {
		const nextSelectedInstanceIds = new SvelteSet(this.selectedInstanceIds);

		if (nextSelectedInstanceIds.has(instanceId)) {
			nextSelectedInstanceIds.delete(instanceId);
		} else {
			nextSelectedInstanceIds.add(instanceId);
		}

		this.selectedInstanceIds = nextSelectedInstanceIds;
		this.activeInstanceId = instanceId;
	}

	clearSelection() {
		this.selectedInstanceIds = new Set();
		this.canvas.clearMarqueePreviewSelection();
		this.activeInstanceId = null;
	}

	async prepareCanvasNavigation(nextOwnerInstanceId: string | null) {
		this.canvas.clearInteractiveState();
		this.clearSelection();
		this.closeContextMenu();

		this.currentCanvasOwnerInstanceId = nextOwnerInstanceId;
		this.activeInstanceId = null;

		await tick();
	}

	// Root uses frame-all as its camera position until it has its own saved camera.
	async openRootCanvas() {
		await this.canvas.saveCurrentCanvasCamera();
		await this.prepareCanvasNavigation(null);

		if (this.cardsInCurrentCanvas.length > 0) {
			this.canvas.frameCardsInCurrentCanvas();
		} else {
			this.canvas.applyCamera({ panX: 0, panY: 0, zoom: 1 });
		}
	}

	async openInstanceCanvas(instanceId: string) {
		const targetCard = this.getCard(instanceId);

		if (!targetCard || instanceId === this.currentCanvasOwnerInstanceId) {
			return;
		}

		await this.canvas.saveCurrentCanvasCamera();
		await this.prepareCanvasNavigation(instanceId);

		const savedCamera = this.canvas.getSavedCameraForInstance(targetCard.instance);

		if (savedCamera) {
			this.canvas.applyCamera(savedCamera);
		} else if (this.cardsInCurrentCanvas.length > 0) {
			this.canvas.frameCardsInCurrentCanvas();
		} else {
			this.canvas.applyCamera({ panX: 0, panY: 0, zoom: 1 });
		}
	}

	async openParentCanvas() {
		if (this.currentCanvasOwnerInstanceId === null) {
			return;
		}

		const currentCard = this.getCard(this.currentCanvasOwnerInstanceId);
		const parentInstanceId = currentCard?.instance.parentInstanceId ?? null;

		if (parentInstanceId === null) {
			await this.openRootCanvas();
			return;
		}

		await this.openInstanceCanvas(parentInstanceId);
	}

	replaceData(data: EditorData) {
		this.lastLoadedData = structuredClone($state.snapshot(data));
		this.concepts = data.concepts.map(normalizeConcept);
		this.instances = data.instances.map(normalizeConceptInstance);
		this.relationships = data.relationships;
		this.relationshipDefinitions = data.relationshipDefinitions;
	}

	rememberSavedInstance(instance: ConceptInstance) {
		const index = this.lastLoadedData.instances.findIndex((item) => item.id === instance.id);

		if (index !== -1) {
			this.lastLoadedData.instances[index] = { ...instance };
		}
	}

	getChildCards(conceptInstanceId: string): ConceptCardView[] {
		return this.cards.filter((card) => card.instance.parentInstanceId === conceptInstanceId);
	}

	getRootCards(): ConceptCardView[] {
		return this.cards.filter((card) => card.instance.parentInstanceId === null);
	}

	getConceptById(conceptId: string) {
		return this.conceptsById.get(conceptId) ?? null;
	}

	getTagConcepts(tagConceptIds: string[]) {
		return tagConceptIds
			.map((conceptId) => this.getConceptById(conceptId))
			.filter((concept): concept is Concept => Boolean(concept));
	}

	getCard(instanceId: string) {
		return this.cardsByInstanceId.get(instanceId);
	}

	getInstanceBreadcrumb(instanceId: string) {
		const breadcrumb: ConceptCardView[] = [];
		const visited = new SvelteSet<string>();

		let current = this.getCard(instanceId);

		while (current && !visited.has(current.instance.id)) {
			visited.add(current.instance.id);
			breadcrumb.unshift(current);

			current = current.instance.parentInstanceId
				? this.getCard(current.instance.parentInstanceId)
				: undefined;
		}

		return breadcrumb;
	}

	getImportChildrenOptions(targetInstanceId: string) {
		const targetCard = this.getCard(targetInstanceId);

		if (!targetCard) {
			return [];
		}

		return this.cards
			.filter((card) => {
				if (card.instance.id === targetInstanceId) {
					return false;
				}

				if (card.instance.conceptId !== targetCard.instance.conceptId) {
					return false;
				}

				const hasChildren = this.cards.some(
					(child) => child.instance.parentInstanceId === card.instance.id
				);

				return hasChildren;
			})
			.map((card) => ({
				instanceId: card.instance.id,
				breadcrumb: this.getBreadcrumbLabel(card.instance.id)
			}));
	}

	getBreadcrumbLabel(instanceId: string) {
		const breadcrumb = this.getInstanceBreadcrumb(instanceId);

		if (breadcrumb.length === 0) {
			return instanceId;
		}

		return breadcrumb.map((card) => card.concept.title || card.concept.id).join(' > ');
	}

	isDescendantInstance(possibleDescendantInstanceId: string, ancestorInstanceId: string): boolean {
		let current = this.getCard(possibleDescendantInstanceId);

		while (current?.instance.parentInstanceId) {
			if (current.instance.parentInstanceId === ancestorInstanceId) {
				return true;
			}

			current = this.getCard(current.instance.parentInstanceId);
		}

		return false;
	}

	async createConcept(options: CreateConceptOptions = {}) {
		const sizePreset = options.sizePreset ?? 'medium';
		const presetSize = conceptSizePresets[sizePreset];

		const result = await createConceptRecord({
			...(options.position ?? {}),
			...(options.title !== undefined ? { title: options.title } : {}),
			width: options.width ?? presetSize.width,
			height: options.height ?? presetSize.height,
			parentInstanceId: options.parentInstanceId ?? this.currentCanvasOwnerInstanceId
		});

		if (options.focusAfterCreate ?? true) {
			this.pendingFocusInstanceId = result.instance.id;
			this.activeInstanceId = result.instance.id;
		}

		await invalidateAll();

		return result;
	}

	private recoverFromSaveFailure(message: string, error: unknown) {
		console.error(message, error);
		this.replaceData(this.lastLoadedData);
		this.saveError = `${message} The last loaded data has been restored. Reload when the server is available to check which changes were saved.`;
		return false;
	}

	async updateConcept(id: string, updates: Partial<Omit<Concept, 'id' | 'title'>>) {
		try {
			await updateConceptRecord(id, updates);
			await invalidateAll();
			return true;
		} catch (error) {
			return this.recoverFromSaveFailure(
				'Could not confirm that Concept changes were saved.',
				error
			);
		}
	}

	async updateInstance(id: string, updates: Partial<Omit<ConceptInstance, 'id' | 'conceptId'>>) {
		try {
			await updateConceptInstanceRecord(id, updates);
			await invalidateAll();
			return true;
		} catch (error) {
			return this.recoverFromSaveFailure('Could not confirm that card changes were saved.', error);
		}
	}

	async updateInstancesBatch(
		updates: {
			id: string;
			updates: Partial<Omit<ConceptInstance, 'id' | 'conceptId'>>;
		}[]
	) {
		if (updates.length === 0) {
			return true;
		}

		try {
			await updateConceptInstancesBatch(updates);
			await invalidateAll();
			return true;
		} catch (error) {
			return this.recoverFromSaveFailure(
				'Could not confirm that card positions were saved.',
				error
			);
		}
	}

	async deleteInstance(id: string) {
		try {
			await deleteConceptInstanceRecord(id);
		} catch {
			console.error('Failed to delete concept instance');
			return;
		}

		await invalidateAll();
	}

	async commitTitleEdit(card: ConceptCardView, nextTitle: string) {
		const trimmedTitle = nextTitle.trim();

		if (trimmedTitle === card.concept.title) {
			return;
		}

		await this.updateConceptTitleFromInstance(card, trimmedTitle);
	}

	async updateConceptTitleFromInstance(
		card: ConceptCardView,
		title: string,
		conflictMode: TitleConflictMode = 'report-conflict'
	) {
		const result = await updateConceptTitleFromInstanceRecord(
			card.concept.id,
			card.instance.id,
			title,
			conflictMode
		);

		if (result.status === 'title-conflict') {
			this.titleConflict = {
				card,
				title,
				matchingConcepts: result.matchingConcepts
			};

			return;
		}

		this.titleConflict = null;

		await invalidateAll();
	}

	async setProperties(card: ConceptCardView, properties: Record<string, string>) {
		card.concept.properties = properties;

		return this.updateConcept(card.concept.id, {
			properties
		});
	}

	async setConceptTagConceptIds(card: ConceptCardView, tagConceptIds: string[]) {
		const uniqueTagConceptIds = [...new Set(tagConceptIds)].filter(
			(conceptId) => conceptId !== card.concept.id
		);

		card.concept.tagConceptIds = uniqueTagConceptIds;

		await this.updateConcept(card.concept.id, {
			tagConceptIds: uniqueTagConceptIds
		});
	}

	async tagConceptWithConcept(targetCard: ConceptCardView, tagConcept: Concept) {
		await this.setConceptTagConceptIds(targetCard, [
			...(targetCard.concept.tagConceptIds ?? []),
			tagConcept.id
		]);
	}

	async addTag(card: ConceptCardView, title: string) {
		let result: Awaited<ReturnType<typeof ensureConceptByTitle>>;

		try {
			result = await ensureConceptByTitle(title);
		} catch (error) {
			await this.recoverFromSaveFailure('Could not confirm that the tag was saved.', error);
			return;
		}

		if (!this.concepts.some((concept) => concept.id === result.concept.id)) {
			this.concepts = [...this.concepts, normalizeConcept(result.concept)];
		}

		await this.tagConceptWithConcept(card, result.concept);
	}

	async removeTag(card: ConceptCardView, tagConcept: Concept) {
		await this.setConceptTagConceptIds(
			card,
			(card.concept.tagConceptIds ?? []).filter((conceptId) => conceptId !== tagConcept.id)
		);
	}

	openTagCanvas(tagConcept: Concept) {
		console.log('open tag canvas later:', tagConcept.title || tagConcept.id);
	}

	setMainView(nextView: MainView) {
		this.mainView = nextView;

		if (nextView === 'table') {
			this.sidebarTab = 'tree';
		}
	}

	async createConceptFromMenu(sizePreset: ConceptSizePreset = 'medium') {
		if (this.contextMenu.targetType === 'canvas') {
			await this.createConcept({
				position: {
					x: this.contextMenu.worldX,
					y: this.contextMenu.worldY
				},
				sizePreset
			});
		} else {
			await this.createConcept({ sizePreset });
		}

		this.closeContextMenu();
	}

	async deleteInstanceFromMenu() {
		if (this.contextMenu.targetType !== 'card') {
			return;
		}

		await this.deleteInstance(this.contextMenu.instanceId);
		this.closeContextMenu();
	}

	openImportChildrenMenu() {
		if (this.contextMenu.targetType !== 'card') {
			return;
		}

		this.importChildrenMenu = {
			visible: true,
			x: this.contextMenu.x + 170,
			y: this.contextMenu.y,
			targetInstanceId: this.contextMenu.instanceId
		};
	}

	closeImportChildrenMenu() {
		this.importChildrenMenu = {
			visible: false,
			x: 0,
			y: 0,
			targetInstanceId: null
		};
	}

	closeContextMenu() {
		this.contextMenu = {
			visible: false,
			x: 0,
			y: 0,
			targetType: null,
			instanceId: null
		};

		this.closeImportChildrenMenu();
	}

	async importChildrenFromSource(sourceInstanceId: string) {
		if (!this.importChildrenMenu.targetInstanceId) {
			return;
		}

		try {
			await importChildrenFromConceptInstance(
				sourceInstanceId,
				this.importChildrenMenu.targetInstanceId
			);
		} catch {
			console.error('Failed to import children');
			return;
		}

		this.closeContextMenu();
		await invalidateAll();
	}
}

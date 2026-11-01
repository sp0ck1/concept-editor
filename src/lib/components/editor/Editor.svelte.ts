import type { Tag } from '$lib/model/Tag';
import { ensureTag, createTagInstance } from '$lib/client/tags';
import type { Context } from '$lib/model/Context';
import { normalizeContext } from '$lib/model/normalizeContext';
import { updateContextRecord } from '$lib/client/context';
import { invalidateAll } from '$app/navigation';
import { tick } from 'svelte';
import {
	createConceptRecord,
	updateConceptRecord,
	updateConceptTitleFromInstanceRecord
} from '$lib/client/concepts';
import {
	deleteConceptInstancesBatch,
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
	TitleConflictState,
	TitleConflictCandidate,
	TitleEditOutcome
} from '$lib/components/editor/EditorTypes';
import type { Concept } from '$lib/model/Concept';
import type { ConceptCardView } from '$lib/model/ConceptCardView';
import type { ConceptInstance } from '$lib/model/ConceptInstance';
import { normalizeConcept } from '$lib/model/normalizeConcept';
import { normalizeConceptInstance } from '$lib/model/normalizeConceptInstance';
import { getRelationshipsForConcept } from '$lib/model/relationshipQueries';
import type { TitleConflictMode, TitleConflictResolution } from '$lib/model/TitleConflictMode';
import { SvelteSet } from 'svelte/reactivity';

export type TagPreview = {
	id: string;
	conceptId: string;
	instance: ConceptInstance;
	x: number;
	y: number;
	opaque: boolean;
};

export class Editor {
	canvas: CanvasController;

	tagPreviews = $state<TagPreview[]>([]);
	private tagPreviewElements = new Map<string, HTMLElement>();
	private tagPreviewSources = new Map<string, HTMLElement>();
	private pendingTagPreview: {
		source: HTMLElement;
		timer: ReturnType<typeof setTimeout>;
		x: number;
		y: number;
	} | null = null;

	// Keep a detached baseline so failed optimistic edits can be reverted even while offline.
	private lastLoadedData: EditorData = {
		context: normalizeContext({}),
		tags: [],
		concepts: [],
		instances: [],
		relationships: [],
		relationshipDefinitions: []
	};

	tags = $state<Tag[]>([]);
	context = $state<Context>(normalizeContext({}));
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
	titleConflictSaving = $state(false);
	titleConflictError = $state<string | null>(null);
	private pendingTitleEdit: { instanceId: string; promise: Promise<TitleEditOutcome> } | null =
		null;
	private completeTitleConflict: ((outcome: TitleEditOutcome) => void) | null = null;
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
		this.dismissTagPreview();
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
		this.context = normalizeContext(data.context);
		this.tags = data.tags.map((tag) => ({ ...tag }));
		this.concepts = data.concepts.map(normalizeConcept);
		this.instances = data.instances.map(normalizeConceptInstance);
		this.relationships = data.relationships;
		this.relationshipDefinitions = data.relationshipDefinitions;
		const missing = this.tagPreviews.findIndex(
			(preview) => !this.getConceptById(preview.conceptId)
		);
		if (missing !== -1) this.trimTagPreviews(missing);
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

	getTags(tagIds: string[]): Tag[] {
		return tagIds.flatMap((id) => {
			const tag = this.tags.find((item) => item.id === id);
			return tag ? [tag] : [];
		});
	}

	beginTagPreview(tagId: string, source: HTMLElement, x: number, y: number) {
		if (this.pendingTagPreview?.source === source) return;
		this.cancelTagPreviewDelay();
		if ([...this.tagPreviewSources.values()].includes(source)) return;
		const tag = this.tags.find((item) => item.id === tagId);
		if (!tag?.representedByConceptId || !this.getConceptById(tag.representedByConceptId)) return;
		const parent = this.tagPreviews.findLast((preview) =>
			this.tagPreviewElements.get(preview.id)?.contains(source)
		);
		const timer = setTimeout(() => {
			const pending = this.pendingTagPreview;
			this.pendingTagPreview = null;
			const currentTag = this.tags.find((item) => item.id === tagId);
			const parentIndex = parent ? this.tagPreviews.findIndex((item) => item.id === parent.id) : -1;
			if (
				!pending ||
				!source.isConnected ||
				(parent && parentIndex === -1) ||
				!currentTag?.representedByConceptId ||
				!this.getConceptById(currentTag.representedByConceptId)
			)
				return;
			this.trimTagPreviews(parentIndex + 1);
			const id = 'preview-' + crypto.randomUUID();
			const conceptId = currentTag.representedByConceptId;
			this.tagPreviewSources.set(id, source);
			this.tagPreviews = [
				...this.tagPreviews,
				{
					id,
					conceptId,
					x: pending.x,
					y: pending.y,
					opaque: false,
					instance: normalizeConceptInstance({
						id,
						conceptId,
						parentInstanceId: null,
						x: 0,
						y: 0,
						lastCameraZoom: 1
					})
				}
			];
		}, 2000);
		this.pendingTagPreview = { source, timer, x, y };
	}

	moveTagPreviewPointer(source: HTMLElement, x: number, y: number) {
		if (this.pendingTagPreview?.source === source) {
			this.pendingTagPreview.x = x;
			this.pendingTagPreview.y = y;
		}
	}

	registerTagPreviewElement(id: string, element: HTMLElement) {
		this.tagPreviewElements.set(id, element);
		return () => {
			if (this.tagPreviewElements.get(id) === element) this.tagPreviewElements.delete(id);
		};
	}

	enterTagPreview(id: string) {
		const preview = this.tagPreviews.find((item) => item.id === id);
		if (preview) preview.opaque = true;
	}

	leaveTagPreview(next: EventTarget | null) {
		if (!(next instanceof Node)) {
			this.dismissTagPreview();
			return;
		}
		if (this.pendingTagPreview?.source.contains(next)) return;
		this.cancelTagPreviewDelay();
		if (
			[...this.tagPreviewSources.values(), ...this.tagPreviewElements.values()].some((element) =>
				element.contains(next)
			)
		)
			return;
		this.dismissTagPreview();
	}

	private cancelTagPreviewDelay() {
		if (this.pendingTagPreview) clearTimeout(this.pendingTagPreview.timer);
		this.pendingTagPreview = null;
	}

	private trimTagPreviews(count: number) {
		for (const preview of this.tagPreviews.slice(count)) {
			this.tagPreviewElements.delete(preview.id);
			this.tagPreviewSources.delete(preview.id);
		}
		this.tagPreviews = this.tagPreviews.slice(0, count);
	}

	dismissTagPreview() {
		const wasOpen = this.tagPreviews.length > 0 || this.pendingTagPreview !== null;
		this.cancelTagPreviewDelay();
		this.trimTagPreviews(0);
		return wasOpen;
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
		const parentInstanceId =
			options.parentInstanceId === undefined
				? this.currentCanvasOwnerInstanceId
				: options.parentInstanceId;

		const result = await createConceptRecord({
			...(options.position ?? {}),
			...(options.title !== undefined ? { title: options.title } : {}),
			width: options.width ?? presetSize.width,
			height: options.height ?? presetSize.height,
			parentInstanceId
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

	async updateContext(updates: Partial<Omit<Context, 'id'>>) {
		try {
			await updateContextRecord(updates);
			await invalidateAll();
			return true;
		} catch (error) {
			return this.recoverFromSaveFailure(
				'Could not confirm that Context changes were saved.',
				error
			);
		}
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
		return this.deleteInstances([id]);
	}

	async deleteInstances(instanceIds: string[]) {
		const existingIds = new Set(this.instances.map((instance) => instance.id));
		this.selectedInstanceIds = new Set(
			[...this.selectedInstanceIds].filter((id) => existingIds.has(id))
		);
		if (this.activeInstanceId && !existingIds.has(this.activeInstanceId))
			this.activeInstanceId = null;
		if (this.pendingFocusInstanceId && !existingIds.has(this.pendingFocusInstanceId))
			this.pendingFocusInstanceId = null;
		const ids = [...new Set(instanceIds)].filter((id) => existingIds.has(id));
		if (ids.length === 0) return true;
		const deletedIds = new Set(ids);
		this.canvas.clearInteractiveState();
		this.canvas.clearMarqueePreviewSelection();
		try {
			await deleteConceptInstancesBatch(ids);
			this.selectedInstanceIds = new Set(
				[...this.selectedInstanceIds].filter((id) => !deletedIds.has(id))
			);
			if (this.activeInstanceId && deletedIds.has(this.activeInstanceId))
				this.activeInstanceId = null;
			if (this.pendingFocusInstanceId && deletedIds.has(this.pendingFocusInstanceId))
				this.pendingFocusInstanceId = null;
			if (
				this.importChildrenMenu.targetInstanceId &&
				deletedIds.has(this.importChildrenMenu.targetInstanceId)
			)
				this.closeImportChildrenMenu();
			await invalidateAll();
			return true;
		} catch (error) {
			return this.recoverFromSaveFailure('Could not confirm that instances were deleted.', error);
		}
	}

	commitTitleEdit(card: ConceptCardView, nextTitle: string): Promise<TitleEditOutcome> {
		const currentCard = this.getCard(card.instance.id);
		if (!currentCard) return Promise.resolve('failed');
		if (this.pendingTitleEdit) {
			return this.pendingTitleEdit.instanceId === card.instance.id
				? this.pendingTitleEdit.promise
				: Promise.resolve('cancelled');
		}
		const title = nextTitle.trim();
		if (title === currentCard.concept.title) return Promise.resolve('unchanged');
		const promise = this.updateConceptTitleFromInstance(currentCard, title);
		this.pendingTitleEdit = { instanceId: card.instance.id, promise };
		void promise.then(() => {
			if (this.pendingTitleEdit?.promise === promise) this.pendingTitleEdit = null;
		});
		return promise;
	}

	async updateConceptTitleFromInstance(
		card: ConceptCardView,
		title: string,
		conflictMode: TitleConflictMode = 'report-conflict'
	): Promise<TitleEditOutcome> {
		const instanceId = card.instance.id;
		const originalConceptId = card.concept.id;
		const previousTitle = card.concept.title;
		try {
			const result = await updateConceptTitleFromInstanceRecord(
				originalConceptId,
				instanceId,
				title,
				conflictMode
			);
			if (result.status === 'title-conflict') {
				return await new Promise<TitleEditOutcome>((resolve) => {
					this.completeTitleConflict = resolve;
					this.titleConflictError = null;
					this.titleConflict = {
						instanceId,
						originalConceptId,
						previousTitle,
						title,
						matchingConcepts: result.matchingConcepts
					};
				});
			}
			await invalidateAll();
			return 'saved';
		} catch (error) {
			this.recoverFromSaveFailure('Could not confirm that the title was saved.', error);
			return 'failed';
		}
	}

	getTitleConflictCandidates(): TitleConflictCandidate[] {
		const conflict = this.titleConflict;
		if (!conflict) return [];
		const projectTitle = this.context.title || 'Untitled Context';
		return conflict.matchingConcepts.flatMap<TitleConflictCandidate>((concept) => {
			const occurrences = this.instances.filter((instance) => instance.conceptId === concept.id);
			if (occurrences.length === 0) {
				return [
					{
						concept,
						instance: null,
						path: [projectTitle, 'Not placed', concept.title].join(' > '),
						propertiesCount: Object.keys(concept.properties).length,
						childrenCount: 0
					}
				];
			}
			return occurrences.map((instance) => ({
				concept,
				instance,
				path: [
					projectTitle,
					...this.getInstanceBreadcrumb(instance.id).map(
						(card) => card.concept.title || card.concept.id
					)
				].join(' > '),
				propertiesCount:
					Object.keys(concept.properties).length + Object.keys(instance.properties).length,
				childrenCount: this.instances.filter((child) => child.parentInstanceId === instance.id)
					.length
			}));
		});
	}

	async resolveTitleConflict(
		mode: Exclude<TitleConflictMode, 'report-conflict'>,
		resolution?: TitleConflictResolution
	): Promise<boolean> {
		const conflict = this.titleConflict;
		if (!conflict || this.titleConflictSaving) return false;
		if (mode === 'use-existing' && !resolution) {
			this.titleConflictError = 'Choose a Concept and its copy options first.';
			return false;
		}
		this.titleConflictSaving = true;
		this.titleConflictError = null;
		let result: Awaited<ReturnType<typeof updateConceptTitleFromInstanceRecord>>;
		try {
			result = await updateConceptTitleFromInstanceRecord(
				conflict.originalConceptId,
				conflict.instanceId,
				conflict.title,
				mode,
				resolution
			);
		} catch (error) {
			this.titleConflictError =
				error instanceof Error ? error.message : 'Could not save this choice.';
			this.titleConflictSaving = false;
			return false;
		}
		if (result.status === 'title-conflict') {
			this.titleConflict = { ...conflict, matchingConcepts: result.matchingConcepts };
			this.titleConflictError = 'The available Concepts changed. Choose again.';
			this.titleConflictSaving = false;
			return false;
		}
		try {
			await invalidateAll();
		} catch (error) {
			this.recoverFromSaveFailure(
				'The choice was saved, but its refreshed data could not be loaded.',
				error
			);
			this.finishTitleConflict('failed');
			return false;
		}
		if (
			result.instance.id !== conflict.instanceId &&
			this.cardsInCurrentCanvas.some((card) => card.instance.id === result.instance.id)
		) {
			this.selectOnlyInstance(result.instance.id);
		}
		this.finishTitleConflict('resolved');
		return true;
	}

	cancelTitleConflict() {
		if (this.titleConflictSaving) return;
		this.finishTitleConflict('cancelled');
	}

	private finishTitleConflict(outcome: TitleEditOutcome) {
		const complete = this.completeTitleConflict;
		this.completeTitleConflict = null;
		this.titleConflict = null;
		this.titleConflictError = null;
		this.titleConflictSaving = false;
		complete?.(outcome);
	}

	async setContextProperties(properties: Record<string, string>) {
		this.context.properties = properties;
		return this.updateContext({ properties });
	}

	async setContextTagIds(tagIds: string[]) {
		const uniqueTagIds = [...new Set(tagIds)];
		this.context.tagIds = uniqueTagIds;
		return this.updateContext({ tagIds: uniqueTagIds });
	}

	private rememberTag(tag: Tag) {
		this.tags = [...this.tags.filter((item) => item.id !== tag.id), { ...tag }];
	}

	async addContextTag(title: string) {
		let result: Awaited<ReturnType<typeof ensureTag>>;
		try {
			result = await ensureTag(title);
		} catch (error) {
			return this.recoverFromSaveFailure(
				'Could not confirm that the Context tag was saved.',
				error
			);
		}
		this.rememberTag(result.tag);
		return this.setContextTagIds([...this.context.tagIds, result.tag.id]);
	}

	async removeContextTag(tag: Tag) {
		return this.setContextTagIds(this.context.tagIds.filter((id) => id !== tag.id));
	}

	async setProperties(card: ConceptCardView, properties: Record<string, string>) {
		card.concept.properties = properties;

		return this.updateConcept(card.concept.id, {
			properties
		});
	}

	async setConceptTagIds(card: ConceptCardView, tagIds: string[]) {
		const uniqueTagIds = [...new Set(tagIds)];
		card.concept.tagIds = uniqueTagIds;
		await this.updateConcept(card.concept.id, { tagIds: uniqueTagIds });
	}

	async addTag(card: ConceptCardView, title: string, representedByConceptId?: string) {
		let result: Awaited<ReturnType<typeof ensureTag>>;
		try {
			result =
				representedByConceptId === undefined
					? await ensureTag(title)
					: await ensureTag(title, representedByConceptId);
		} catch (error) {
			await this.recoverFromSaveFailure('Could not confirm that the tag was saved.', error);
			return;
		}
		this.rememberTag(result.tag);
		await this.setConceptTagIds(card, [...card.concept.tagIds, result.tag.id]);
	}

	async removeTag(card: ConceptCardView, tag: Tag) {
		await this.setConceptTagIds(
			card,
			card.concept.tagIds.filter((id) => id !== tag.id)
		);
	}

	openTagCanvas(tag: Tag) {
		console.log('open tag canvas later:', tag.title || tag.id);
	}

	async createInstanceFromTag(tagId: string, position: { x: number; y: number }) {
		try {
			const result = await createTagInstance(tagId, {
				parentInstanceId: this.currentCanvasOwnerInstanceId,
				...position
			});
			await invalidateAll();
			if (this.cardsInCurrentCanvas.some((card) => card.instance.id === result.instance.id)) {
				this.selectOnlyInstance(result.instance.id);
			}
		} catch (error) {
			await this.recoverFromSaveFailure(
				'Could not confirm that the tag occurrence was saved. Reload before trying again.',
				error
			);
		}
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

	getContextMenuDeleteInstanceIds(): string[] {
		if (this.contextMenu.targetType !== 'card') return [];
		const targetId = this.contextMenu.instanceId;
		return this.selectedInstanceIds.has(targetId)
			? this.cardsInCurrentCanvas
					.filter((card) => this.selectedInstanceIds.has(card.instance.id))
					.map((card) => card.instance.id)
			: this.cardsInCurrentCanvas.some((card) => card.instance.id === targetId)
				? [targetId]
				: [];
	}

	async deleteInstanceFromMenu() {
		const ids = this.getContextMenuDeleteInstanceIds();
		this.closeContextMenu();
		return this.deleteInstances(ids);
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

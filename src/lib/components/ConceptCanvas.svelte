<script lang="ts">
	import { tick } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import ConceptCard from '$lib/components/ConceptCard.svelte';
	import CanvasContextMenu from '$lib/components/canvas/CanvasContextMenu.svelte';
	import CanvasTopbar from '$lib/components/canvas/CanvasTopbar.svelte';
	import ConceptSidebar from '$lib/components/sidebar/ConceptSidebar.svelte';
	import {
		emptyDragState,
		emptyPendingDragState,
		emptyResizeState,
		emptySelectionBoxState,
		conceptSizePresets,
		type Concept,
		type ConceptInstance,
		type ConceptCardView,
		type ConceptSizePreset,
		type ChildTileDragState,
		type ContextMenu,
		type DragState,
		type MainView,
		type PendingDragState,
		type ResizeState,
		type SelectionBoxState,
		type SidebarTab,
		type CreateConceptOptions
	} from '$lib/canvas/types';
	import { clamp, normalizeRect, getRectOverlapRatio } from '$lib/canvas/geometry';
	import {
		defaultConceptWidth,
		defaultConceptHeight
	} from '$lib/concepts/normalizeConceptInstance';
	import { lineParser, type ParsedConceptInput } from '$lib/parsers';
	import PasteImportConfirmation from '$lib/components/canvas/PasteImportConfirmation.svelte';
	import CanvasSelectionBox from '$lib/components/canvas/CanvasSelectionBox.svelte';

	// let Declarations

	let { initialCards, initialConcepts } = $props<{
		initialCards: ConceptCardView[];
		initialConcepts: Concept[];
	}>();

	let contextMenu = $state<ContextMenu>({
		visible: false,
		x: 0,
		y: 0,
		targetType: null,
		instanceId: null
	});

	let importChildrenMenu = $state<{
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

	
	let cards = $state<ConceptCardView[]>([]);
	let concepts = $state<Concept[]>([]);


	$effect(() => {
		concepts = initialConcepts.map((concept) => ({
			...concept,
			properties: concept.properties ?? {},
			tagConceptIds: concept.tagConceptIds ?? []
		}));

		cards = initialCards.map((card) => ({
			concept: {
				...card.concept,
				properties: card.concept.properties ?? {},
				tagConceptIds: card.concept.tagConceptIds ?? []
			},
			instance: {
				...card.instance,
				parentInstanceId: card.instance.parentInstanceId ?? null,
				x: card.instance.x ?? 0,
				y: card.instance.y ?? 0,
				width: card.instance.width ?? defaultConceptWidth,
				height: card.instance.height ?? defaultConceptHeight
			}
		}));
	});

	let canvasElement = $state<HTMLElement | null>(null);

	let activeInstanceId = $state<string | null>(null);
	let pendingFocusInstanceId = $state<string | null>(null);
	let currentCanvasInstanceId = $state<string | null>(null);
	let selectedInstanceIds = $state<Set<string>>(new Set());
	let marqueePreviewInstanceIds = $state<Set<string>>(new Set());
	let sidebarNewTag = $state('');
	let arrangingCards = $state(false);
	let sidebarTab = $state<SidebarTab>('concept');
	let mainView = $state<MainView>('canvas');
	let arrangingCamera = $state(false);

	let panX = $state(0);
	let panY = $state(0);
	let zoom = $state(1);

	let isPanning = $state(false);
	let panStartMouseX = $state(0);
	let panStartMouseY = $state(0);
	let panStartX = $state(0);
	let panStartY = $state(0);

	let dragState = $state<DragState>(emptyDragState());
	let pendingDragState = $state<PendingDragState>(emptyPendingDragState());
	let resizeState = $state<ResizeState>(emptyResizeState());
	let selectionBoxState = $state<SelectionBoxState>(emptySelectionBoxState());

	let panToggleOnSpace = $state(false);

	let pasteConfirmation = $state<{
		visible: boolean;
		items: ParsedConceptInput[];
		targetConceptName: string;
	}>({
		visible: false,
		items: [],
		targetConceptName: ''
	});

	const selectionDragThresholdPx = 4;
	const selectionOverlapThreshold = 0.25;

	const minZoom = 0.25;
	const maxZoom = 3;
	const doubleEnterWindowMs = 450;

	const arrangeAnimationMs = 4000;

	let lastEnterPress = $state<{
		targetId: string | null;
		time: number;
	}>({
		targetId: null,
		time: 0
	});

	let visibleCards = $derived(
		cards.filter((card) => card.instance.parentInstanceId === currentCanvasInstanceId)
	);

	let childTileDragState = $state<ChildTileDragState>({
		active: false,
		childCard: null,
		mouseX: 0,
		mouseY: 0
	});






type PackedCardPlacement = {
	card: ConceptCardView;
	x: number;
	y: number;
	width: number;
	height: number;
};

type PackedLayout = {
	placements: PackedCardPlacement[];
	width: number;
	height: number;
	columns: number;
};

function packCardsIntoColumns(
	cardsToPack: ConceptCardView[],
	columns: number,
	columnUnitWidth: number,
	gap: number
): PackedLayout {
	const columnHeights = Array.from({ length: columns }, () => 0);

	const placements = cardsToPack.map((card) => {
		const cardWidth = card.instance.width;
		const cardHeight = card.instance.height;

		const columnSpan = Math.min(
			columns,
			Math.max(1, Math.ceil((cardWidth + gap) / (columnUnitWidth + gap)))
		);

		let bestColumn = 0;
		let bestY = Number.POSITIVE_INFINITY;

		for (let column = 0; column <= columns - columnSpan; column += 1) {
			const candidateY = Math.max(...columnHeights.slice(column, column + columnSpan));

			if (candidateY < bestY) {
				bestY = candidateY;
				bestColumn = column;
			}
		}

		const spanWidth = columnSpan * columnUnitWidth + (columnSpan - 1) * gap;

		const x =
			bestColumn * (columnUnitWidth + gap) +
			Math.max(0, (spanWidth - cardWidth) / 2);

		const y = bestY;

		const nextColumnHeight = y + cardHeight + gap;

		for (let column = bestColumn; column < bestColumn + columnSpan; column += 1) {
			columnHeights[column] = nextColumnHeight;
		}

		return {
			card,
			x,
			y,
			width: cardWidth,
			height: cardHeight
		};
	});

	const right = Math.max(...placements.map((placement) => placement.x + placement.width));
	const bottom = Math.max(...placements.map((placement) => placement.y + placement.height));

	return {
		placements,
		width: right,
		height: bottom,
		columns
	};
}

function chooseBestPackedLayout(
	cardsToPack: ConceptCardView[],
	gap: number
): PackedLayout {
	const viewportSize = getViewportWorldSize();
	const viewportRatio = viewportSize.width / Math.max(1, viewportSize.height);

	const columnUnitWidth = conceptSizePresets.small.width;
	const maxColumns = Math.max(1, Math.min(cardsToPack.length, 12));

	let bestLayout: PackedLayout | null = null;
	let bestScore = Number.POSITIVE_INFINITY;

	for (let columns = 1; columns <= maxColumns; columns += 1) {
		const layout = packCardsIntoColumns(cardsToPack, columns, columnUnitWidth, gap);

		const layoutRatio = layout.width / Math.max(1, layout.height);
		const ratioScore = Math.abs(Math.log(layoutRatio / viewportRatio));

		const areaScore = (layout.width * layout.height) / 1000000;

		const score = ratioScore * 10 + areaScore;

		if (score < bestScore) {
			bestScore = score;
			bestLayout = layout;
		}
	}

	if (!bestLayout) {
		return packCardsIntoColumns(cardsToPack, 1, columnUnitWidth, gap);
	}

	return bestLayout;
}








	// Functions

	function getTitleSizedConceptWidth(title: string) {
		const text = title.trim() || 'Untitled Concept';

		const approximateCharacterWidth = 9;
		const horizontalPadding = 32;
		const resizeHandleAllowance = 28;

		return Math.min(
			900,
			Math.max(
				conceptSizePresets.small.width,
				text.length * approximateCharacterWidth + horizontalPadding + resizeHandleAllowance
			)
		);
	}

	function getImportedConceptSize(title: string) {
		return {
			width: getTitleSizedConceptWidth(title),
			height: conceptSizePresets.small.height
		};
	}

	function handleChildTileDragStart(event: PointerEvent, childCard: ConceptCardView) {
		closeContextMenu();

		childTileDragState = {
			active: true,
			childCard,
			mouseX: event.clientX,
			mouseY: event.clientY
		};

		isPanning = false;
		pendingDragState = emptyPendingDragState();
		dragState = emptyDragState();
		resizeState = emptyResizeState();
	}

	async function createConceptFromMenu(sizePreset: ConceptSizePreset = 'medium') {
		if (contextMenu.targetType === 'canvas') {
			await createConcept({
				position: {
					x: contextMenu.worldX,
					y: contextMenu.worldY
				},
				sizePreset
			});
		} else {
			await createConcept({
				sizePreset
			});
		}

		closeContextMenu();
	}

	async function handleCanvasPaste(event: ClipboardEvent) {
		if (isInteractiveElement(document.activeElement)) {
			return;
		}

		const text = event.clipboardData?.getData('text/plain') ?? '';

		if (!text.trim()) {
			return;
		}

		const result = lineParser.parse(text);

		if (result.items.length === 0) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		const targetConceptName =
			currentCanvasCard?.concept.title || currentCanvasCard?.concept.id || 'Root';

		if (result.items.length > 25) {
			pasteConfirmation = {
				visible: true,
				items: result.items,
				targetConceptName
			};

			return;
		}

		await createConceptsFromParsedItems(result.items);
	}
	async function confirmPasteImport() {
		const items = pasteConfirmation.items;

		pasteConfirmation = {
			visible: false,
			items: [],
			targetConceptName: ''
		};

		await createConceptsFromParsedItems(items);
	}

	function cancelPasteImport() {
		pasteConfirmation = {
			visible: false,
			items: [],
			targetConceptName: ''
		};
	}

	async function createConceptsFromParsedItems(items: ParsedConceptInput[]) {
		const cleanedItems = items.filter((item) => item.title.trim());

		if (cleanedItems.length === 0) {
			return;
		}

		const start = getCenterOfCurrentCanvasView();

		const importedSizes = cleanedItems.map((item) => getImportedConceptSize(item.title));
		const maxImportedWidth = Math.max(...importedSizes.map((size) => size.width));
		const maxImportedHeight = Math.max(...importedSizes.map((size) => size.height));

		const gapX = maxImportedWidth + 48;
		const gapY = maxImportedHeight + 48;
		const columns = Math.ceil(Math.sqrt(cleanedItems.length));

		let lastCreatedInstanceId: string | null = null;

		for (const [index, item] of cleanedItems.entries()) {
			const column = index % columns;
			const row = Math.floor(index / columns);
			const size = importedSizes[index];

			const result = await createConcept({
				title: item.title,
				parentInstanceId: currentCanvasInstanceId,
				position: {
					x: start.x + column * gapX,
					y: start.y + row * gapY
				},
				width: size.width,
				height: size.height,
				focusAfterCreate: false
			});

			if (!result) {
				console.error('Failed to create imported concept:', item.title);
				continue;
			}

			lastCreatedInstanceId = result.instance.id;
		}

		if (lastCreatedInstanceId) {
			activeInstanceId = lastCreatedInstanceId;
			pendingFocusInstanceId = null;
		}

		await invalidateAll();
	}

	async function addSidebarTag(card: ConceptCardView) {
		const title = sidebarNewTag.trim();

		if (!title) {
			sidebarNewTag = '';
			return;
		}

		sidebarNewTag = '';

		await handleManualTagAdd(card, title);
	}

	function getConceptById(conceptId: string) {
		return concepts.find((concept) => concept.id === conceptId) ?? null;
	}

	function getTagConcepts(tagConceptIds: string[]) {
		return tagConceptIds
			.map((conceptId) => getConceptById(conceptId))
			.filter((concept): concept is Concept => Boolean(concept));
	}

	async function setConceptTagConceptIds(card: ConceptCardView, tagConceptIds: string[]) {
		const uniqueTagConceptIds = [...new Set(tagConceptIds)].filter(
			(conceptId) => conceptId !== card.concept.id
		);

		card.concept.tagConceptIds = uniqueTagConceptIds;

		await updateConcept(card.concept.id, {
			tagConceptIds: uniqueTagConceptIds
		});
	}

	async function tagConceptWithConcept(targetCard: ConceptCardView, tagConcept: Concept) {
		await setConceptTagConceptIds(targetCard, [
			...(targetCard.concept.tagConceptIds ?? []),
			tagConcept.id
		]);
	}

	async function handleManualTagAdd(card: ConceptCardView, title: string) {
		const response = await fetch('/api/concepts/ensure', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ title })
		});

		if (!response.ok) {
			console.error('Failed to ensure tag concept');
			return;
		}

		const result = (await response.json()) as {
			concept: Concept;
			created: boolean;
		};

		if (!concepts.some((concept) => concept.id === result.concept.id)) {
			concepts = [
				...concepts,
				{
					...result.concept,
					properties: result.concept.properties ?? {},
					tagConceptIds: result.concept.tagConceptIds ?? []
				}
			];
		}

		await tagConceptWithConcept(card, result.concept);
	}

	async function handleTagRemove(card: ConceptCardView, tagConcept: Concept) {
		await setConceptTagConceptIds(
			card,
			(card.concept.tagConceptIds ?? []).filter((conceptId) => conceptId !== tagConcept.id)
		);
	}

function nextAnimationFrame() {
	return new Promise<void>((resolve) => {
		requestAnimationFrame(() => resolve());
	});
}

	function openTagCanvas(tagConcept: Concept) {
		console.log('open tag canvas later:', tagConcept.title || tagConcept.id);
	}

	function getBoundsForInstanceUpdates(
	updates: {
		id: string;
		updates: {
			x: number;
			y: number;
		};
	}[]
) {
	const updatedCards = updates
		.map((update) => {
			const card = cards.find((item) => item.instance.id === update.id);

			if (!card) {
				return null;
			}

			return {
				left: update.updates.x,
				top: update.updates.y,
				right: update.updates.x + card.instance.width,
				bottom: update.updates.y + card.instance.height
			};
		})
		.filter(
			(bounds): bounds is { left: number; top: number; right: number; bottom: number } =>
				Boolean(bounds)
		);

	if (updatedCards.length === 0) {
		return null;
	}

	return {
		left: Math.min(...updatedCards.map((bounds) => bounds.left)),
		top: Math.min(...updatedCards.map((bounds) => bounds.top)),
		right: Math.max(...updatedCards.map((bounds) => bounds.right)),
		bottom: Math.max(...updatedCards.map((bounds) => bounds.bottom))
	};
}

	function getCameraForBoundsOnlyIfNeeded(bounds: {
	left: number;
	top: number;
	right: number;
	bottom: number;
}) {
	if (!canvasElement) {
		return null;
	}

	const rect = canvasElement.getBoundingClientRect();

	const padding = 12;

	const contentWidth = Math.max(1, bounds.right - bounds.left);
	const contentHeight = Math.max(1, bounds.bottom - bounds.top);

	const availableWidth = rect.width - padding * 2;
	const availableHeight = rect.height - padding * 2;

	const currentScreenWidth = contentWidth * zoom;
	const currentScreenHeight = contentHeight * zoom;

	const centerX = (bounds.left + bounds.right) / 2;
	const centerY = (bounds.top + bounds.bottom) / 2;

	const alreadyFits =
		currentScreenWidth <= availableWidth &&
		currentScreenHeight <= availableHeight;

	const nextZoom = alreadyFits
		? zoom
		: clamp(Math.min(availableWidth / contentWidth, availableHeight / contentHeight), minZoom, zoom);

	return {
		zoom: nextZoom,
		panX: rect.width / 2 - centerX * nextZoom,
		panY: rect.height / 2 - centerY * nextZoom
	};
}

async function animateLayoutUpdates(
	updates: {
		id: string;
		updates: {
			x: number;
			y: number;
		};
	}[]
) {
	const futureBounds = getBoundsForInstanceUpdates(updates);
	const futureCamera = futureBounds ? getCameraForBoundsOnlyIfNeeded(futureBounds) : null;

	arrangingCards = true;
	arrangingCamera = true;

	await tick();
	await nextAnimationFrame();

	for (const update of updates) {
		const card = cards.find((item) => item.instance.id === update.id);

		if (!card) {
			continue;
		}

		card.instance.x = update.updates.x;
		card.instance.y = update.updates.y;
	}

	if (futureCamera) {
		zoom = futureCamera.zoom;
		panX = futureCamera.panX;
		panY = futureCamera.panY;
	}

	await tick();

	await new Promise((resolve) => window.setTimeout(resolve, arrangeAnimationMs));

	arrangingCards = false;
	arrangingCamera = false;

	await updateInstancesBatch(updates);
}

async function arrangeVisibleCardsInGrid() {
	if (visibleCards.length === 0) {
		return;
	}

	const sortedCards = [...visibleCards].sort((a, b) => {
		const titleA = a.concept.title || a.concept.id;
		const titleB = b.concept.title || b.concept.id;

		return titleA.localeCompare(titleB);
	});

	const viewportCenter = getViewportCenterWorldPoint();
	const gap = 48;

	const layout = chooseBestPackedLayout(sortedCards, gap);

	const layoutLeft = viewportCenter.x - layout.width / 2;
	const layoutTop = viewportCenter.y - layout.height / 2;

	const updates = layout.placements.map((placement) => ({
		id: placement.card.instance.id,
		updates: {
			x: layoutLeft + placement.x,
			y: layoutTop + placement.y
		}
	}));

	await animateLayoutUpdates(updates);

	fitVisibleCardsOnlyIfNeeded();
}
function fitVisibleCardsOnlyIfNeeded() {
	if (!canvasElement || visibleCards.length === 0) {
		return;
	}

	const rect = canvasElement.getBoundingClientRect();
	const bounds = getCardsWorldBounds(visibleCards);

	const padding = 12;

	const contentWidth = Math.max(1, bounds.right - bounds.left);
	const contentHeight = Math.max(1, bounds.bottom - bounds.top);

	const availableWidth = rect.width - padding * 2;
	const availableHeight = rect.height - padding * 2;

	const currentScreenWidth = contentWidth * zoom;
	const currentScreenHeight = contentHeight * zoom;

	const alreadyFits =
		currentScreenWidth <= availableWidth &&
		currentScreenHeight <= availableHeight;

	const centerX = (bounds.left + bounds.right) / 2;
	const centerY = (bounds.top + bounds.bottom) / 2;

	if (alreadyFits) {
		panX = rect.width / 2 - centerX * zoom;
		panY = rect.height / 2 - centerY * zoom;
		return;
	}

	const nextZoom = clamp(
		Math.min(availableWidth / contentWidth, availableHeight / contentHeight),
		minZoom,
		zoom
	);

	zoom = nextZoom;

	panX = rect.width / 2 - centerX * zoom;
	panY = rect.height / 2 - centerY * zoom;
}
	function getViewportCenterWorldPoint() {
		if (!canvasElement) {
			return { x: 0, y: 0 };
		}

		const rect = canvasElement.getBoundingClientRect();

		return {
			x: (rect.width / 2 - panX) / zoom,
			y: (rect.height / 2 - panY) / zoom
		};
	}

	function getViewportWorldSize() {
		if (!canvasElement) {
			return { width: 0, height: 0 };
		}

		const rect = canvasElement.getBoundingClientRect();

		return {
			width: rect.width / zoom,
			height: rect.height / zoom
		};
	}

	function getCardCenter(card: ConceptCardView) {
		return {
			x: card.instance.x + card.instance.width / 2,
			y: card.instance.y + card.instance.height / 2
		};
	}

	function panToWorldPoint(worldPoint: { x: number; y: number }) {
		if (!canvasElement) {
			return;
		}

		const rect = canvasElement.getBoundingClientRect();

		panX = rect.width / 2 - worldPoint.x * zoom;
		panY = rect.height / 2 - worldPoint.y * zoom;
	}

	function focusCard(card: ConceptCardView) {
		panToWorldPoint(getCardCenter(card));
	}

	function focusSelectionOrNearestCard() {
		const selectedVisibleCards = visibleCards.filter((card) =>
			selectedInstanceIds.has(card.instance.id)
		);

		if (selectedVisibleCards.length > 0) {
			const bounds = getCardsWorldBounds(selectedVisibleCards);
			panToWorldPoint({
				x: (bounds.left + bounds.right) / 2,
				y: (bounds.top + bounds.bottom) / 2
			});
			return;
		}

		const viewportCenter = getViewportCenterWorldPoint();

		const nearestCard = visibleCards
			.map((card) => {
				const center = getCardCenter(card);
				const distance = Math.hypot(center.x - viewportCenter.x, center.y - viewportCenter.y);

				return { card, distance };
			})
			.sort((a, b) => a.distance - b.distance)[0]?.card;

		if (nearestCard) {
			focusCard(nearestCard);
		}
	}

	function getCardsWorldBounds(cardsToFrame: ConceptCardView[]) {
		const left = Math.min(...cardsToFrame.map((card) => card.instance.x));
		const top = Math.min(...cardsToFrame.map((card) => card.instance.y));
		const right = Math.max(...cardsToFrame.map((card) => card.instance.x + card.instance.width));
		const bottom = Math.max(...cardsToFrame.map((card) => card.instance.y + card.instance.height));

		return { left, top, right, bottom };
	}

	function frameVisibleCards() {
		if (!canvasElement || visibleCards.length === 0) {
			return;
		}

		const rect = canvasElement.getBoundingClientRect();
		const bounds = getCardsWorldBounds(visibleCards);

		const padding = 6;
		const contentWidth = Math.max(1, bounds.right - bounds.left);
		const contentHeight = Math.max(1, bounds.bottom - bounds.top);

		// Zooms out if frame would be too small. Needs to also zoom in if frame would be too big.
		const nextZoom = clamp(
			Math.min(
				(rect.width - padding * 2) / contentWidth,
				(rect.height - padding * 2) / contentHeight
			),
			minZoom,
			maxZoom
		);

		zoom = nextZoom;

		const centerX = (bounds.left + bounds.right) / 2;
		const centerY = (bounds.top + bounds.bottom) / 2;

		panX = rect.width / 2 - centerX * zoom;
		panY = rect.height / 2 - centerY * zoom;
	}

	function getCardsInsideSelectionBox() {
		const selectionWorldRect = getSelectionBoxWorldRect();

		if (!selectionWorldRect) {
			return [];
		}

		return visibleCards.filter((card) => {
			const overlapRatio = getRectOverlapRatio(getCardWorldRect(card), selectionWorldRect);
			return overlapRatio >= selectionOverlapThreshold;
		});
	}

	function updateMarqueePreviewSelection() {
		if (!selectionBoxState.active) {
			marqueePreviewInstanceIds = new Set();
			return;
		}

		const previewCards = getCardsInsideSelectionBox();
		marqueePreviewInstanceIds = new Set(previewCards.map((card) => card.instance.id));
	}

	function clearMarqueePreviewSelection() {
		marqueePreviewInstanceIds = new Set();
	}

	function applyMarqueeSelection() {
		const selectedByBox = [...marqueePreviewInstanceIds];

		if (selectionBoxState.active && selectionBoxState.additive) {
			selectedInstanceIds = new Set([...selectedInstanceIds, ...selectedByBox]);
		} else {
			selectedInstanceIds = new Set(selectedByBox);
		}

		activeInstanceId = selectedByBox[selectedByBox.length - 1] ?? null;
		clearMarqueePreviewSelection();
	}

	function getCanvasPointFromPointerEvent(event: PointerEvent | MouseEvent) {
		if (!canvasElement) {
			return { x: 0, y: 0 };
		}

		const rect = canvasElement.getBoundingClientRect();

		return {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top
		};
	}

	function canvasPointToWorldPoint(point: { x: number; y: number }) {
		return {
			x: (point.x - panX) / zoom,
			y: (point.y - panY) / zoom
		};
	}

	function getSelectionBoxCanvasRect() {
		if (!selectionBoxState.active) {
			return null;
		}

		return normalizeRect({
			left: selectionBoxState.startCanvasX,
			top: selectionBoxState.startCanvasY,
			right: selectionBoxState.currentCanvasX,
			bottom: selectionBoxState.currentCanvasY
		});
	}

	function getSelectionBoxWorldRect() {
		const canvasRect = getSelectionBoxCanvasRect();

		if (!canvasRect) {
			return null;
		}

		const startWorld = canvasPointToWorldPoint({
			x: canvasRect.left,
			y: canvasRect.top
		});

		const endWorld = canvasPointToWorldPoint({
			x: canvasRect.right,
			y: canvasRect.bottom
		});

		return normalizeRect({
			left: startWorld.x,
			top: startWorld.y,
			right: endWorld.x,
			bottom: endWorld.y
		});
	}

	function getCardWorldRect(card: ConceptCardView) {
		return {
			left: card.instance.x,
			top: card.instance.y,
			right: card.instance.x + card.instance.width,
			bottom: card.instance.y + card.instance.height
		};
	}

	function isSelectionModifierEvent(event: PointerEvent | MouseEvent) {
		return event.ctrlKey || event.metaKey || event.shiftKey;
	}

	function selectOnlyInstance(instanceId: string) {
		selectedInstanceIds = new Set([instanceId]);
		activeInstanceId = instanceId;
	}

	function toggleInstanceSelection(instanceId: string) {
		const nextSelectedInstanceIds = new Set(selectedInstanceIds);

		if (nextSelectedInstanceIds.has(instanceId)) {
			nextSelectedInstanceIds.delete(instanceId);
		} else {
			nextSelectedInstanceIds.add(instanceId);
		}

		selectedInstanceIds = nextSelectedInstanceIds;
		activeInstanceId = instanceId;
	}

	function clearSelection() {
		selectedInstanceIds = new Set();
		clearMarqueePreviewSelection();
		activeInstanceId = null;
	}

	function handleCardSelectionPointerDown(event: PointerEvent, card: ConceptCardView) {
		if (isSelectionModifierEvent(event)) {
			toggleInstanceSelection(card.instance.id);
			return;
		}

		if (!selectedInstanceIds.has(card.instance.id)) {
			selectOnlyInstance(card.instance.id);
			return;
		}

		activeInstanceId = card.instance.id;
	}

	function isInteractiveElement(element: Element | null) {
		if (!element) {
			return false;
		}

		return Boolean(
			element.closest(
				'input, textarea, button, select, [contenteditable="true"], [role="button"], .concept-child-tile'
			)
		);
	}

	function getCenterOfCurrentCanvasView() {
		if (!canvasElement) {
			return { x: 0, y: 0 };
		}

		const rect = canvasElement.getBoundingClientRect();

		const viewportCenterX = rect.width / 2;
		const viewportCenterY = rect.height / 2;

		return {
			x: (viewportCenterX - panX) / zoom,
			y: (viewportCenterY - panY) / zoom
		};
	}

	async function commitTitleEdit(card: ConceptCardView, nextTitle: string) {
		const trimmedTitle = nextTitle.trim();

		if (trimmedTitle === card.concept.title) {
			return;
		}

		await updateConceptTitleFromInstance(card, trimmedTitle);
	}


	// Every time Enter is pressed consumeDoubleEnter is called to check if it was pressed twice
	// i.e., within doubleEnterWindowMs of the last time.
	// This is the only function that assigns a value to lastEnterPress.
	// This function DOES NOT check if Enter was pressed. It assumes that is already true. 
	function consumeDoubleEnter(targetId: string) {
		const now = window.performance.now();

		// Confirm the user pressed Enter twice on the same click focused target 
		// and that the second Enter occurred less than doubleEnterWindowMs than the first
		const isDoubleEnter =
			lastEnterPress.targetId === targetId && now - lastEnterPress.time <= doubleEnterWindowMs;

		lastEnterPress = {
			targetId,
			time: now
		};

		return isDoubleEnter;
	}

	function getNextConceptPositionAfterCard(card: ConceptCardView) {
		const gap = 116;
		const verticalOffset = 40;
		const randomHoriOffset = Math.random() * (Math.random() >= 0.5 ? 1 : -1);
		const randomVertOffset = Math.random() * (Math.random() >= 0.5 ? 1 : -1);
		return {
			x: card.instance.x + gap * randomHoriOffset,
			y: card.instance.y + verticalOffset * randomVertOffset
		};
	}

	function getCardByInstanceId(instanceId: string) {
		return cards.find((card) => card.instance.id === instanceId);
	}

	function getInstanceBreadcrumb(instanceId: string) {
		const breadcrumb: ConceptCardView[] = [];
		const visited = new Set<string>();

		let current = getCardByInstanceId(instanceId);

		while (current && !visited.has(current.instance.id)) {
			visited.add(current.instance.id);
			breadcrumb.unshift(current);

			current = current.instance.parentInstanceId
				? getCardByInstanceId(current.instance.parentInstanceId)
				: undefined;
		}

		return breadcrumb;
	}

	let currentBreadcrumb = $derived.by(() => {
		if (currentCanvasInstanceId === null) {
			return [];
		}

		return getInstanceBreadcrumb(currentCanvasInstanceId);
	});

	let currentCanvasCard = $derived.by(() => {
		if (currentCanvasInstanceId === null) {
			return null;
		}

		return getCardByInstanceId(currentCanvasInstanceId) ?? null;
	});

	let importChildrenOptions = $derived.by(() => {
		if (!importChildrenMenu.visible || !importChildrenMenu.targetInstanceId) {
			return [];
		}

		return getImportChildrenOptions(importChildrenMenu.targetInstanceId);
	});

	function setMainView(nextView: MainView) {
		mainView = nextView;

		if (nextView === 'table') {
			sidebarTab = 'tree';
		}
	}

	function getChildCards(parentInstanceId: string) {
		return cards.filter((card) => card.instance.parentInstanceId === parentInstanceId);
	}

	function getImportChildrenOptions(targetInstanceId: string) {
		const targetCard = getCardByInstanceId(targetInstanceId);

		if (!targetCard) {
			return [];
		}

		return cards
			.filter((card) => {
				if (card.instance.id === targetInstanceId) {
					return false;
				}

				if (card.instance.conceptId !== targetCard.instance.conceptId) {
					return false;
				}

				const hasChildren = cards.some(
					(child) => child.instance.parentInstanceId === card.instance.id
				);

				return hasChildren;
			})
			.map((card) => ({
				instanceId: card.instance.id,
				breadcrumb: getBreadcrumbLabel(card.instance.id)
			}));
	}

	function openImportChildrenMenu() {
		if (contextMenu.targetType !== 'card') {
			return;
		}

		importChildrenMenu = {
			visible: true,
			x: contextMenu.x + 170,
			y: contextMenu.y,
			targetInstanceId: contextMenu.instanceId
		};
	}

	function closeImportChildrenMenu() {
		importChildrenMenu = {
			visible: false,
			x: 0,
			y: 0,
			targetInstanceId: null
		};
	}

	function getBreadcrumbLabel(instanceId: string) {
		const breadcrumb = getInstanceBreadcrumb(instanceId);

		if (breadcrumb.length === 0) {
			return instanceId;
		}

		return breadcrumb.map((card) => card.concept.title || card.concept.id).join(' > ');
	}

	async function createConcept(options: CreateConceptOptions = {}) {
		const sizePreset = options.sizePreset ?? 'medium';
		const presetSize = conceptSizePresets[sizePreset];

		const width = options.width ?? presetSize.width;
		const height = options.height ?? presetSize.height;

		const response = await fetch('/api/concepts', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				...(options.position ?? {}),
				...(options.title !== undefined ? { title: options.title } : {}),
				width,
				height,
				parentInstanceId: options.parentInstanceId ?? currentCanvasInstanceId
			})
		});

		if (!response.ok) {
			console.error('Failed to create concept');
			return null;
		}

		const result = (await response.json()) as {
			concept: Concept;
			instance: ConceptInstance;
		};

		if (options.focusAfterCreate ?? true) {
			pendingFocusInstanceId = result.instance.id;
			activeInstanceId = result.instance.id;
		}

		await invalidateAll();

		return result;
	}

	async function deleteInstance(id: string) {
		const response = await fetch('/api/concept-instances', {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ id })
		});

		if (!response.ok) {
			console.error('Failed to delete concept instance');
			return;
		}

		await invalidateAll();
	}

	async function deleteInstanceFromMenu() {
		if (contextMenu.targetType !== 'card') {
			return;
		}

		await deleteInstance(contextMenu.instanceId);
		closeContextMenu();
	}

	async function updateConcept(id: string, updates: Partial<Omit<Concept, 'id'>>) {
		const response = await fetch('/api/concepts', {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				id,
				...updates
			})
		});

		if (!response.ok) {
			console.error('Failed to update concept');
			return;
		}

		await invalidateAll();
	}

	async function updateInstance(
		id: string,
		updates: Partial<Omit<ConceptInstance, 'id' | 'conceptId'>>
	) {
		const response = await fetch('/api/concept-instances', {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				id,
				...updates
			})
		});

		if (!response.ok) {
			console.error('Failed to update concept instance');
			return;
		}

		await invalidateAll();
	}

	async function updateConceptTitleFromInstance(card: ConceptCardView, title: string) {
		const response = await fetch('/api/concepts', {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				id: card.concept.id,
				instanceId: card.instance.id,
				title
			})
		});

		if (!response.ok) {
			console.error('Failed to update concept title');
			return;
		}

		await invalidateAll();
	}

	async function handleCanvasDoubleClick(event: MouseEvent) {
		const canvas = event.currentTarget as HTMLElement;
		const rect = canvas.getBoundingClientRect();

		const mouseCanvasX = event.clientX - rect.left;
		const mouseCanvasY = event.clientY - rect.top;

		const mouseWorldX = (mouseCanvasX - panX) / zoom;
		const mouseWorldY = (mouseCanvasY - panY) / zoom;

		const offsetX = Math.round(Math.random() * 200 - 100);
		const offsetY = Math.round(Math.random() * 200 - 100);

		const position = {
			x: mouseWorldX + offsetX,
			y: mouseWorldY + offsetY
		};

		console.log(position);
		await createConcept({
			position
		});
	}

	function handleCanvasContextMenu(event: MouseEvent) {
		event.preventDefault();

		const canvas = event.currentTarget as HTMLElement;
		const rect = canvas.getBoundingClientRect();

		const mouseCanvasX = event.clientX - rect.left;
		const mouseCanvasY = event.clientY - rect.top;

		const worldX = (mouseCanvasX - panX) / zoom;
		const worldY = (mouseCanvasY - panY) / zoom;

		contextMenu = {
			visible: true,
			x: event.clientX,
			y: event.clientY,
			worldX,
			worldY,
			targetType: 'canvas',
			instanceId: null
		};
	}

	function closeContextMenu() {
		contextMenu = {
			visible: false,
			x: 0,
			y: 0,
			targetType: null,
			instanceId: null
		};

		closeImportChildrenMenu();
	}

	async function importChildrenFromSource(sourceInstanceId: string) {
		if (!importChildrenMenu.targetInstanceId) {
			return;
		}

		const response = await fetch('/api/concept-instances/import-children', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				sourceInstanceId,
				targetInstanceId: importChildrenMenu.targetInstanceId
			})
		});

		if (!response.ok) {
			console.error('Failed to import children');
			return;
		}

		closeContextMenu();
		await invalidateAll();
	}

	function handleCanvasWheel(event: WheelEvent) {
		event.preventDefault();

		const canvas = event.currentTarget as HTMLElement;
		const rect = canvas.getBoundingClientRect();

		const mouseX = event.clientX - rect.left;
		const mouseY = event.clientY - rect.top;

		const worldX = (mouseX - panX) / zoom;
		const worldY = (mouseY - panY) / zoom;

		const zoomDirection = event.deltaY > 0 ? -1 : 1;
		const zoomFactor = 0.1;
		const nextZoom = clamp(zoom + zoomDirection * zoomFactor, minZoom, maxZoom);

		zoom = nextZoom;

		panX = mouseX - worldX * zoom;
		panY = mouseY - worldY * zoom;
	}

	function handleCanvasPointerDown(event: PointerEvent) {
		if (event.button !== 0 && event.button !== 1) {
			return;
		}

		canvasElement?.focus();

		closeContextMenu();

		const canvasPoint = getCanvasPointFromPointerEvent(event);

		// Pan should always active on middle click, even if space toggle is off
		const shouldPan = event.button === 1 || panToggleOnSpace;

		if (shouldPan) {
			isPanning = true;
			panStartMouseX = event.clientX;
			panStartMouseY = event.clientY;
			panStartX = panX;
			panStartY = panY;
			return;
		}

		clearSelection();

		selectionBoxState = {
			active: true,
			startCanvasX: canvasPoint.x,
			startCanvasY: canvasPoint.y,
			currentCanvasX: canvasPoint.x,
			currentCanvasY: canvasPoint.y,
			additive: isSelectionModifierEvent(event)
		};

		isPanning = false;
	}

	function handleCardPointerDown(event: PointerEvent, card: ConceptCardView) {
		if (event.button !== 0) {
			return;
		}

		const target = event.target as HTMLElement;

		if (target.closest('input, button, [role="button"], .concept-child-tile')) {
			return;
		}

		event.stopPropagation();

		activeInstanceId = card.instance.id;
		closeContextMenu();

		handleCardSelectionPointerDown(event, card);

		pendingDragState = {
			active: true,
			instanceId: card.instance.id,
			startMouseX: event.clientX,
			startMouseY: event.clientY,
			startInstanceX: card.instance.x,
			startInstanceY: card.instance.y,
			draggedCards: getCardsForDragStart(card)
		};
	}

	function getCardsForDragStart(card: ConceptCardView) {
		const shouldDragSelection = selectedInstanceIds.has(card.instance.id);

		const cardsToDrag = shouldDragSelection
			? visibleCards.filter((visibleCard) => selectedInstanceIds.has(visibleCard.instance.id))
			: [card];

		return cardsToDrag.map((dragCard) => ({
			instanceId: dragCard.instance.id,
			startX: dragCard.instance.x,
			startY: dragCard.instance.y
		}));
	}

	function handleCardContextMenu(event: MouseEvent, card: ConceptCardView) {
		event.preventDefault();
		event.stopPropagation();

		if (!selectedInstanceIds.has(card.instance.id)) {
			selectOnlyInstance(card.instance.id);
		} else {
			activeInstanceId = card.instance.id;
		}

		contextMenu = {
			visible: true,
			x: event.clientX,
			y: event.clientY,
			targetType: 'card',
			instanceId: card.instance.id
		};
	}

	function handleResizePointerDown(event: PointerEvent, card: ConceptCardView) {
		if (event.button !== 0) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		closeContextMenu();

		activeInstanceId = card.instance.id;

		resizeState = {
			active: true,
			instanceId: card.instance.id,
			startMouseX: event.clientX,
			startMouseY: event.clientY,
			startWidth: card.instance.width,
			startHeight: card.instance.height
		};
	}

	function handleWindowPointerMove(event: PointerEvent) {
		if (childTileDragState.active) {
			childTileDragState.mouseX = event.clientX;
			childTileDragState.mouseY = event.clientY;
			return;
		}

		if (selectionBoxState.active) {
			const canvasPoint = getCanvasPointFromPointerEvent(event);

			selectionBoxState.currentCanvasX = canvasPoint.x;
			selectionBoxState.currentCanvasY = canvasPoint.y;

			updateMarqueePreviewSelection();

			return;
		}

		if (pendingDragState.active && !dragState.active) {
			const dx = event.clientX - pendingDragState.startMouseX;
			const dy = event.clientY - pendingDragState.startMouseY;
			const distance = Math.hypot(dx, dy);

			if (distance < 4) {
				return;
			}

			dragState = {
				active: true,
				instanceId: pendingDragState.instanceId,
				startMouseX: pendingDragState.startMouseX,
				startMouseY: pendingDragState.startMouseY,
				startInstanceX: pendingDragState.startInstanceX,
				startInstanceY: pendingDragState.startInstanceY,
				draggedCards: pendingDragState.draggedCards
			};
		}

		if (resizeState.active) {
			const dx = (event.clientX - resizeState.startMouseX) / zoom;
			const dy = (event.clientY - resizeState.startMouseY) / zoom;

			const card = cards.find((item) => item.instance.id === resizeState.instanceId);

			if (!card) {
				return;
			}

			const minWidth = getTitleSizedConceptWidth(card.concept.title);
			const minHeight = conceptSizePresets.small.height;

			card.instance.width = Math.max(minWidth, resizeState.startWidth + dx);
			card.instance.height = Math.max(minHeight, resizeState.startHeight + dy);

			return;
		}

		if (dragState.active) {
			const dx = (event.clientX - dragState.startMouseX) / zoom;
			const dy = (event.clientY - dragState.startMouseY) / zoom;

			for (const draggedCard of dragState.draggedCards) {
				const card = cards.find((item) => item.instance.id === draggedCard.instanceId);

				if (!card) {
					continue;
				}

				card.instance.x = draggedCard.startX + dx;
				card.instance.y = draggedCard.startY + dy;
			}

			return;
		}

		if (isPanning) {
			const dx = event.clientX - panStartMouseX;
			const dy = event.clientY - panStartMouseY;

			panX = panStartX + dx;
			panY = panStartY + dy;
		}
	}

	async function handleWindowPointerUp(event: PointerEvent) {
		if (childTileDragState.active) {
			const childCard = childTileDragState.childCard;

			const elementUnderPointer = document.elementFromPoint(event.clientX, event.clientY);

			const tagTarget = elementUnderPointer?.closest<HTMLElement>('.concept-tags-preview');
			const targetTagInstanceId =
				tagTarget?.closest<HTMLElement>('.concept-card')?.dataset.cardInstanceId ?? null;

			const dropTarget = elementUnderPointer?.closest<HTMLElement>('.concept-drop-area');
			const targetParentInstanceId = dropTarget?.dataset.instanceId ?? null;

			const canvas = document.querySelector<HTMLElement>('.canvas');
			const rect = canvas?.getBoundingClientRect();

			childTileDragState = {
				active: false,
				childCard: null,
				mouseX: 0,
				mouseY: 0
			};

			if (!childCard) {
				return;
			}

			if (targetTagInstanceId) {
				const targetCard = cards.find((card) => card.instance.id === targetTagInstanceId);

				if (!targetCard) {
					return;
				}

				await tagConceptWithConcept(targetCard, childCard.concept);

				return;
			}

			if (targetParentInstanceId) {
				if (targetParentInstanceId === childCard.instance.id) {
					return;
				}

				const targetAlreadyContainsConcept = cards.some(
					(item) =>
						item.instance.parentInstanceId === targetParentInstanceId &&
						item.instance.conceptId === childCard.instance.conceptId &&
						item.instance.id !== childCard.instance.id
				);

				if (targetAlreadyContainsConcept) {
					return;
				}

				childCard.instance.parentInstanceId = targetParentInstanceId;

				await updateInstance(childCard.instance.id, {
					parentInstanceId: targetParentInstanceId
				});

				return;
			}

			if (!rect) {
				return;
			}

			const mouseCanvasX = event.clientX - rect.left;
			const mouseCanvasY = event.clientY - rect.top;

			const mouseWorldX = (mouseCanvasX - panX) / zoom;
			const mouseWorldY = (mouseCanvasY - panY) / zoom;

			await updateInstance(childCard.instance.id, {
				parentInstanceId: currentCanvasInstanceId,
				x: mouseWorldX,
				y: mouseWorldY
			});

			return;
		}

		if (selectionBoxState.active) {
			const dx = selectionBoxState.currentCanvasX - selectionBoxState.startCanvasX;
			const dy = selectionBoxState.currentCanvasY - selectionBoxState.startCanvasY;
			const distance = Math.hypot(dx, dy);

			if (distance >= selectionDragThresholdPx) {
				applyMarqueeSelection();
			} else if (!selectionBoxState.additive) {
				clearSelection();
			}

			selectionBoxState = emptySelectionBoxState();
			clearMarqueePreviewSelection();
			return;
		}

		if (pendingDragState.active && !dragState.active) {
			pendingDragState = {
				active: false,
				instanceId: null,
				startMouseX: 0,
				startMouseY: 0,
				startInstanceX: 0,
				startInstanceY: 0,
				draggedCards: []
			};

			return;
		}

		if (resizeState.active) {
			const card = cards.find((item) => item.instance.id === resizeState.instanceId);

			resizeState = {
				active: false,
				instanceId: null,
				startMouseX: 0,
				startMouseY: 0,
				startWidth: 0,
				startHeight: 0
			};

			if (card) {
				await updateInstance(card.instance.id, {
					width: card.instance.width,
					height: card.instance.height
				});
			}

			return;
		}

		if (dragState.active) {
			const draggedInstanceIds = dragState.draggedCards.map(
				(draggedCard) => draggedCard.instanceId
			);

			const draggedCards = draggedInstanceIds
				.map((instanceId) => cards.find((item) => item.instance.id === instanceId))
				.filter((card): card is ConceptCardView => Boolean(card));

			const primaryCard = cards.find((item) => item.instance.id === dragState.instanceId);

			const elementUnderPointer = document.elementFromPoint(event.clientX, event.clientY);

			const tagTarget = elementUnderPointer?.closest<HTMLElement>('.concept-tags-preview');
			const targetTagInstanceId =
				tagTarget?.closest<HTMLElement>('.concept-card')?.dataset.cardInstanceId ?? null;

			const dropTarget = elementUnderPointer?.closest<HTMLElement>('.concept-drop-area');

			const targetParentInstanceId = dropTarget?.dataset.instanceId ?? null;

			dragState = emptyDragState();
			pendingDragState = emptyPendingDragState();

			if (!primaryCard || draggedCards.length === 0) {
				return;
			}

			if (targetTagInstanceId) {
				const targetCard = cards.find((card) => card.instance.id === targetTagInstanceId);

				if (!targetCard) {
					return;
				}

				for (const draggedCard of draggedCards) {
					await tagConceptWithConcept(targetCard, draggedCard.concept);
				}

				return;
			}

			if (targetParentInstanceId && !draggedInstanceIds.includes(targetParentInstanceId)) {
				const updates: {
					id: string;
					updates: Partial<Omit<ConceptInstance, 'id' | 'conceptId'>>;
				}[] = [];

				const conceptIdsAlreadyInTarget = new Set(
					cards
						.filter(
							(item) =>
								item.instance.parentInstanceId === targetParentInstanceId &&
								!draggedInstanceIds.includes(item.instance.id)
						)
						.map((item) => item.instance.conceptId)
				);

				for (const card of draggedCards) {
					if (conceptIdsAlreadyInTarget.has(card.instance.conceptId)) {
						continue;
					}

					conceptIdsAlreadyInTarget.add(card.instance.conceptId);
					card.instance.parentInstanceId = targetParentInstanceId;

					updates.push({
						id: card.instance.id,
						updates: {
							parentInstanceId: targetParentInstanceId,
							x: card.instance.x,
							y: card.instance.y
						}
					});
				}

				await updateInstancesBatch(updates);
				return;
			}

			await updateInstancesBatch(
				draggedCards.map((card) => ({
					id: card.instance.id,
					updates: {
						x: card.instance.x,
						y: card.instance.y
					}
				}))
			);

			return;
		}

		isPanning = false;
	}

	async function updateInstancesBatch(
		updates: {
			id: string;
			updates: Partial<Omit<ConceptInstance, 'id' | 'conceptId'>>;
		}[]
	) {
		if (updates.length === 0) {
			return;
		}

		const response = await fetch('/api/concept-instances/batch', {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ updates })
		});

		if (!response.ok) {
			console.error('Failed to batch update concept instances');
			return;
		}

		await invalidateAll();
	}

	async function handleWindowKeydown(event: KeyboardEvent) {
		if (event.code === 'Escape') {
			closeContextMenu();
			return;
		}

		if (event.code === 'Space') {
			if (!panToggleOnSpace) {
				panToggleOnSpace = true;
				return;
			} else {
				panToggleOnSpace = false;
				return;
			}
		}

		if (event.code !== 'Enter') {
			return;
		}

		if (isInteractiveElement(document.activeElement)) {
			return;
		}

		const isDoubleEnter = consumeDoubleEnter(`canvas:${currentCanvasInstanceId ?? 'root'}`);

		if (!isDoubleEnter) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		const center = getCenterOfCurrentCanvasView();

		const position = {
			x: center.x,
			y: center.y
		};
		await createConcept({
			position
		});
	}

	async function handleConceptTitleKeydown(event: KeyboardEvent, card: ConceptCardView) {
		const input = event.currentTarget as HTMLInputElement;

		if (event.key === 'Enter') {
			event.preventDefault();

			const isDoubleEnter = consumeDoubleEnter(`title:${card.instance.id}`);

			await commitTitleEdit(card, input.value);

			if (isDoubleEnter) {
				const nextconceptPositionAfterCard = getNextConceptPositionAfterCard(card);

				const position = {
					x: nextconceptPositionAfterCard.x,
					y: nextconceptPositionAfterCard.y
				};

				await createConcept({
					position
				});
			}

			return;
		}

		if (event.key === 'Escape') {
			input.value = card.concept.title;
			input.blur();
		}
	}

	async function handleConceptTitleBlur(event: FocusEvent, card: ConceptCardView) {
		const input = event.currentTarget as HTMLInputElement;

		await commitTitleEdit(card, input.value);
	}

	async function handlePropertiesChange(card: ConceptCardView, properties: Record<string, string>) {
		card.concept.properties = properties;

		await updateConcept(card.concept.id, {
			properties
		});
	}

	function openCanvasForCard(card: ConceptCardView) {
		dragState = {
			active: false,
			instanceId: null,
			startMouseX: 0,
			startMouseY: 0,
			startInstanceX: 0,
			startInstanceY: 0,
			draggedCards: []
		};

		resizeState = {
			active: false,
			instanceId: null,
			startMouseX: 0,
			startMouseY: 0,
			startWidth: 0,
			startHeight: 0
		};

		isPanning = false;
		currentCanvasInstanceId = card.instance.id;
		activeInstanceId = null;
		clearSelection();
		closeContextMenu();
	}

	function goToRootCanvas() {
		currentCanvasInstanceId = null;
		activeInstanceId = null;
		clearSelection();
		closeContextMenu();
	}

	function goToCanvas(instanceId: string) {
		currentCanvasInstanceId = instanceId;
		activeInstanceId = null;
		clearSelection();
		closeContextMenu();
	}

	function goUpOneLevel() {
		if (currentCanvasInstanceId === null) {
			return;
		}

		const currentCard = getCardByInstanceId(currentCanvasInstanceId);

		currentCanvasInstanceId = currentCard?.instance.parentInstanceId ?? null;
		activeInstanceId = null;
		clearSelection();
		closeContextMenu();
	}
</script>

<svelte:window
	onclick={closeContextMenu}
	onkeydown={handleWindowKeydown}
	onpointermove={handleWindowPointerMove}
	onpointerup={handleWindowPointerUp}
/>

<section class="concept-workspace">
	<CanvasTopbar
		{currentBreadcrumb}
		{currentCanvasCard}
		{currentCanvasInstanceId}
		{mainView}
		onGoToRootCanvas={goToRootCanvas}
		onGoToCanvas={goToCanvas}
		onGoUpOneLevel={goUpOneLevel}
		onMainViewChange={setMainView}
		onFocus={focusSelectionOrNearestCard}
		onFrameAll={frameVisibleCards}
		onArrangeGrid={arrangeVisibleCardsInGrid}
	/>

	<div class="concept-workspace-body">
		<ConceptSidebar
			{sidebarTab}
			{currentCanvasCard}
			{sidebarNewTag}
			{getTagConcepts}
			onSidebarTabChange={(tab) => {
				sidebarTab = tab;
			}}
			onTitleKeydown={handleConceptTitleKeydown}
			onTitleBlur={handleConceptTitleBlur}
			onSidebarNewTagChange={(value) => {
				sidebarNewTag = value;
			}}
			onSidebarTagAdd={addSidebarTag}
			onTagOpen={openTagCanvas}
			onTagRemove={handleTagRemove}
		/>

		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<section
			bind:this={canvasElement}
			class="canvas"
			class:is-panning={isPanning}
			role="application"
			aria-label="Concept canvas"
			tabindex="0"
			onwheel={handleCanvasWheel}
		>
			{#if mainView === 'canvas'}
				{#if childTileDragState.active}
					<div
						class="child-tile-drag-ghost"
						style={`left: ${childTileDragState.mouseX}px; top: ${childTileDragState.mouseY}px;`}
					>
						<div class="child-tile-drag-ghost-title">
							{childTileDragState.childCard.concept.title ||
								childTileDragState.childCard.concept.id}
						</div>
					</div>
				{/if}

				<div
					class="canvas-background"
					ondblclick={handleCanvasDoubleClick}
					oncontextmenu={handleCanvasContextMenu}
					onpointerdown={handleCanvasPointerDown}
					onpaste={handleCanvasPaste}
				></div>

				{#if selectionBoxState.active}
					{@const selectionCanvasRect = getSelectionBoxCanvasRect()}

					{#if selectionCanvasRect}
						<CanvasSelectionBox rect={selectionCanvasRect} />
					{/if}
				{/if}

				<div
					class="canvas-world"
					style={`transform: translate(${panX}px, ${panY}px) scale(${zoom});`}
					class:is-arranging-camera={arrangingCamera}
				>
					{#each visibleCards as card (card.instance.id)}
						<ConceptCard
							{card}
							childCards={getChildCards(card.instance.id)}
							isActive={activeInstanceId === card.instance.id}
							isDragging={(dragState.active &&
								dragState.draggedCards.some(
									(draggedCard) => draggedCard.instanceId === card.instance.id
								)) ||
								(resizeState.active && resizeState.instanceId === card.instance.id)}
							isSelected={selectedInstanceIds.has(card.instance.id)}
							isMarqueePreviewed={marqueePreviewInstanceIds.has(card.instance.id)}
							isArranging={arrangingCards}
							shouldFocusTitle={pendingFocusInstanceId === card.instance.id}
							onTitleFocused={() => {
								if (pendingFocusInstanceId === card.instance.id) {
									pendingFocusInstanceId = null;
								}
							}}
							onChildOpen={openCanvasForCard}
							onOverflowOpen={openCanvasForCard}
							onChildDragStart={handleChildTileDragStart}
							onPointerDown={handleCardPointerDown}
							onContextMenu={handleCardContextMenu}
							onTitleBlur={handleConceptTitleBlur}
							onTitleKeydown={handleConceptTitleKeydown}
							onPropertiesChange={handlePropertiesChange}
							onResizePointerDown={handleResizePointerDown}
							onCardOpen={openCanvasForCard}
							tagConcepts={getTagConcepts(card.concept.tagConceptIds ?? [])}
							onManualTagAdd={handleManualTagAdd}
							onTagOpen={openTagCanvas}
							onTagRemove={handleTagRemove}
						/>
					{/each}
				</div>
			{:else}
				<div class="table-placeholder">
					<h2>Table View</h2>
					<p>
						Table view will render here later. For now, switching to Table also forces the sidebar
						to Tree.
					</p>
				</div>
			{/if}

			{#if pasteConfirmation.visible}
				<PasteImportConfirmation
					itemsCount={pasteConfirmation.items.length}
					targetConceptName={pasteConfirmation.targetConceptName}
					onConfirm={confirmPasteImport}
					onCancel={cancelPasteImport}
				/>
			{/if}
			<CanvasContextMenu
				{contextMenu}
				{importChildrenMenu}
				importOptions={importChildrenOptions}
				onCreateConceptFromMenu={createConceptFromMenu}
				onGoToCanvas={goToCanvas}
				onCloseContextMenu={closeContextMenu}
				onOpenImportChildrenMenu={openImportChildrenMenu}
				onDeleteInstanceFromMenu={deleteInstanceFromMenu}
				onImportChildrenFromSource={importChildrenFromSource}
			/>
			<div class="zoom-indicator">
				{Math.round(zoom * 100)}%
			</div>
		</section>
	</div>
</section>

<style>
	.child-tile-drag-ghost {
		position: fixed;
		z-index: 2000;
		width: var(--child-tile-size-drag);
		height: var(--child-tile-size-drag);
		transform: translate(-50%, -50%);
		pointer-events: none;

		display: flex;
		align-items: center;
		justify-content: center;

		padding: 0.75rem;
		border-radius: var(--child-tile-radius);
		border: 1px solid var(--child-tile-border-drag);
		background: var(--child-tile-bg-drag);
		color: var(--child-tile-text);
		box-shadow: var(--child-tile-shadow);

		user-select: none;
		box-sizing: border-box;
	}

	.child-tile-drag-ghost-title {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 8;

		max-width: 100%;
		max-height: 100%;

		overflow: hidden;
		text-overflow: ellipsis;

		font-size: var(--child-tile-drag-font-size);
		font-weight: var(--child-tile-drag-font-weight);
		line-height: var(--child-tile-line-height);
		text-align: center;

		white-space: normal;
		overflow-wrap: normal;
		word-break: normal;
	}

	.concept-workspace {
		height: 100vh;
		width: 100vw;
		display: grid;
		grid-template-rows: 44px minmax(0, 1fr);

		overflow: hidden;
		background: hsl(224 8% 12%);
		color: hsl(0 0% 96%);
	}

	.concept-workspace-body {
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(260px, 25vw) minmax(0, 1fr);
		overflow: hidden;
	}

	.canvas {
		position: relative;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		background: var(--canvas-background-color);
		touch-action: none;
	}

	.canvas-background {
		position: absolute;
		inset: 0;
		z-index: 0;
	}

	.canvas-world {
		position: absolute;
		left: 0;
		top: 0;
		z-index: 1;
		transform-origin: 0 0;
	}

	.zoom-indicator {
		position: absolute;
		right: 0.75rem;
		bottom: 0.75rem;
		z-index: 20;
		padding: 0.25rem 0.45rem;
		border-radius: 6px;
		background: hsl(0 0% 0% / 45%);
		color: white;
		font-size: 0.75rem;
		pointer-events: none;
	}

	.canvas-world.is-arranging-camera {
	transition: transform 4000ms ease;
}
</style>

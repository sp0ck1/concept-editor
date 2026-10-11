<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import ConceptCard from '$lib/components/editor/card/ConceptCard.svelte';
	import CanvasContextMenu from '$lib/components/editor/canvas/CanvasContextMenu.svelte';
	import CanvasTopbar from '$lib/components/editor/canvas/CanvasTopbar.svelte';
	import ConceptSidebar from '$lib/components/editor/sidebar/ConceptSidebar.svelte';

	import type { ConceptInstance } from '$lib/model/ConceptInstance';
	import type { ConceptCardView } from '$lib/model/ConceptCardView';
	import type {
		CanvasCamera,
		ChildTileDragState,
		DragState,
		PendingDragState,
		ResizeState,
		SelectionBoxState
	} from '$lib/components/editor/canvas/CanvasTypes';
	import type { EditorData } from '$lib/components/editor/EditorTypes';
	import { Editor } from '$lib/components/editor/Editor.svelte';
	import { setEditorContext } from '$lib/components/editor/EditorContext';
	import {
		conceptSizePresets,
		chooseBestPackedLayout,
		getImportedConceptSize,
		getNextConceptPositionAfterCard,
		getTitleSizedConceptWidth
	} from '$lib/components/editor/canvas/layout';
	import {
		clamp,
		getCardCenter,
		getCardsWorldBounds,
		getCardWorldRect,
		normalizeRectangle,
		getRectangleOverlapRatio,
		type Rectangle
	} from '$lib/components/editor/canvas/geometry';

	import { lineParser, type ParsedConceptInput } from '$lib/parsers';
	import PasteImportConfirmation from '$lib/components/editor/canvas/PasteImportConfirmation.svelte';
	import CanvasSelectionBox from '$lib/components/editor/canvas/CanvasSelectionBox.svelte';
	import { updateConceptInstanceRecord } from '$lib/client/conceptInstances';
	import { SvelteSet } from 'svelte/reactivity';

	// let Declarations

	let { data } = $props<{ data: EditorData }>();

	const editor = untrack(() => new Editor(data));
	setEditorContext(editor);

	$effect(() => {
		const concepts = data.concepts;
		const instances = data.instances;
		const relationships = data.relationships;
		const relationshipDefinitions = data.relationshipDefinitions;

		untrack(() => {
			editor.replaceData({ concepts, instances, relationships, relationshipDefinitions });
		});
	});

	let sidebarElement = $state<HTMLElement | null>(null);
	let sidebarWidth = $state<number | null>(null);
	let isResizingSidebar = $state(false);

	let sidebarResizeStartX = 0;
	let sidebarResizeStartWidth = 0;

	const minSidebarWidth = 180;
	const minCanvasWidth = 240;

	let canvasElement = $state<HTMLElement | null>(null);
	let marqueePreviewInstanceIds = $state<Set<string>>(new Set());
	let sidebarNewTag = $state('');
	let arrangingCards = $state(false);

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

	let lastEnterPress = $state<{
		targetId: string | null;
		time: number;
	}>({
		targetId: null,
		time: 0
	});


	let childTileDragState = $state<ChildTileDragState>({
		active: false,
		childCard: null,
		mouseX: 0,
		mouseY: 0
	});

	const selectionDragThresholdPx = 4;
	const selectionOverlapThreshold = 0.25;

	const minZoom = 0.1;
	const maxZoom = 5;
	const doubleEnterWindowMs = 450;

	const arrangeAnimationMs = 4000;
	const cardDragThresholdPx = 4;

	// Refactor eventually. No reason to have both. Should be dragState = {active: false ...}
	function resetDragState() {
		dragState = emptyDragState();
	}

	function resetResizeState() {
		resizeState = emptyResizeState();
	}

	function handleSidebarResizePointerDown(event: PointerEvent) {
		if (event.button !== 0 || !sidebarElement) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		const handle = event.currentTarget as HTMLElement;

		handle.setPointerCapture(event.pointerId);

		isResizingSidebar = true;
		sidebarResizeStartX = event.clientX;
		sidebarResizeStartWidth = sidebarElement.getBoundingClientRect().width;
	}

	function handleSidebarResizePointerMove(event: PointerEvent) {
		if (!isResizingSidebar || !sidebarElement) {
			return;
		}

		const workspaceWidth =
			sidebarElement.parentElement?.getBoundingClientRect().width ?? window.innerWidth;

		const maxSidebarWidth = Math.max(minSidebarWidth, workspaceWidth - minCanvasWidth);

		sidebarWidth = clamp(
			sidebarResizeStartWidth + (event.clientX - sidebarResizeStartX),
			minSidebarWidth,
			maxSidebarWidth
		);
	}

	function handleSidebarResizePointerUp(event: PointerEvent) {
		if (!isResizingSidebar) {
			return;
		}

		const handle = event.currentTarget as HTMLElement;

		if (handle.hasPointerCapture(event.pointerId)) {
			handle.releasePointerCapture(event.pointerId);
		}

		isResizingSidebar = false;
	}

	function getCurrentCamera(): CanvasCamera {
		return {
			panX,
			panY,
			zoom
		};
	}

	function applyCamera(camera: CanvasCamera | null) {
		if (!camera) {
			return;
		}

		panX = camera.panX;
		panY = camera.panY;
		zoom = camera.zoom;
	}

	function getSavedCameraForInstance(instance: ConceptInstance): CanvasCamera | null {
		// return CanvasCamera
		return {
			panX: instance.lastCameraPanX ?? 0,
			panY: instance.lastCameraPanY ?? 0,
			zoom: instance.lastCameraZoom ?? 1
		};
	}

	// Returns where the camera will be after the arrangement takes place
	function getCameraForBounds(
		bounds: Rectangle,
		options: {
			padding: number;
			allowZoomIn: boolean;
		}
	) {
		if (!canvasElement) {
			return null;
		}

		const rect = canvasElement.getBoundingClientRect();

		const contentWidth = Math.max(1, bounds.right - bounds.left);
		const contentHeight = Math.max(1, bounds.bottom - bounds.top);

		const availableWidth = rect.width - options.padding * 2;
		const availableHeight = rect.height - options.padding * 2;

		const fitZoom = clamp(
			Math.min(availableWidth / contentWidth, availableHeight / contentHeight),
			minZoom,
			options.allowZoomIn ? maxZoom : zoom
		);

		const centerX = (bounds.left + bounds.right) / 2;
		const centerY = (bounds.top + bounds.bottom) / 2;

		return {
			zoom: fitZoom,
			panX: rect.width / 2 - centerX * fitZoom,
			panY: rect.height / 2 - centerY * fitZoom
		};
	}

	// Saves camera to the ConceptInstance
	async function saveCurrentCanvasCamera() {
		if (editor.currentCanvasOwnerInstanceId === null) {
			return;
		}

		const camera = getCurrentCamera();

		const currentCard = editor.getCardByInstanceId(editor.currentCanvasOwnerInstanceId);

		if (currentCard) {
			currentCard.instance.lastCameraPanX = camera.panX;
			currentCard.instance.lastCameraPanY = camera.panY;
			currentCard.instance.lastCameraZoom = camera.zoom;
		}

		await updateConceptInstanceRecord(editor.currentCanvasOwnerInstanceId, {
			lastCameraPanX: camera.panX,
			lastCameraPanY: camera.panY,
			lastCameraZoom: camera.zoom
		});
	}



	function handleChildTileDragStart(event: PointerEvent, childCard: ConceptCardView) {
		editor.closeContextMenu();

		childTileDragState = {
			active: true,
			childCard,
			mouseX: event.clientX,
			mouseY: event.clientY
		};

		isPanning = false;

		pendingDragState = emptyPendingDragState();
		resetDragState();
		resetResizeState();
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
			editor.currentCanvasOwnerCard?.concept.title || editor.currentCanvasOwnerCard?.concept.id || 'Root';

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

		const start = getViewportCenterWorldPoint();

		const importedSizes = cleanedItems.map((item) => getImportedConceptSize(item.title));
		const maxImportedWidth = Math.max(...importedSizes.map((size) => size.width));
		const maxImportedHeight = Math.max(...importedSizes.map((size) => size.height));

		const gapX = maxImportedWidth + 24;
		const gapY = maxImportedHeight + 24;
		const columns = Math.ceil(Math.sqrt(cleanedItems.length));

		let lastCreatedInstanceId: string | null = null;

		for (const [index, item] of cleanedItems.entries()) {
			const column = index % columns;
			const row = Math.floor(index / columns);
			const size = importedSizes[index];

			const result = await editor.createConcept({
				title: item.title,
				parentInstanceId: editor.currentCanvasOwnerInstanceId,
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
			editor.activeInstanceId = lastCreatedInstanceId;
			editor.pendingFocusInstanceId = null;
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

		await editor.handleManualTagAdd(card, title);
	}


	function nextAnimationFrame() {
		return new Promise<void>((resolve) => {
			requestAnimationFrame(() => resolve());
		});
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
				const card = editor.cards.find((item) => item.instance.id === update.id);

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
			.filter((bounds): bounds is { left: number; top: number; right: number; bottom: number } =>
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

	function frameCardsInCurrentCanvas() {
		if (editor.cardsInCurrentCanvas.length === 0) {
			return;
		}

		applyCamera(
			getCameraForBounds(getCardsWorldBounds(editor.cardsInCurrentCanvas), {
				padding: 6,
				allowZoomIn: true
			})
		);
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
		const futureCamera = futureBounds
			? getCameraForBounds(futureBounds, {
					padding: 6,
					allowZoomIn: true
				})
			: null;

		arrangingCards = true;
		arrangingCamera = true;

		await tick();
		await nextAnimationFrame();

		for (const update of updates) {
			const card = editor.cards.find((item) => item.instance.id === update.id);

			if (!card) {
				continue;
			}

			card.instance.x = update.updates.x;
			card.instance.y = update.updates.y;
		}

		if (futureCamera) {
			applyCamera(futureCamera);
		}

		await tick();

		await new Promise((resolve) => window.setTimeout(resolve, arrangeAnimationMs));

		arrangingCards = false;
		arrangingCamera = false;

		await editor.updateInstancesBatch(updates);
	}

	async function arrangeCardsInCurrentCanvasInGrid() {
		if (editor.cardsInCurrentCanvas.length === 0) {
			return;
		}

		const sortedCards = [...editor.cardsInCurrentCanvas].sort((a, b) => {
			const titleA = a.concept.title || a.concept.id;
			const titleB = b.concept.title || b.concept.id;

			return titleA.localeCompare(titleB);
		});

		const viewportCenter = getViewportCenterWorldPoint();
		const gap = 48;

		const layout = chooseBestPackedLayout(sortedCards, gap, getViewportWorldSize());

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

		frameCardsInCurrentCanvas();
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
		if (editor.selectedInstanceIds.size > 0) {
			const selectedCards = editor.cardsInCurrentCanvas.filter((card) =>
				editor.selectedInstanceIds.has(card.instance.id)
			);

			const bounds = getCardsWorldBounds(selectedCards);

			panToWorldPoint({
				x: (bounds.left + bounds.right) / 2,
				y: (bounds.top + bounds.bottom) / 2
			});

			return;
		}

		const viewportCenter = getViewportCenterWorldPoint();

		const nearestCard = editor.cardsInCurrentCanvas
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


	function getCardsInsideSelectionBox() {
		const selectionWorldRect = getSelectionBoxWorldRect();

		if (!selectionWorldRect) {
			return [];
		}

		return editor.cardsInCurrentCanvas.filter((card) => {
			const overlapRatio = getRectangleOverlapRatio(getCardWorldRect(card), selectionWorldRect);
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
			editor.selectedInstanceIds = new Set([...editor.selectedInstanceIds, ...selectedByBox]);
		} else {
			editor.selectedInstanceIds = new Set(selectedByBox);
		}

		editor.activeInstanceId = selectedByBox[selectedByBox.length - 1] ?? null;
		clearMarqueePreviewSelection();
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

		return normalizeRectangle({
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

		return normalizeRectangle({
			left: startWorld.x,
			top: startWorld.y,
			right: endWorld.x,
			bottom: endWorld.y
		});
	}


	function isSelectionModifierEvent(event: PointerEvent | MouseEvent) {
		return event.ctrlKey || event.metaKey || event.shiftKey;
	}

	function selectOnlyInstance(instanceId: string) {
		editor.selectedInstanceIds = new Set([instanceId]);
		editor.activeInstanceId = instanceId;
	}

	function toggleInstanceSelection(instanceId: string) {
		const nextSelectedInstanceIds = new SvelteSet(editor.selectedInstanceIds);

		if (nextSelectedInstanceIds.has(instanceId)) {
			nextSelectedInstanceIds.delete(instanceId);
		} else {
			nextSelectedInstanceIds.add(instanceId);
		}

		editor.selectedInstanceIds = nextSelectedInstanceIds;
		editor.activeInstanceId = instanceId;
	}

	function clearSelection() {
		editor.selectedInstanceIds = new Set();
		clearMarqueePreviewSelection();
		editor.activeInstanceId = null;
	}

	function handleCardSelectionPointerDown(event: PointerEvent, card: ConceptCardView) {
		if (isSelectionModifierEvent(event)) {
			toggleInstanceSelection(card.instance.id);
			return;
		}

		if (!editor.selectedInstanceIds.has(card.instance.id)) {
			selectOnlyInstance(card.instance.id);
			return;
		}

		editor.activeInstanceId = card.instance.id;
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

	function getWorldPointFromEvent(event: PointerEvent | MouseEvent) {
		return canvasPointToWorldPoint(getCanvasPointFromPointerEvent(event));
	}

	async function handleCanvasDoubleClick(event: MouseEvent) {
		const point = getWorldPointFromEvent(event);

		await editor.createConcept({
			position: {
				x: point.x + Math.round(Math.random() * 200 - 100),
				y: point.y + Math.round(Math.random() * 200 - 100)
			}
		});
	}

	function handleCanvasContextMenu(event: MouseEvent) {
		event.preventDefault();

		const point = getWorldPointFromEvent(event);

		editor.contextMenu = {
			visible: true,
			x: event.clientX,
			y: event.clientY,
			worldX: point.x,
			worldY: point.y,
			targetType: 'canvas',
			instanceId: null
		};
	}


	function emptyDragState(): DragState {
		return {
			active: false,
			instanceId: null,
			startMouseX: 0,
			startMouseY: 0,
			startInstanceX: 0,
			startInstanceY: 0,
			draggedCards: []
		};
	}

	function emptySelectionBoxState(): SelectionBoxState {
		return {
			active: false,
			startCanvasX: 0,
			startCanvasY: 0,
			currentCanvasX: 0,
			currentCanvasY: 0,
			additive: false
		};
	}

	function emptyPendingDragState(): PendingDragState {
		return {
			active: false,
			instanceId: null,
			startMouseX: 0,
			startMouseY: 0,
			startInstanceX: 0,
			startInstanceY: 0,
			draggedCards: []
		};
	}

	function emptyResizeState(): ResizeState {
		return {
			active: false,
			instanceId: null,
			startMouseX: 0,
			startMouseY: 0,
			startWidth: 0,
			startHeight: 0
		};
	}


	function handleCanvasWheel(event: WheelEvent) {
		event.preventDefault();

		const canvasPoint = getCanvasPointFromPointerEvent(event);
		const worldPoint = canvasPointToWorldPoint(canvasPoint);

		const zoomDirection = event.deltaY > 0 ? -1 : 1;
		const zoomFactor = 0.1;
		const nextZoom = clamp(zoom + zoomDirection * zoomFactor, minZoom, maxZoom);

		zoom = nextZoom;

		panX = canvasPoint.x - worldPoint.x * zoom;
		panY = canvasPoint.y - worldPoint.y * zoom;
	}

	function handleCanvasPointerDown(event: PointerEvent) {
		if (event.button !== 0 && event.button !== 1) {
			return;
		}

		canvasElement?.focus();

		editor.closeContextMenu();

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
		console.log(event.button);
		if (event.button === 0) {
			const target = event.target as HTMLElement;

			if (target.closest('input, button, [role="button"], .concept-child-tile')) {
				return;
			}

			event.stopPropagation();

			editor.activeInstanceId = card.instance.id;
			editor.closeContextMenu();

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
		} else {
			if (event.button === 1) {
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
			}
		}
		return;
	}

	function getCardsForDragStart(card: ConceptCardView) {
		const shouldDragSelection = editor.selectedInstanceIds.has(card.instance.id);

		const cardsToDrag = shouldDragSelection
			? editor.cardsInCurrentCanvas.filter((visibleCard) =>
					editor.selectedInstanceIds.has(visibleCard.instance.id)
				)
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

		if (!editor.selectedInstanceIds.has(card.instance.id)) {
			selectOnlyInstance(card.instance.id);
		} else {
			editor.activeInstanceId = card.instance.id;
		}

		editor.contextMenu = {
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

		editor.closeContextMenu();

		editor.activeInstanceId = card.instance.id;

		resizeState = {
			active: true,
			instanceId: card.instance.id,
			startMouseX: event.clientX,
			startMouseY: event.clientY,
			startWidth: card.instance.width,
			startHeight: card.instance.height
		};
	}

	function handleChildTilePointerMove(event: PointerEvent) {
		childTileDragState.mouseX = event.clientX;
		childTileDragState.mouseY = event.clientY;
	}

	function handleSelectionBoxPointerMove(event: PointerEvent) {
		const canvasPoint = getCanvasPointFromPointerEvent(event);

		selectionBoxState.currentCanvasX = canvasPoint.x;
		selectionBoxState.currentCanvasY = canvasPoint.y;

		updateMarqueePreviewSelection();
	}

	function promotePendingDragIfValid(event: PointerEvent) {
		if (!pendingDragState.active || dragState.active) {
			return;
		}

		const instanceId = pendingDragState.instanceId;

		if (instanceId === null) {
			return;
		}

		const dx = event.clientX - pendingDragState.startMouseX;
		const dy = event.clientY - pendingDragState.startMouseY;
		const distance = Math.hypot(dx, dy);

		// 4 is a hard-coded value that could be turned into a constant, but it is already perfect
		if (distance < cardDragThresholdPx) {
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

	function handleCardResizingPointerMove(event: PointerEvent) {
		const dx = (event.clientX - resizeState.startMouseX) / zoom;
		const dy = (event.clientY - resizeState.startMouseY) / zoom;

		const card = editor.cards.find((item) => item.instance.id === resizeState.instanceId);

		if (!card) {
			return;
		}

		const minWidth = getTitleSizedConceptWidth(card.concept.title);
		const minHeight = conceptSizePresets.small.height;

		card.instance.width = Math.max(minWidth, resizeState.startWidth + dx);
		card.instance.height = Math.max(minHeight, resizeState.startHeight + dy);

		return;
	}

	function handleCardDraggingPointerMove(event: PointerEvent) {
		if (dragState.active) {
			const dx = (event.clientX - dragState.startMouseX) / zoom;
			const dy = (event.clientY - dragState.startMouseY) / zoom;

			for (const draggedCard of dragState.draggedCards) {
				const card = editor.cards.find((item) => item.instance.id === draggedCard.instanceId);

				if (!card) {
					continue;
				}

				card.instance.x = draggedCard.startX + dx;
				card.instance.y = draggedCard.startY + dy;
			}

			return;
		}
	}

	function handlePanningPointerMove(event: PointerEvent) {
		const dx = event.clientX - panStartMouseX;
		const dy = event.clientY - panStartMouseY;

		panX = panStartX + dx;
		panY = panStartY + dy;
	}

	// The pointer might be:
	// - Dragging a Child Tile
	// - Drawing a Selection Box
	// - Dragging a Card
	// - Resizing a card
	// - Panning the camera
	function handleWindowPointerMove(event: PointerEvent) {
		if (childTileDragState.active) {
			handleChildTilePointerMove(event);
			return;
		}

		if (selectionBoxState.active) {
			handleSelectionBoxPointerMove(event);
			return;
		}

		if (pendingDragState.active && !dragState.active) {
			promotePendingDragIfValid(event);
			return;
		}

		if (dragState.active) {
			handleCardDraggingPointerMove(event);
			return;
		}

		if (resizeState.active) {
			handleCardResizingPointerMove(event);
			return;
		}

		if (isPanning) {
			handlePanningPointerMove(event);
			return;
		}
	}


	async function finishChildTileDrag(event: PointerEvent) {
		const childCard = childTileDragState.childCard;
		const { targetTagInstanceId, targetParentInstanceId } = getDropTargetAtPoint(
			event.clientX,
			event.clientY
		);

		childTileDragState = emptyChildTileDragState();

		if (!childCard) {
			return;
		}

		if (targetTagInstanceId) {
			const targetCard = editor.getCardByInstanceId(targetTagInstanceId);

			if (!targetCard) {
				return;
			}

			await editor.tagConceptWithConcept(targetCard, childCard.concept);

			return;
		}

		if (targetParentInstanceId) {
			if (
				targetParentInstanceId === childCard.instance.id ||
				editor.isDescendantInstance(targetParentInstanceId, childCard.instance.id)
			) {
				return;
			}

			const targetAlreadyContainsConcept = editor.cards.some(
				(item) =>
					item.instance.parentInstanceId === targetParentInstanceId &&
					item.instance.conceptId === childCard.instance.conceptId &&
					item.instance.id !== childCard.instance.id
			);

			if (targetAlreadyContainsConcept) {
				return;
			}

			childCard.instance.parentInstanceId = targetParentInstanceId;

			await editor.updateInstance(childCard.instance.id, {
				parentInstanceId: targetParentInstanceId
			});

			return;
		}

		if (!canvasElement) {
			return;
		}

		const worldPoint = getWorldPointFromEvent(event);

		if (
			editor.currentCanvasOwnerInstanceId === childCard.instance.id ||
			(editor.currentCanvasOwnerInstanceId !== null &&
				editor.isDescendantInstance(editor.currentCanvasOwnerInstanceId, childCard.instance.id))
		) {
			return;
		}

		childCard.instance.parentInstanceId = editor.currentCanvasOwnerInstanceId;
		childCard.instance.x = worldPoint.x;
		childCard.instance.y = worldPoint.y;

		await editor.updateInstance(childCard.instance.id, {
			parentInstanceId: editor.currentCanvasOwnerInstanceId,
			x: worldPoint.x,
			y: worldPoint.y
		});

		return;
	}

	function finishSelectionBox() {
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

	async function finishResize() {
		if (!resizeState.active || resizeState.instanceId === null) {
			return;
		}

		const card = editor.getCardByInstanceId(resizeState.instanceId);

		resizeState = emptyResizeState();

		if (!card) {
			return;
		}

		await editor.updateInstance(card.instance.id, {
			width: card.instance.width,
			height: card.instance.height
		});
	}

	async function finishCardDrag(event: PointerEvent) {
		const draggedInstanceIds = dragState.draggedCards.map((draggedCard) => draggedCard.instanceId);

		const draggedCards = draggedInstanceIds
			.map((instanceId) => editor.cards.find((item) => item.instance.id === instanceId))
			.filter((card): card is ConceptCardView => Boolean(card));

		const primaryCard = editor.cards.find((item) => item.instance.id === dragState.instanceId);

		const { targetTagInstanceId, targetParentInstanceId } = getDropTargetAtPoint(
			event.clientX,
			event.clientY
		);

		resetDragState();
		pendingDragState = emptyPendingDragState();

		if (!primaryCard || draggedCards.length === 0) {
			return;
		}

		if (targetTagInstanceId) {
			const targetCard = editor.getCardByInstanceId(targetTagInstanceId);
			if (!targetCard) {
				return;
			}

			for (const draggedCard of draggedCards) {
				await editor.tagConceptWithConcept(targetCard, draggedCard.concept);
			}

			return;
		}

		if (targetParentInstanceId && !draggedInstanceIds.includes(targetParentInstanceId)) {
			const updates: {
				id: string;
				updates: Partial<Omit<ConceptInstance, 'id' | 'conceptId'>>;
			}[] = [];

			const conceptIdsAlreadyInTarget = new SvelteSet(
				editor.cards
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

			await editor.updateInstancesBatch(updates);
			return;
		}

		await editor.updateInstancesBatch(
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
	function getDropTargetAtPoint(x: number, y: number) {
		const elementUnderPointer = document.elementFromPoint(x, y);

		const tagTarget = elementUnderPointer?.closest<HTMLElement>('.concept-tags-preview');
		const targetTagInstanceId =
			tagTarget?.closest<HTMLElement>('.concept-card')?.dataset.cardInstanceId ?? null;

		const dropTarget = elementUnderPointer?.closest<HTMLElement>('.concept-drop-area');
		const targetParentInstanceId = dropTarget?.dataset.instanceId ?? null;

		return {
			targetTagInstanceId,
			targetParentInstanceId
		};
	}
	async function handleWindowPointerUp(event: PointerEvent) {
		if (childTileDragState.active) {
			await finishChildTileDrag(event);
			return;
		}

		if (selectionBoxState.active) {
			finishSelectionBox();
			return;
		}

		if (pendingDragState.active && !dragState.active) {
			pendingDragState = emptyPendingDragState();
			return;
		}

		if (resizeState.active) {
			await finishResize();
			return;
		}

		if (dragState.active) {
			await finishCardDrag(event);
			return;
		}

		isPanning = false;
	}


	async function handleWindowKeydown(event: KeyboardEvent) {
		if (event.code === 'Escape') {
			editor.closeContextMenu();
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

		const isDoubleEnter = consumeDoubleEnter(`canvas:${editor.currentCanvasOwnerInstanceId ?? 'root'}`);

		if (!isDoubleEnter) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		const center = getViewportCenterWorldPoint();

		const position = {
			x: center.x,
			y: center.y
		};
		await editor.createConcept({
			position
		});
	}

	async function handleConceptTitleKeydown(event: KeyboardEvent, card: ConceptCardView) {
		const input = event.currentTarget as HTMLInputElement;

		if (event.key === 'Enter') {
			event.preventDefault();

			const isDoubleEnter = consumeDoubleEnter(`title:${card.instance.id}`);

			await editor.commitTitleEdit(card, input.value);

			if (isDoubleEnter) {
				const nextconceptPositionAfterCard = getNextConceptPositionAfterCard(card);

				const position = {
					x: nextconceptPositionAfterCard.x,
					y: nextconceptPositionAfterCard.y
				};

				await editor.createConcept({
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

		await editor.commitTitleEdit(card, input.value);
	}


	function emptyChildTileDragState(): ChildTileDragState {
		return {
			active: false,
			childCard: null,
			mouseX: 0,
			mouseY: 0
		};
	}

	function clearInteractiveState() {
		isPanning = false;
		dragState = emptyDragState();
		pendingDragState = emptyPendingDragState();
		resizeState = emptyResizeState();
		selectionBoxState = emptySelectionBoxState();
		childTileDragState = emptyChildTileDragState();
	}

	async function prepareCanvasNavigation(nextOwnerInstanceId: string | null) {
		clearInteractiveState();
		clearSelection();
		editor.closeContextMenu();

		editor.currentCanvasOwnerInstanceId = nextOwnerInstanceId;
		editor.activeInstanceId = null;

		await tick();
	}
	async function openCardCanvas(card: ConceptCardView) {
		await openInstanceCanvas(card.instance.id);
	}

	// Root canvas should have its own camera positioning, but for now, frame all cards to make it feel like home
	async function openRootCanvas() {
		await saveCurrentCanvasCamera();

		prepareCanvasNavigation(null);

		if (editor.cardsInCurrentCanvas.length > 0) {
			frameCardsInCurrentCanvas();
		} else {
			applyCamera({
				panX: 0,
				panY: 0,
				zoom: 1
			});
		}
	}

	async function openInstanceCanvas(instanceId: string) {
		const targetCard = editor.getCardByInstanceId(instanceId);

		if (!targetCard) {
			return;
		}

		if (instanceId === editor.currentCanvasOwnerInstanceId) {
			return;
		}

		await saveCurrentCanvasCamera();

		clearInteractiveState();

		editor.currentCanvasOwnerInstanceId = instanceId;
		editor.activeInstanceId = null;

		clearSelection();
		editor.closeContextMenu();

		await tick();

		const savedCamera = getSavedCameraForInstance(targetCard.instance);

		if (savedCamera) {
			applyCamera(savedCamera);
		} else if (editor.cardsInCurrentCanvas.length > 0) {
			frameCardsInCurrentCanvas();
		} else {
			applyCamera({
				panX: 0,
				panY: 0,
				zoom: 1
			});
		}
	}

	// Not strictly necessary except for root, but could be nice to have a back button
	async function openInstanceParentCanvas() {
		// Can't do this from root
		if (editor.currentCanvasOwnerInstanceId === null) {
			return;
		}

		const currentCard = editor.getCardByInstanceId(editor.currentCanvasOwnerInstanceId);
		const parentInstanceId = currentCard?.instance.parentInstanceId ?? null;

		if (parentInstanceId === null) {
			await openRootCanvas();
			return;
		}

		await openInstanceCanvas(parentInstanceId);
	}

</script>

<svelte:window
	onclick={() => editor.closeContextMenu()}
	onkeydown={handleWindowKeydown}
	onpointermove={handleWindowPointerMove}
	onpointerup={handleWindowPointerUp}
/>

<section class="concept-workspace">
	<CanvasTopbar
		currentBreadcrumb={editor.currentBreadcrumb}
		currentCanvasOwnerCard={editor.currentCanvasOwnerCard}
		currentCanvasOwnerInstanceId={editor.currentCanvasOwnerInstanceId}
		mainView={editor.mainView}
		onGoToRootCanvas={openRootCanvas}
		onGoToCanvas={openInstanceCanvas}
		onGoUpOneLevel={openInstanceParentCanvas}
		onMainViewChange={(view) => editor.setMainView(view)}
		onFocus={focusSelectionOrNearestCard}
		onFrameAll={frameCardsInCurrentCanvas}
		onArrangeGrid={arrangeCardsInCurrentCanvasInGrid}
	/>

	<div class="concept-workspace-body">
		{#if editor.sidebarVisible}
			<div
				bind:this={sidebarElement}
				class="sidebar-shell"
				style:width={sidebarWidth === null ? undefined : `${sidebarWidth}px`}
			>
				<ConceptSidebar
					sidebarTab={editor.sidebarTab}
					currentCanvasOwnerCard={editor.currentCanvasOwnerCard}
					{sidebarNewTag}
					getTagConcepts={(ids) => editor.getTagConcepts(ids)}
					getConceptChildren={(id) => editor.getConceptChildren(id)}
					getRootConceptInstances={() => editor.getRootConceptInstances()}
					onGoUpOneLevel={openInstanceParentCanvas}
					onSidebarTabChange={(tab) => {
						editor.sidebarTab = tab;
					}}
					onTitleKeydown={handleConceptTitleKeydown}
					onTitleBlur={handleConceptTitleBlur}
					onSidebarNewTagChange={(value) => {
						sidebarNewTag = value;
					}}
					onSidebarTagAdd={addSidebarTag}
					onTagOpen={(concept) => editor.openTagCanvas(concept)}
					onTagRemove={(card, concept) => editor.handleTagRemove(card, concept)}
					onPropertiesChange={(card, properties) => editor.handlePropertiesChange(card, properties)}
					relationships={editor.currentConceptRelationships}
					relationshipDefinitions={editor.relationshipDefinitions}
					getConceptById={(id) => editor.getConceptById(id)}
				/>

				<button
					class="sidebar-resize-handle"
					class:active={isResizingSidebar}
					type="button"
					aria-label="Resize sidebar"
					onpointerdown={handleSidebarResizePointerDown}
					onpointermove={handleSidebarResizePointerMove}
					onpointerup={handleSidebarResizePointerUp}
					onpointercancel={handleSidebarResizePointerUp}
				></button>
			</div>
		{/if}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<section
			bind:this={canvasElement}
			class="canvas"
			class:sidebar-hidden={!editor.sidebarVisible}
			class:is-panning={isPanning}
			role="application"
			aria-label="Concept canvas"
			tabindex="0"
			onwheel={handleCanvasWheel}
		>
			{#if editor.mainView === 'canvas'}
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
					{#each editor.cardsInCurrentCanvas as card (card.instance.id)}
						<ConceptCard
							{card}
							isActive={editor.activeInstanceId === card.instance.id}
							isDragging={(dragState.active &&
								dragState.draggedCards.some(
									(draggedCard) => draggedCard.instanceId === card.instance.id
								)) ||
								(resizeState.active && resizeState.instanceId === card.instance.id)}
							isSelected={editor.selectedInstanceIds.has(card.instance.id)}
							isMarqueePreviewed={marqueePreviewInstanceIds.has(card.instance.id)}
							isArranging={arrangingCards}
							shouldFocusTitle={editor.pendingFocusInstanceId === card.instance.id}
							onTitleFocused={() => {
								if (editor.pendingFocusInstanceId === card.instance.id) {
									editor.pendingFocusInstanceId = null;
								}
							}}
							onChildDragStart={handleChildTileDragStart}
							onPointerDown={handleCardPointerDown}
							onContextMenu={handleCardContextMenu}
							onTitleBlur={handleConceptTitleBlur}
							onTitleKeydown={handleConceptTitleKeydown}
							onResizePointerDown={handleResizePointerDown}
							onCardOpen={openCardCanvas}
							tagConcepts={editor.getTagConcepts(card.concept.tagConceptIds ?? [])}
							onManualTagAdd={(card, title) => editor.handleManualTagAdd(card, title)}
							onTagOpen={(concept) => editor.openTagCanvas(concept)}
							onTagRemove={(card, concept) => editor.handleTagRemove(card, concept)}
							getConceptChildren={(id) => editor.getConceptChildren(id)}
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
				contextMenu={editor.contextMenu}
				importChildrenMenu={editor.importChildrenMenu}
				importOptions={editor.importChildrenOptions}
				onCreateConceptFromMenu={(size) => editor.createConceptFromMenu(size)}
				onGoToCanvas={openInstanceCanvas}
				onCloseContextMenu={() => editor.closeContextMenu()}
				onOpenImportChildrenMenu={() => editor.openImportChildrenMenu()}
				onDeleteInstanceFromMenu={() => editor.deleteInstanceFromMenu()}
				onImportChildrenFromSource={(id) => editor.importChildrenFromSource(id)}
			/>
			<div class="zoom-indicator">
				{Math.round(zoom * 100)}%
			</div>

		</section></div>
</section>

<style>
	.child-tile-drag-ghost {
		position: fixed;
		z-index: var(--maximum-z-index);
		width: fit-content;
		max-width: 500px;
		text-overflow: ellipsis;
		height: var(--child-tile-height);
		transform: translate(-50%, -50%);
		pointer-events: none;

		display: flex;
		align-items: center;
		justify-content: center;

		padding: 0.75rem;
		border-radius: var(--child-tile-radius);
		border: 1px solid var(--child-tile-border-drag);
		background: var(--child-tile-bg);
		color: var(--child-tile-text);
		box-shadow: 2px 2px 1px black;

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
	}

	.concept-workspace-body {
		min-height: 0;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		overflow: hidden;
	}

	.concept-workspace-body.sidebar-hidden {
		grid-template-columns: minmax(0, 1fr);
	}

	.sidebar-shell {
		position: relative;
		display: flex;
		width: max(260px, 25vw);
		min-width: 0;
		min-height: 0;
	}

	.sidebar-shell :global(.concept-sidebar) {
		width: 100%;
		min-width: 0;
		min-height: 0;
	}

	.sidebar-resize-handle {
		position: absolute;
		z-index: 30;
		top: 0;
		right: -3px;
		bottom: 0;
		width: 6px;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: col-resize;
		touch-action: none;
	}

	.sidebar-resize-handle:hover,
	.sidebar-resize-handle.active {
		background: hsl(210 90% 55% / 45%);
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

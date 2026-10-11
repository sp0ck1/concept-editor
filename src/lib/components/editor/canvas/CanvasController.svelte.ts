import { invalidateAll } from '$app/navigation';
import { updateConceptInstanceRecord } from '$lib/client/conceptInstances';
import {
	conceptSizePresets,
	chooseBestPackedLayout,
	getImportedConceptSize,
	getNearbyCardPosition,
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
import type {
	CanvasCamera,
	ChildDragState,
	DragState,
	PendingDragState,
	ResizeState,
	SelectionBoxState
} from '$lib/components/editor/canvas/CanvasTypes';
import type { Editor } from '$lib/components/editor/Editor.svelte';
import type { ConceptInstance } from '$lib/model/ConceptInstance';
import type { ConceptCardView } from '$lib/model/ConceptCardView';
import { lineParser, type ParsedConceptInput } from '$lib/parsers';
import { tick } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';

const selectionDragThresholdPx = 4;
const selectionOverlapThreshold = 0.25;
const minZoom = 0.1;
const maxZoom = 5;
const doubleEnterWindowMs = 450;
const arrangeAnimationMs = 4000;
const cardDragThresholdPx = 4;

export class CanvasController {
	canvasElement = $state<HTMLElement | null>(null);
	marqueePreviewInstanceIds = $state<Set<string>>(new Set());
	arrangingCards = $state(false);
	arrangingCamera = $state(false);

	panX = $state(0);
	panY = $state(0);
	zoom = $state(1);
	isPanning = $state(false);
	panStartMouseX = $state(0);
	panStartMouseY = $state(0);
	panStartX = $state(0);
	panStartY = $state(0);
	panToggleOnSpace = $state(false);

	dragState = $state<DragState>(this.emptyDragState());
	pendingDragState = $state<PendingDragState>(this.emptyPendingDragState());
	resizeState = $state<ResizeState>(this.emptyResizeState());
	selectionBoxState = $state<SelectionBoxState>(this.emptySelectionBoxState());
	childDragState = $state<ChildDragState>(this.emptyChildDragState());

	pasteConfirmation = $state<{
		visible: boolean;
		items: ParsedConceptInput[];
		targetConceptName: string;
	}>({
		visible: false,
		items: [],
		targetConceptName: ''
	});
	lastEnterPress = $state<{ targetId: string | null; time: number }>({
		targetId: null,
		time: 0
	});

	constructor(private editor: Editor) {}

	resetDragState() {
		this.dragState = this.emptyDragState();
	}

	resetResizeState() {
		this.resizeState = this.emptyResizeState();
	}
	getCurrentCamera(): CanvasCamera {
		return {
			panX: this.panX,
			panY: this.panY,
			zoom: this.zoom
		};
	}

	applyCamera(camera: CanvasCamera | null) {
		if (!camera) {
			return;
		}

		this.panX = camera.panX;
		this.panY = camera.panY;
		this.zoom = camera.zoom;
	}

	getSavedCameraForInstance(instance: ConceptInstance): CanvasCamera | null {
		// return CanvasCamera
		return {
			panX: instance.lastCameraPanX ?? 0,
			panY: instance.lastCameraPanY ?? 0,
			zoom: instance.lastCameraZoom ?? 1
		};
	}

	// Returns where the camera will be after the arrangement takes place
	getCameraForBounds(
		bounds: Rectangle,
		options: {
			padding: number;
			allowZoomIn: boolean;
		}
	) {
		if (!this.canvasElement) {
			return null;
		}

		const rect = this.canvasElement.getBoundingClientRect();

		const contentWidth = Math.max(1, bounds.right - bounds.left);
		const contentHeight = Math.max(1, bounds.bottom - bounds.top);

		const availableWidth = rect.width - options.padding * 2;
		const availableHeight = rect.height - options.padding * 2;

		const fitZoom = clamp(
			Math.min(availableWidth / contentWidth, availableHeight / contentHeight),
			minZoom,
			options.allowZoomIn ? maxZoom : this.zoom
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
	async saveCurrentCanvasCamera() {
		if (this.editor.currentCanvasOwnerInstanceId === null) {
			return;
		}

		const camera = this.getCurrentCamera();

		const currentCard = this.editor.getCard(this.editor.currentCanvasOwnerInstanceId);

		if (currentCard) {
			currentCard.instance.lastCameraPanX = camera.panX;
			currentCard.instance.lastCameraPanY = camera.panY;
			currentCard.instance.lastCameraZoom = camera.zoom;
		}

		await updateConceptInstanceRecord(this.editor.currentCanvasOwnerInstanceId, {
			lastCameraPanX: camera.panX,
			lastCameraPanY: camera.panY,
			lastCameraZoom: camera.zoom
		});
	}



	startChildDrag(event: PointerEvent, childCard: ConceptCardView) {
		this.editor.closeContextMenu();

		this.childDragState = {
			active: true,
			childCard,
			mouseX: event.clientX,
			mouseY: event.clientY
		};

		this.isPanning = false;

		this.pendingDragState = this.emptyPendingDragState();
		this.resetDragState();
		this.resetResizeState();
	}


	async handleCanvasPaste(event: ClipboardEvent) {
		if (this.isInteractiveElement(document.activeElement)) {
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
			this.editor.currentCanvasOwnerCard?.concept.title || this.editor.currentCanvasOwnerCard?.concept.id || 'Root';

		if (result.items.length > 25) {
			this.pasteConfirmation = {
				visible: true,
				items: result.items,
				targetConceptName
			};

			return;
		}

		await this.createConceptsFromParsedItems(result.items);
	}

	async confirmPasteImport() {
		const items = this.pasteConfirmation.items;

		this.pasteConfirmation = {
			visible: false,
			items: [],
			targetConceptName: ''
		};

		await this.createConceptsFromParsedItems(items);
	}

	cancelPasteImport() {
		this.pasteConfirmation = {
			visible: false,
			items: [],
			targetConceptName: ''
		};
	}

	async createConceptsFromParsedItems(items: ParsedConceptInput[]) {
		const cleanedItems = items.filter((item) => item.title.trim());

		if (cleanedItems.length === 0) {
			return;
		}

		const start = this.getViewportCenterWorldPoint();

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

			const result = await this.editor.createConcept({
				title: item.title,
				parentInstanceId: this.editor.currentCanvasOwnerInstanceId,
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
			this.editor.activeInstanceId = lastCreatedInstanceId;
			this.editor.pendingFocusInstanceId = null;
		}

		await invalidateAll();
	}

	nextAnimationFrame() {
		return new Promise<void>((resolve) => {
			requestAnimationFrame(() => resolve());
		});
	}


	getBoundsForInstanceUpdates(
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
				const card = this.editor.cards.find((item) => item.instance.id === update.id);

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

	frameCardsInCurrentCanvas() {
		if (this.editor.cardsInCurrentCanvas.length === 0) {
			return;
		}

		this.applyCamera(
			this.getCameraForBounds(getCardsWorldBounds(this.editor.cardsInCurrentCanvas), {
				padding: 6,
				allowZoomIn: true
			})
		);
	}

	async animateLayoutUpdates(
		updates: {
			id: string;
			updates: {
				x: number;
				y: number;
			};
		}[]
	) {
		const futureBounds = this.getBoundsForInstanceUpdates(updates);
		const futureCamera = futureBounds
			? this.getCameraForBounds(futureBounds, {
					padding: 6,
					allowZoomIn: true
				})
			: null;

		this.arrangingCards = true;
		this.arrangingCamera = true;

		await tick();
		await this.nextAnimationFrame();

		for (const update of updates) {
			const card = this.editor.cards.find((item) => item.instance.id === update.id);

			if (!card) {
				continue;
			}

			card.instance.x = update.updates.x;
			card.instance.y = update.updates.y;
		}

		if (futureCamera) {
			this.applyCamera(futureCamera);
		}

		await tick();

		await new Promise((resolve) => window.setTimeout(resolve, arrangeAnimationMs));

		this.arrangingCards = false;
		this.arrangingCamera = false;

		await this.editor.updateInstancesBatch(updates);
	}

	async arrangeCardsInCurrentCanvasInGrid() {
		if (this.editor.cardsInCurrentCanvas.length === 0) {
			return;
		}

		const sortedCards = [...this.editor.cardsInCurrentCanvas].sort((a, b) => {
			const titleA = a.concept.title || a.concept.id;
			const titleB = b.concept.title || b.concept.id;

			return titleA.localeCompare(titleB);
		});

		const viewportCenter = this.getViewportCenterWorldPoint();
		const gap = 48;

		const layout = chooseBestPackedLayout(sortedCards, gap, this.getViewportWorldSize());

		const layoutLeft = viewportCenter.x - layout.width / 2;
		const layoutTop = viewportCenter.y - layout.height / 2;

		const updates = layout.placements.map((placement) => ({
			id: placement.card.instance.id,
			updates: {
				x: layoutLeft + placement.x,
				y: layoutTop + placement.y
			}
		}));

		await this.animateLayoutUpdates(updates);

		this.frameCardsInCurrentCanvas();
	}

	getViewportCenterWorldPoint() {
		if (!this.canvasElement) {
			return { x: 0, y: 0 };
		}

		const rect = this.canvasElement.getBoundingClientRect();

		return {
			x: (rect.width / 2 - this.panX) / this.zoom,
			y: (rect.height / 2 - this.panY) / this.zoom
		};
	}

	getViewportWorldSize() {
		if (!this.canvasElement) {
			return { width: 0, height: 0 };
		}

		const rect = this.canvasElement.getBoundingClientRect();

		return {
			width: rect.width / this.zoom,
			height: rect.height / this.zoom
		};
	}


	panToWorldPoint(worldPoint: { x: number; y: number }) {
		if (!this.canvasElement) {
			return;
		}

		const rect = this.canvasElement.getBoundingClientRect();

		this.panX = rect.width / 2 - worldPoint.x * this.zoom;
		this.panY = rect.height / 2 - worldPoint.y * this.zoom;
	}

	focusCard(card: ConceptCardView) {
		this.panToWorldPoint(getCardCenter(card));
	}

	focusSelectionOrNearestCard() {
		if (this.editor.selectedInstanceIds.size > 0) {
			const selectedCards = this.editor.cardsInCurrentCanvas.filter((card) =>
				this.editor.selectedInstanceIds.has(card.instance.id)
			);

			const bounds = getCardsWorldBounds(selectedCards);

			this.panToWorldPoint({
				x: (bounds.left + bounds.right) / 2,
				y: (bounds.top + bounds.bottom) / 2
			});

			return;
		}

		const viewportCenter = this.getViewportCenterWorldPoint();

		const nearestCard = this.editor.cardsInCurrentCanvas
			.map((card) => {
				const center = getCardCenter(card);
				const distance = Math.hypot(center.x - viewportCenter.x, center.y - viewportCenter.y);

				return { card, distance };
			})
			.sort((a, b) => a.distance - b.distance)[0]?.card;

		if (nearestCard) {
			this.focusCard(nearestCard);
		}
	}


	getCardsInsideSelectionBox() {
		const selectionWorldRect = this.getSelectionBoxWorldRect();

		if (!selectionWorldRect) {
			return [];
		}

		return this.editor.cardsInCurrentCanvas.filter((card) => {
			const overlapRatio = getRectangleOverlapRatio(getCardWorldRect(card), selectionWorldRect);
			return overlapRatio >= selectionOverlapThreshold;
		});
	}

	updateMarqueePreviewSelection() {
		if (!this.selectionBoxState.active) {
			this.marqueePreviewInstanceIds = new Set();
			return;
		}

		const previewCards = this.getCardsInsideSelectionBox();
		this.marqueePreviewInstanceIds = new Set(previewCards.map((card) => card.instance.id));
	}

	clearMarqueePreviewSelection() {
		this.marqueePreviewInstanceIds = new Set();
	}

	applyMarqueeSelection() {
		const selectedByBox = [...this.marqueePreviewInstanceIds];

		if (this.selectionBoxState.active && this.selectionBoxState.additive) {
			this.editor.selectedInstanceIds = new Set([...this.editor.selectedInstanceIds, ...selectedByBox]);
		} else {
			this.editor.selectedInstanceIds = new Set(selectedByBox);
		}

		this.editor.activeInstanceId = selectedByBox[selectedByBox.length - 1] ?? null;
		this.clearMarqueePreviewSelection();
	}

	canvasPointToWorldPoint(point: { x: number; y: number }) {
		return {
			x: (point.x - this.panX) / this.zoom,
			y: (point.y - this.panY) / this.zoom
		};
	}

	getSelectionBoxCanvasRect() {
		if (!this.selectionBoxState.active) {
			return null;
		}

		return normalizeRectangle({
			left: this.selectionBoxState.startCanvasX,
			top: this.selectionBoxState.startCanvasY,
			right: this.selectionBoxState.currentCanvasX,
			bottom: this.selectionBoxState.currentCanvasY
		});
	}

	getSelectionBoxWorldRect() {
		const canvasRect = this.getSelectionBoxCanvasRect();

		if (!canvasRect) {
			return null;
		}

		const startWorld = this.canvasPointToWorldPoint({
			x: canvasRect.left,
			y: canvasRect.top
		});

		const endWorld = this.canvasPointToWorldPoint({
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


	isSelectionModifierEvent(event: PointerEvent | MouseEvent) {
		return event.ctrlKey || event.metaKey || event.shiftKey;
	}


	handleCardSelectionPointerDown(event: PointerEvent, card: ConceptCardView) {
		if (this.isSelectionModifierEvent(event)) {
			this.editor.toggleInstanceSelection(card.instance.id);
			return;
		}

		if (!this.editor.selectedInstanceIds.has(card.instance.id)) {
			this.editor.selectOnlyInstance(card.instance.id);
			return;
		}

		this.editor.activeInstanceId = card.instance.id;
	}

	isInteractiveElement(element: Element | null) {
		if (!element) {
			return false;
		}

		return Boolean(
			element.closest(
				'input, textarea, button, select, [contenteditable="true"], [role="button"], .concept-child-tile'
			)
		);
	}


	// Every time Enter is pressed this.consumeDoubleEnter is called to check if it was pressed twice
	// i.e., within doubleEnterWindowMs of the last time.
	// This is the only function that assigns a value to this.lastEnterPress.
	// This function DOES NOT check if Enter was pressed. It assumes that is already true.
	consumeDoubleEnter(targetId: string) {
		const now = window.performance.now();

		// Confirm the user pressed Enter twice on the same click focused target
		// and that the second Enter occurred less than doubleEnterWindowMs than the first
		const isDoubleEnter =
			this.lastEnterPress.targetId === targetId && now - this.lastEnterPress.time <= doubleEnterWindowMs;

		this.lastEnterPress = {
			targetId,
			time: now
		};

		return isDoubleEnter;
	}



	getCanvasPointFromPointerEvent(event: PointerEvent | MouseEvent) {
		if (!this.canvasElement) {
			return { x: 0, y: 0 };
		}

		const rect = this.canvasElement.getBoundingClientRect();

		return {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top
		};
	}

	getWorldPointFromEvent(event: PointerEvent | MouseEvent) {
		return this.canvasPointToWorldPoint(this.getCanvasPointFromPointerEvent(event));
	}

	async handleCanvasDoubleClick(event: MouseEvent) {
		const point = this.getWorldPointFromEvent(event);

		await this.editor.createConcept({
			position: {
				x: point.x + Math.round(Math.random() * 200 - 100),
				y: point.y + Math.round(Math.random() * 200 - 100)
			}
		});
	}

	handleCanvasContextMenu(event: MouseEvent) {
		event.preventDefault();

		const point = this.getWorldPointFromEvent(event);

		this.editor.contextMenu = {
			visible: true,
			x: event.clientX,
			y: event.clientY,
			worldX: point.x,
			worldY: point.y,
			targetType: 'canvas',
			instanceId: null
		};
	}


	emptyDragState(): DragState {
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

	emptySelectionBoxState(): SelectionBoxState {
		return {
			active: false,
			startCanvasX: 0,
			startCanvasY: 0,
			currentCanvasX: 0,
			currentCanvasY: 0,
			additive: false
		};
	}

	emptyPendingDragState(): PendingDragState {
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

	emptyResizeState(): ResizeState {
		return {
			active: false,
			instanceId: null,
			startMouseX: 0,
			startMouseY: 0,
			startWidth: 0,
			startHeight: 0
		};
	}


	handleCanvasWheel(event: WheelEvent) {
		event.preventDefault();

		const canvasPoint = this.getCanvasPointFromPointerEvent(event);
		const worldPoint = this.canvasPointToWorldPoint(canvasPoint);

		const zoomDirection = event.deltaY > 0 ? -1 : 1;
		const zoomFactor = 0.1;
		const nextZoom = clamp(this.zoom + zoomDirection * zoomFactor, minZoom, maxZoom);

		this.zoom = nextZoom;

		this.panX = canvasPoint.x - worldPoint.x * this.zoom;
		this.panY = canvasPoint.y - worldPoint.y * this.zoom;
	}

	handleCanvasPointerDown(event: PointerEvent) {
		if (event.button !== 0 && event.button !== 1) {
			return;
		}

		this.canvasElement?.focus();

		this.editor.closeContextMenu();

		const canvasPoint = this.getCanvasPointFromPointerEvent(event);

		// Pan should always active on middle click, even if space toggle is off
		const shouldPan = event.button === 1 || this.panToggleOnSpace;

		if (shouldPan) {
			this.isPanning = true;
			this.panStartMouseX = event.clientX;
			this.panStartMouseY = event.clientY;
			this.panStartX = this.panX;
			this.panStartY = this.panY;
			return;
		}

		this.editor.clearSelection();

		this.selectionBoxState = {
			active: true,
			startCanvasX: canvasPoint.x,
			startCanvasY: canvasPoint.y,
			currentCanvasX: canvasPoint.x,
			currentCanvasY: canvasPoint.y,
			additive: this.isSelectionModifierEvent(event)
		};

		this.isPanning = false;
	}

	handleCardPointerDown(event: PointerEvent, card: ConceptCardView) {
		console.log(event.button);
		if (event.button === 0) {
			const target = event.target as HTMLElement;

			if (target.closest('input, button, [role="button"], .concept-child-tile')) {
				return;
			}

			event.stopPropagation();

			this.editor.activeInstanceId = card.instance.id;
			this.editor.closeContextMenu();

			this.handleCardSelectionPointerDown(event, card);

			this.pendingDragState = {
				active: true,
				instanceId: card.instance.id,
				startMouseX: event.clientX,
				startMouseY: event.clientY,
				startInstanceX: card.instance.x,
				startInstanceY: card.instance.y,
				draggedCards: this.getCardsForDragStart(card)
			};
		} else {
			if (event.button === 1) {
				// Pan should always active on middle click, even if space toggle is off
				const shouldPan = event.button === 1 || this.panToggleOnSpace;

				if (shouldPan) {
					this.isPanning = true;
					this.panStartMouseX = event.clientX;
					this.panStartMouseY = event.clientY;
					this.panStartX = this.panX;
					this.panStartY = this.panY;
					return;
				}
			}
		}
		return;
	}

	getCardsForDragStart(card: ConceptCardView) {
		const shouldDragSelection = this.editor.selectedInstanceIds.has(card.instance.id);

		const cardsToDrag = shouldDragSelection
			? this.editor.cardsInCurrentCanvas.filter((visibleCard) =>
					this.editor.selectedInstanceIds.has(visibleCard.instance.id)
				)
			: [card];

		return cardsToDrag.map((dragCard) => ({
			instanceId: dragCard.instance.id,
			startX: dragCard.instance.x,
			startY: dragCard.instance.y
		}));
	}

	handleCardContextMenu(event: MouseEvent, card: ConceptCardView) {
		event.preventDefault();
		event.stopPropagation();

		if (!this.editor.selectedInstanceIds.has(card.instance.id)) {
			this.editor.selectOnlyInstance(card.instance.id);
		} else {
			this.editor.activeInstanceId = card.instance.id;
		}

		this.editor.contextMenu = {
			visible: true,
			x: event.clientX,
			y: event.clientY,
			targetType: 'card',
			instanceId: card.instance.id
		};
	}

	handleResizePointerDown(event: PointerEvent, card: ConceptCardView) {
		if (event.button !== 0) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		this.editor.closeContextMenu();

		this.editor.activeInstanceId = card.instance.id;

		this.resizeState = {
			active: true,
			instanceId: card.instance.id,
			startMouseX: event.clientX,
			startMouseY: event.clientY,
			startWidth: card.instance.width,
			startHeight: card.instance.height
		};
	}

	handleChildDragPointerMove(event: PointerEvent) {
		this.childDragState.mouseX = event.clientX;
		this.childDragState.mouseY = event.clientY;
	}

	handleSelectionBoxPointerMove(event: PointerEvent) {
		const canvasPoint = this.getCanvasPointFromPointerEvent(event);

		this.selectionBoxState.currentCanvasX = canvasPoint.x;
		this.selectionBoxState.currentCanvasY = canvasPoint.y;

		this.updateMarqueePreviewSelection();
	}

	promotePendingDragIfValid(event: PointerEvent) {
		if (!this.pendingDragState.active || this.dragState.active) {
			return;
		}

		const instanceId = this.pendingDragState.instanceId;

		if (instanceId === null) {
			return;
		}

		const dx = event.clientX - this.pendingDragState.startMouseX;
		const dy = event.clientY - this.pendingDragState.startMouseY;
		const distance = Math.hypot(dx, dy);

		// 4 is a hard-coded value that could be turned into a constant, but it is already perfect
		if (distance < cardDragThresholdPx) {
			return;
		}

		this.dragState = {
			active: true,
			instanceId: this.pendingDragState.instanceId,
			startMouseX: this.pendingDragState.startMouseX,
			startMouseY: this.pendingDragState.startMouseY,
			startInstanceX: this.pendingDragState.startInstanceX,
			startInstanceY: this.pendingDragState.startInstanceY,
			draggedCards: this.pendingDragState.draggedCards
		};
	}

	handleCardResizingPointerMove(event: PointerEvent) {
		const dx = (event.clientX - this.resizeState.startMouseX) / this.zoom;
		const dy = (event.clientY - this.resizeState.startMouseY) / this.zoom;

		const card = this.editor.cards.find((item) => item.instance.id === this.resizeState.instanceId);

		if (!card) {
			return;
		}

		const minWidth = getTitleSizedConceptWidth(card.concept.title);
		const minHeight = conceptSizePresets.small.height;

		card.instance.width = Math.max(minWidth, this.resizeState.startWidth + dx);
		card.instance.height = Math.max(minHeight, this.resizeState.startHeight + dy);

		return;
	}

	handleCardDraggingPointerMove(event: PointerEvent) {
		if (this.dragState.active) {
			const dx = (event.clientX - this.dragState.startMouseX) / this.zoom;
			const dy = (event.clientY - this.dragState.startMouseY) / this.zoom;

			for (const draggedCard of this.dragState.draggedCards) {
				const card = this.editor.cards.find((item) => item.instance.id === draggedCard.instanceId);

				if (!card) {
					continue;
				}

				card.instance.x = draggedCard.startX + dx;
				card.instance.y = draggedCard.startY + dy;
			}

			return;
		}
	}

	handlePanningPointerMove(event: PointerEvent) {
		const dx = event.clientX - this.panStartMouseX;
		const dy = event.clientY - this.panStartMouseY;

		this.panX = this.panStartX + dx;
		this.panY = this.panStartY + dy;
	}

	// The pointer might be:
	// - Dragging a Child Tile
	// - Drawing a Selection Box
	// - Dragging a Card
	// - Resizing a card
	// - Panning the camera
	handleWindowPointerMove(event: PointerEvent) {
		if (this.childDragState.active) {
			this.handleChildDragPointerMove(event);
			return;
		}

		if (this.selectionBoxState.active) {
			this.handleSelectionBoxPointerMove(event);
			return;
		}

		if (this.pendingDragState.active && !this.dragState.active) {
			this.promotePendingDragIfValid(event);
			return;
		}

		if (this.dragState.active) {
			this.handleCardDraggingPointerMove(event);
			return;
		}

		if (this.resizeState.active) {
			this.handleCardResizingPointerMove(event);
			return;
		}

		if (this.isPanning) {
			this.handlePanningPointerMove(event);
			return;
		}
	}


	async finishChildDrag(event: PointerEvent) {
		const childCard = this.childDragState.childCard;
		const { targetTagInstanceId, targetParentInstanceId } = this.getDropTargetAtPoint(
			event.clientX,
			event.clientY
		);

		this.childDragState = this.emptyChildDragState();

		if (!childCard) {
			return;
		}

		if (targetTagInstanceId) {
			const targetCard = this.editor.getCard(targetTagInstanceId);

			if (!targetCard) {
				return;
			}

			await this.editor.tagConceptWithConcept(targetCard, childCard.concept);

			return;
		}

		if (targetParentInstanceId) {
			if (
				targetParentInstanceId === childCard.instance.id ||
				this.editor.isDescendantInstance(targetParentInstanceId, childCard.instance.id)
			) {
				return;
			}

			const targetAlreadyContainsConcept = this.editor.cards.some(
				(item) =>
					item.instance.parentInstanceId === targetParentInstanceId &&
					item.instance.conceptId === childCard.instance.conceptId &&
					item.instance.id !== childCard.instance.id
			);

			if (targetAlreadyContainsConcept) {
				return;
			}

			childCard.instance.parentInstanceId = targetParentInstanceId;

			await this.editor.updateInstance(childCard.instance.id, {
				parentInstanceId: targetParentInstanceId
			});

			return;
		}

		if (!this.canvasElement) {
			return;
		}

		const worldPoint = this.getWorldPointFromEvent(event);

		if (
			this.editor.currentCanvasOwnerInstanceId === childCard.instance.id ||
			(this.editor.currentCanvasOwnerInstanceId !== null &&
				this.editor.isDescendantInstance(this.editor.currentCanvasOwnerInstanceId, childCard.instance.id))
		) {
			return;
		}

		childCard.instance.parentInstanceId = this.editor.currentCanvasOwnerInstanceId;
		childCard.instance.x = worldPoint.x;
		childCard.instance.y = worldPoint.y;

		await this.editor.updateInstance(childCard.instance.id, {
			parentInstanceId: this.editor.currentCanvasOwnerInstanceId,
			x: worldPoint.x,
			y: worldPoint.y
		});

		return;
	}

	finishSelectionBox() {
		const dx = this.selectionBoxState.currentCanvasX - this.selectionBoxState.startCanvasX;
		const dy = this.selectionBoxState.currentCanvasY - this.selectionBoxState.startCanvasY;
		const distance = Math.hypot(dx, dy);

		if (distance >= selectionDragThresholdPx) {
			this.applyMarqueeSelection();
		} else if (!this.selectionBoxState.additive) {
			this.editor.clearSelection();
		}

		this.selectionBoxState = this.emptySelectionBoxState();
		this.clearMarqueePreviewSelection();
		return;
	}

	async finishResize() {
		if (!this.resizeState.active || this.resizeState.instanceId === null) {
			return;
		}

		const card = this.editor.getCard(this.resizeState.instanceId);

		this.resizeState = this.emptyResizeState();

		if (!card) {
			return;
		}

		await this.editor.updateInstance(card.instance.id, {
			width: card.instance.width,
			height: card.instance.height
		});
	}

	async finishCardDrag(event: PointerEvent) {
		const draggedInstanceIds = this.dragState.draggedCards.map((draggedCard) => draggedCard.instanceId);

		const draggedCards = draggedInstanceIds
			.map((instanceId) => this.editor.cards.find((item) => item.instance.id === instanceId))
			.filter((card): card is ConceptCardView => Boolean(card));

		const primaryCard = this.editor.cards.find((item) => item.instance.id === this.dragState.instanceId);

		const { targetTagInstanceId, targetParentInstanceId } = this.getDropTargetAtPoint(
			event.clientX,
			event.clientY
		);

		this.resetDragState();
		this.pendingDragState = this.emptyPendingDragState();

		if (!primaryCard || draggedCards.length === 0) {
			return;
		}

		if (targetTagInstanceId) {
			const targetCard = this.editor.getCard(targetTagInstanceId);
			if (!targetCard) {
				return;
			}

			for (const draggedCard of draggedCards) {
				await this.editor.tagConceptWithConcept(targetCard, draggedCard.concept);
			}

			return;
		}

		if (targetParentInstanceId && !draggedInstanceIds.includes(targetParentInstanceId)) {
			const updates: {
				id: string;
				updates: Partial<Omit<ConceptInstance, 'id' | 'conceptId'>>;
			}[] = [];

			const conceptIdsAlreadyInTarget = new SvelteSet(
				this.editor.cards
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

			await this.editor.updateInstancesBatch(updates);
			return;
		}

		await this.editor.updateInstancesBatch(
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
	getDropTargetAtPoint(x: number, y: number) {
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
	async handleWindowPointerUp(event: PointerEvent) {
		if (this.childDragState.active) {
			await this.finishChildDrag(event);
			return;
		}

		if (this.selectionBoxState.active) {
			this.finishSelectionBox();
			return;
		}

		if (this.pendingDragState.active && !this.dragState.active) {
			this.pendingDragState = this.emptyPendingDragState();
			return;
		}

		if (this.resizeState.active) {
			await this.finishResize();
			return;
		}

		if (this.dragState.active) {
			await this.finishCardDrag(event);
			return;
		}

		this.isPanning = false;
	}


	async handleWindowKeydown(event: KeyboardEvent) {
		if (event.code === 'Escape') {
			this.editor.closeContextMenu();
			return;
		}

		if (event.code === 'Space') {
			if (!this.panToggleOnSpace) {
				this.panToggleOnSpace = true;
				return;
			} else {
				this.panToggleOnSpace = false;
				return;
			}
		}

		if (event.code !== 'Enter') {
			return;
		}

		if (this.isInteractiveElement(document.activeElement)) {
			return;
		}

		const isDoubleEnter = this.consumeDoubleEnter(`canvas:${this.editor.currentCanvasOwnerInstanceId ?? 'root'}`);

		if (!isDoubleEnter) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		const center = this.getViewportCenterWorldPoint();

		const position = {
			x: center.x,
			y: center.y
		};
		await this.editor.createConcept({
			position
		});
	}

	async handleConceptTitleKeydown(event: KeyboardEvent, card: ConceptCardView) {
		const input = event.currentTarget as HTMLInputElement;

		if (event.key === 'Enter') {
			event.preventDefault();

			const isDoubleEnter = this.consumeDoubleEnter(`title:${card.instance.id}`);

			await this.editor.commitTitleEdit(card, input.value);

			if (isDoubleEnter) {
				const nextPosition = getNearbyCardPosition(card);

				const position = {
					x: nextPosition.x,
					y: nextPosition.y
				};

				await this.editor.createConcept({
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

	async handleConceptTitleBlur(event: FocusEvent, card: ConceptCardView) {
		const input = event.currentTarget as HTMLInputElement;

		await this.editor.commitTitleEdit(card, input.value);
	}


	emptyChildDragState(): ChildDragState {
		return {
			active: false,
			childCard: null,
			mouseX: 0,
			mouseY: 0
		};
	}

	clearInteractiveState() {
		this.isPanning = false;
		this.dragState = this.emptyDragState();
		this.pendingDragState = this.emptyPendingDragState();
		this.resizeState = this.emptyResizeState();
		this.selectionBoxState = this.emptySelectionBoxState();
		this.childDragState = this.emptyChildDragState();
	}
}

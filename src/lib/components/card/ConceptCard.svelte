<script lang="ts">
	import ConceptTagsPreview from '$lib/components/ConceptTagsPreview.svelte';
	import type { Concept } from '$lib/types/Concept';
	import type { ConceptCardView } from '$lib/types/ConceptCardView';

	import ConceptDropArea from '$lib/components/card/ConceptDropArea.svelte';

	let {
		card,
		conceptChildren = [],
		isActive = false,
		isDragging = false,
		isSelected = false,
		isArranging = false,
		isMarqueePreviewed = false,
		onPointerDown,
		onContextMenu,
		onTitleBlur,
		onTitleKeydown,
		onPropertiesChange,
		onResizePointerDown,
		onChildOpen,
		onCardOpen,
		onOverflowOpen,
		onChildDragStart,
		shouldFocusTitle = false,
		onTitleFocused,
		tagConcepts = [],
		onManualTagAdd,
		onTagOpen,
		onTagRemove,
		getConceptChildren
	} = $props<{
		card: ConceptCardView;
		conceptChildren?: ConceptCardView[];
		isActive?: boolean;
		isDragging?: boolean;
		isSelected?: boolean;
		isArranging?: boolean;
		isMarqueePreviewed?: boolean;
		shouldFocusTitle?: boolean;
		onTitleFocused?: () => void;
		onPointerDown: (event: PointerEvent, card: ConceptCardView) => void;
		onContextMenu: (event: MouseEvent, card: ConceptCardView) => void;
		onTitleBlur: (event: FocusEvent, card: ConceptCardView) => void;
		onTitleKeydown: (event: KeyboardEvent, card: ConceptCardView) => void;
		onPropertiesChange: (card: ConceptCardView, properties: Record<string, string>) => void;
		onResizePointerDown: (event: PointerEvent, card: ConceptCardView) => void;
		onCardOpen?: (card: ConceptCardView) => void;
		onChildOpen?: (card: ConceptCardView) => void;
		onOverflowOpen?: (card: ConceptCardView) => void;

		onChildDragStart?: (event: PointerEvent, childCard: ConceptCardView) => void;
		tagConcepts?: Concept[];
		onManualTagAdd?: (card: ConceptCardView, title: string) => void;
		onTagOpen?: (tagConcept: Concept) => void;
		onTagRemove?: (card: ConceptCardView, tagConcept: Concept) => void;
		getConceptChildren: (conceptInstanceId: string) => ConceptCardView[];
	}>();

	// Need to export this state and add ConcerCardPreview to ConceptCanvas
	let previewChildCard = $state<ConceptCardView | null>(null);
	let previewX = $state(0);
	let previewY = $state(0);
	let previewPlacement = $state<'top' | 'bottom' | 'right' | 'left'>('top');
	let concept = $derived(card.concept);
	let instance = $derived(card.instance);

	let isCollapsed = $derived(instance.width <= 190 || instance.height <= 80);

	const childTileFontFamily =
		'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

	const childTileModes = [
		{
			name: 'full',
			gap: 6,
			tileHeight: 25,
			paddingInline: 14,
			minWidth: 34,
			//maxWidth: 164,
			font: `600 12px ${childTileFontFamily}`,
			symbol: false
		},
		{
			name: 'compact',
			gap: 5,
			tileHeight: 23,
			paddingInline: 12,
			minWidth: 32,
			maxWidth: 104,
			font: `600 11px ${childTileFontFamily}`,
			symbol: false
		},
		{
			name: 'tight',
			gap: 4,
			tileHeight: 22,
			paddingInline: 10,
			minWidth: 30,
			maxWidth: 68,
			font: `700 10px ${childTileFontFamily}`,
			symbol: false
		},
		{
			name: 'symbol',
			gap: 4,
			tileHeight: 24,
			paddingInline: 0,
			minWidth: 30,
			maxWidth: 30,
			font: `700 11px ${childTileFontFamily}`,
			symbol: true
		}
	] as const;

	type ChildTileModeName = (typeof childTileModes)[number]['name'];
	type ChildTileModeConfig = (typeof childTileModes)[number];

	type ChildTileLayoutTile =
		| {
				type: 'child';
				key: string;
				card: ConceptCardView;
				mode: ChildTileModeName;
				label: string;
				fullTitle: string;
				width: number;
		  }
		| {
				type: 'overflow';
				key: string;
				mode: ChildTileModeName;
				label: string;
				hiddenCount: number;
				width: number;
		  };

	type ChildTileLayout = {
		gap: number;
		tiles: ChildTileLayoutTile[];
	};

	let dropAreaElement = $state<HTMLElement | null>(null);
	let dropAreaWidth = $state(0);
	let dropAreaHeight = $state(0);

	// {#if currentCardLayout}
	let currentCardLayout = $state<'notes' | 'children' | 'tags' | 'properties' | 'drawing'>('children');

	let textMeasureCanvas: HTMLCanvasElement | null = null;
	const textWidthCache = new Map<string, number>();

	$effect(() => {
		const element = dropAreaElement;

		if (!element || typeof ResizeObserver === 'undefined') {
			return;
		}

		const updateDropAreaSize = () => {
			const styles = getComputedStyle(element);
			const horizontalPadding =
				Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
			const verticalPadding =
				Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);

			dropAreaWidth = Math.max(0, element.clientWidth - horizontalPadding);
			dropAreaHeight = Math.max(0, element.clientHeight - verticalPadding);
		};

		updateDropAreaSize();

		const resizeObserver = new ResizeObserver(updateDropAreaSize);
		resizeObserver.observe(element);

		return () => resizeObserver.disconnect();
	});

	let childTileLayout = $derived.by(() =>
		buildChildTileLayout(conceptChildren, dropAreaWidth, dropAreaHeight)
	);

	function buildChildTileLayout(
		children: ConceptCardView[],
		measuredWidth: number,
		measuredHeight: number
	): ChildTileLayout {
		const availableWidth = Math.max(1, Math.floor(measuredWidth || 180));
		const availableHeight = Math.max(1, Math.floor(measuredHeight || 90));

		if (children.length === 0) {
			return { gap: childTileModes[0].gap, tiles: [] };
		}

		for (const mode of childTileModes) {
			const tiles = makeRowAwareChildTiles(children, mode, availableWidth);
			const widths = tiles.map((tile) => tile.width);

			if (doesTileLayoutFit(widths, availableWidth, availableHeight, mode)) {
				return { gap: mode.gap, tiles };
			}
		}

		return buildOverflowChildTileLayout(
			children,
			availableWidth,
			availableHeight,
			childTileModes[childTileModes.length - 1]
		);
	}

function makeRowAwareChildTiles(
	children: ConceptCardView[],
	mode: ChildTileModeConfig,
	availableWidth: number
): ChildTileLayoutTile[] {
	const tiles: ChildTileLayoutTile[] = [];
	let usedRowWidth = 0;

	for (const childCard of children) {
		const fullTitle = getChildTileTitle(childCard);
		const label = mode.symbol ? getChildTileSymbol(fullTitle, childCard.concept.id) : fullTitle;

		const preferredWidth = getPreferredChildTileWidth(label, mode);

		let gapBeforeTile = usedRowWidth === 0 ? 0 : mode.gap;
		let remainingRowWidth = availableWidth - usedRowWidth - gapBeforeTile;

		/**
		 * Important:
		 * If this tile wants more space than remains in the current row,
		 * wrap it BEFORE calculating its final width.
		 *
		 * This prevents a long child tile from being squeezed at the end
		 * of a row when it could have fit better on the next row.
		 */
		if (usedRowWidth > 0 && preferredWidth > remainingRowWidth) {
			usedRowWidth = 0;
			gapBeforeTile = 0;
			remainingRowWidth = availableWidth;
		}

		const width = getRowAwareChildTileWidth(preferredWidth, mode, remainingRowWidth);

		tiles.push({
			type: 'child',
			key: childCard.instance.id,
			card: childCard,
			mode: mode.name,
			label,
			fullTitle,
			width
		});

		usedRowWidth += gapBeforeTile + width;
	}

	return tiles;
}
	function buildOverflowChildTileLayout(
		children: ConceptCardView[],
		availableWidth: number,
		availableHeight: number,
		mode: ChildTileModeConfig
	): ChildTileLayout {
		for (let visibleCount = children.length - 1; visibleCount >= 0; visibleCount -= 1) {
			const hiddenCount = children.length - visibleCount;
			const childTiles = children
				.slice(0, visibleCount)
				.map((childCard) => makeChildTile(childCard, mode));
			const overflowTile = makeOverflowTile(hiddenCount, mode, availableWidth);
			const widths = [...childTiles.map((tile) => tile.width), overflowTile.width];

			if (doesTileLayoutFit(widths, availableWidth, availableHeight, mode) || visibleCount === 0) {
				return { gap: mode.gap, tiles: [...childTiles, overflowTile] };
			}
		}

		return {
			gap: mode.gap,
			tiles: [makeOverflowTile(children.length, mode, availableWidth)]
		};
	}

	function makeChildTile(
	childCard: ConceptCardView,
	mode: ChildTileModeConfig,
	availableWidth = Number.POSITIVE_INFINITY
): ChildTileLayoutTile {
	const fullTitle = getChildTileTitle(childCard);
	const label = mode.symbol ? getChildTileSymbol(fullTitle, childCard.concept.id) : fullTitle;
	const preferredWidth = getPreferredChildTileWidth(label, mode);

	return {
		type: 'child',
		key: childCard.instance.id,
		card: childCard,
		mode: mode.name,
		label,
		fullTitle,
		width: getRowAwareChildTileWidth(preferredWidth, mode, availableWidth)
	};
}

	function makeOverflowTile(
		hiddenCount: number,
		mode: ChildTileModeConfig,
		availableWidth: number
	): ChildTileLayoutTile {
		const longLabel = `+${hiddenCount} more...`;
		const shortLabel = `+${hiddenCount}`;
		const maxOverflowWidth = Math.min(98, availableWidth);
		const label =
			measureTextWidth(longLabel, mode.font) + 14 <= maxOverflowWidth ? longLabel : shortLabel;

		return {
			type: 'overflow',
			key: 'overflow',
			mode: mode.name,
			label,
			hiddenCount,
			width: getOverflowTileWidth(label, mode, availableWidth)
		};
	}

	function getChildTileTitle(childCard: ConceptCardView) {
		return (childCard.concept.title || childCard.concept.id).trim();
	}

	function getChildTileSymbol(title: string, fallback: string) {
		const source = (title || fallback).trim();
		const words = source.match(/[A-Za-z0-9]+/g) ?? [];

		if (words.length >= 2 && words[0]) {
			return `${words[0][0]}${words[1][0]}`.toUpperCase();
		}

		const compact = source.replace(/[^A-Za-z0-9]/g, '');

		if (compact.length === 0) {
			return '??';
		}

		if (compact.length === 1) {
			return compact.toUpperCase();
		}

		return `${compact[0].toUpperCase()}${compact[1].toLowerCase()}`;
	}

function getPreferredChildTileWidth(label: string, mode: ChildTileModeConfig) {
	const measuredWidth = measureTextWidth(label, mode.font) + mode.paddingInline + 2;
	const clampedToMinWidth = Math.max(mode.minWidth, measuredWidth);

	if ('maxWidth' in mode) {
		return Math.min(mode.maxWidth, clampedToMinWidth);
	}

	return clampedToMinWidth;
}

function getRowAwareChildTileWidth(
	preferredWidth: number,
	mode: ChildTileModeConfig,
	remainingRowWidth: number
) {
	const safeRemainingRowWidth = Math.max(mode.minWidth, remainingRowWidth);
	return Math.ceil(Math.min(preferredWidth, safeRemainingRowWidth));
}

	function getOverflowTileWidth(label: string, mode: ChildTileModeConfig, availableWidth: number) {
		const measuredWidth = measureTextWidth(label, mode.font) + 14;
		const maxWidth = Math.min(98, availableWidth);
		const minWidth = Math.min(44, maxWidth);

		return Math.ceil(Math.max(minWidth, Math.min(maxWidth, measuredWidth)));
	}

	function measureTextWidth(text: string, font: string) {
		const cacheKey = `${font}\n${text}`;
		const cachedWidth = textWidthCache.get(cacheKey);

		if (cachedWidth !== undefined) {
			return cachedWidth;
		}

		if (typeof document === 'undefined') {
			return text.length * 8;
		}

		textMeasureCanvas ??= document.createElement('canvas');
		const context = textMeasureCanvas.getContext('2d');

		if (!context) {
			return text.length * 8;
		}

		context.font = font;

		const width = context.measureText(text).width;
		textWidthCache.set(cacheKey, width);
		return width;
	}

	function doesTileLayoutFit(
		widths: number[],
		availableWidth: number,
		availableHeight: number,
		mode: ChildTileModeConfig
	) {
		return getWrappedTileHeight(widths, availableWidth, mode) <= availableHeight;
	}

	function getWrappedTileHeight(
		widths: number[],
		availableWidth: number,
		mode: ChildTileModeConfig
	) {
		if (widths.length === 0) {
			return 0;
		}

		let rowCount = 1;
		let rowWidth = 0;

		for (const width of widths) {
			const safeWidth = Math.min(width, availableWidth);

			if (rowWidth === 0) {
				rowWidth = safeWidth;
				continue;
			}

			if (rowWidth + mode.gap + safeWidth <= availableWidth) {
				rowWidth += mode.gap + safeWidth;
			} else {
				rowCount += 1;
				rowWidth = safeWidth;
			}
		}

		return rowCount * mode.tileHeight + (rowCount - 1) * mode.gap;
	}

		function handleChildTilePointerDown(event: PointerEvent, childCard: ConceptCardView) {
		if (event.button !== 0) {
			return;
		}

		event.stopPropagation();

		pendingChildDragCard = childCard;

		childTileHoldTimer = setTimeout(() => {
			childTileHoldTimer = null;

			if (!pendingChildDragCard) {
				return;
			}

			event.preventDefault();
			onChildDragStart?.(event, pendingChildDragCard);
			pendingChildDragCard = null;
		}, childTileHoldDelayMs);
	}

	function cancelChildTileHold() {
		if (childTileHoldTimer) {
			clearTimeout(childTileHoldTimer);
			childTileHoldTimer = null;
		}

		pendingChildDragCard = null;
	}

	function showChildPreview(event: MouseEvent, childCard: ConceptCardView) {
		const tile = event.currentTarget as HTMLElement;
		const cardElement = tile.closest<HTMLElement>('.concept-card');

		if (!cardElement) {
			return;
		}

		const tileRect = tile.getBoundingClientRect();
		const cardRect = cardElement.getBoundingClientRect();

		previewChildCard = childCard;

		const previewWidth = 260;
		const previewHeight = 180;
		const gap = 8;

		const tileCenterX = tileRect.left + tileRect.width / 2;
		const tileCenterY = tileRect.top + tileRect.height / 2;

		const wouldFitAbove = tileRect.top >= previewHeight + gap;
		const wouldFitBelow = window.innerHeight - tileRect.bottom >= previewHeight + gap;
		const wouldFitRight = window.innerWidth - tileRect.right >= previewWidth + gap;

		if (wouldFitAbove) {
			previewPlacement = 'top';
			previewX = tileCenterX - cardRect.left;
			previewY = tileRect.top - cardRect.top - gap;
		} else if (wouldFitBelow) {
			previewPlacement = 'bottom';
			previewX = tileCenterX - cardRect.left;
			previewY = tileRect.bottom - cardRect.top + gap;
		} else if (wouldFitRight) {
			previewPlacement = 'right';
			previewX = tileRect.right - cardRect.left + gap;
			previewY = tileCenterY - cardRect.top;
		} else {
			previewPlacement = 'left';
			previewX = tileRect.left - cardRect.left - gap;
			previewY = tileCenterY - cardRect.top;
		}
	}

		function hideChildPreview() {
		previewChildCard = null;
	}



	let titleInput = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (!shouldFocusTitle || !titleInput) {
			return;
		}

		titleInput.focus();
		titleInput.select();
		onTitleFocused?.();
	});

	function getRenderedCardWidth() {
	if (instance.sizePreset !== 'small') {
		return instance.width;
	}

	const title = (concept.title || 'Untitled Concept').trim();
	const approximateCharacterWidth = 9;
	const horizontalPadding = 32;
	const resizeHandleAllowance = 28;

	return Math.min(
		900,
		Math.max(120, title.length * approximateCharacterWidth + horizontalPadding + resizeHandleAllowance)
	);
}

	const childTileHoldDelayMs = 300;

	let childTileHoldTimer: ReturnType<typeof setTimeout> | null = null;
	let pendingChildDragCard: ConceptCardView | null = null;

</script>

<article
	class="concept-card"
	class:is-active={isActive}
	class:is-dragging={isDragging}
	class:is-selected={isSelected}
	class:is-arranging={isArranging}
	class:is-marquee-previewed={isMarqueePreviewed}
	class:is-collapsed={isCollapsed}
	data-card-instance-id={instance.id}
	style={`
		transform: translate(${instance.x}px, ${instance.y}px);
		width: ${instance.width}px;
		height: ${instance.height}px;
	`}
	
	aria-label={concept.title || 'Untitled concept'}
	onpointerdown={(event) => onPointerDown(event, card)}
	oncontextmenu={(event) => onContextMenu(event, card)}
>
	<input
		bind:this={titleInput}
		class="concept-title-input"
		value={concept.title}
		aria-label="Concept title"
		onkeydown={(event) => onTitleKeydown(event, card)}
		onblur={(event) => onTitleBlur(event, card)}
		ondblclick={(event) => event.stopPropagation()}
	/>

	{#if !isCollapsed}
		<div class="concept-body">
		<!-- {#if !isSidebarCollapsed Add to toggle sidebar off and on--> 
			
		
			<div class="card-sidebar">
	
				<ConceptTagsPreview
					tags={tagConcepts}
					onManualTagAdd={(title) => onManualTagAdd?.(card, title)}
					{onTagOpen}
					onTagRemove={(tagConcept) => onTagRemove?.(card, tagConcept)}
				/>

				<div class="card-sidebar-overlay" style="width:30px; height:max-content; background-color: red;">
			</div>
</div>
			{#if previewChildCard}
				<div
					class={`concept-child-preview concept-child-preview-${previewPlacement}`}
					style={`left: ${previewX}px; top: ${previewY}px;`}
				>
					<div class="concept-child-preview-title">
						{previewChildCard.concept.title || previewChildCard.concept.id}
					</div>

					<div class="concept-child-preview-properties">
						{#each Object.entries(previewChildCard.concept.properties ?? {}) as [name, value]}
							<div class="concept-child-preview-property">
								<strong>{name}</strong>
								<span>{value}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

<ConceptDropArea
	{card}
	{getConceptChildren}
	bind:dropAreaElement
	{onCardOpen}
/>
		</div>
	{/if}

	<button
		class="concept-resize-handle"
		type="button"
		aria-label="Resize concept"
		onpointerdown={(event) => onResizePointerDown(event, card)}
	></button>
</article>

<style>
	

	/* Card Related */

	.concept-card {
		position: absolute;
		container-type: size;
		display: flex;
		flex-direction: column;
		
		min-height: 48px;
		background: white;
		border: 1px solid #d0d0d0;
		border-radius: 2.5px;
	transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.2s ease;
		box-shadow: 1px 1px 1px rgba(0, 0, 0, 0.314);
		overflow: hidden;
		pointer-events: auto;
		cursor: grab;
		user-select: none;
		z-index: 1;
		border-bottom-right-radius: 0px;
		border-top-left-radius: 0px;

	}

	
	
	.concept-title-input {
		width: 100%;
		min-width: 0;
		min-height: 40px;
		max-height: 120px;
		padding: 8px 12px;
		box-sizing: border-box;
		flex: 0 0 auto;
		border: 0;
		
		background: transparent;
		font: inherit;
		font-weight: 600;
		outline: none;
		cursor: text;
		user-select: text;
	}

	.concept-card.is-collapsed {
		justify-content: center;
		align-items: center;
	}

	.concept-card.is-collapsed:hover {
		background:var(--is-collapsed-bg-hover);
	}

	.concept-card.is-collapsed .concept-title-input {
		flex: 0 0 auto;
		min-height: 0;
		height: auto;
		max-width: calc(100% - 28px);
		padding: 4px 6px;
		min-width: 2ch;
		text-align: center;
		background: white;
	}

	.concept-resize-handle {
		position: absolute;
  		right: 1px;
  		bottom: 1px;
  		width: 14px;
  		height: 14px;
  		border: 0;
		background: #D4E2EF;
  		cursor: nwse-resize;
  box-shadow: 
   /* 1px 1px 0px 0px #000,     /* Outer black outline */
    inset 1px 1px 0px 0px #fff, /* Top/Left highlight */
    inset -0.5px -0.5px 0px 0px #808080; /* Bottom/Right inner shadow */
	}

	.concept-body {
		flex: 1 1 auto;
		min-width: 0;
		min-height: 0;
		display: grid;
		grid-template-columns: 9rem minmax(0, 1fr);
		gap: 0;
		border-top: 1px solid #e5e5e5;
		overflow: hidden;
	}

	.card-left-panel {
		min-width: 0;
		overflow: hidden;
	}

	.concept-properties-preview {
		min-width: 0;
		width: 100%;
		max-width: 100%;
		box-sizing: border-box;
		padding: 6px;
		border-right: 0;
		overflow: hidden;
	}

	.concept-property-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 4px;
		width: 100%;
		max-width: 100%;
		margin-bottom: 4px;
	}

	.concept-property-key,
	.concept-property-value {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
		overflow: hidden;
		text-overflow: ellipsis;
	}


	.concept-card.is-marquee-previewed {
		border-color: var(--marquee-preview-border-color);
		box-shadow: var(--marquee-preview-box-shadow);
			
	}

	.concept-card.is-selected.is-marquee-previewed {
		border-color: var(--selection-box-border-color);

	}



	.concept-card.is-active {
		z-index: 10;
	}

	.concept-card.is-selected {
		transition: all 100ms ease;
		/* SHOULD SCALE WITH ZOOM, WITH A MAXIMUM */
		box-shadow: var(--selection-box-box-shadow);
	}

	.concept-card.is-active.is-selected {
		z-index: 15;
	}

	.concept-card.is-dragging {
		z-index: 20;
		cursor: grabbing;
		pointer-events: none;
		box-shadow: var(--is-dragging-box-shadow);
		border-color: hsla(210, 90%, 50%, 0);
		transition: all cubic-bezier(0.55, 0.055) 100ms;
		

	}

	/* will not affect dragging cards */
	.concept-card.is-arranging:not(.is-dragging) {
	transition: transform 4000ms ease-in 1.5s;
	
}


</style>

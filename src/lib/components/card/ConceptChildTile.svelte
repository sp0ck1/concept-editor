<script lang="ts">
	import type { ConceptCardView } from '$lib/types/ConceptCardView';

	type ChildTileModeName = 'full' | 'compact' | 'tight' | 'symbol';

	type ConceptChildTileData = {
		type: 'child';
		key: string;
		card: ConceptCardView;
		mode: ChildTileModeName;
		label: string;
		fullTitle: string;
		width: number;
	};

	let {
		tile,
		isDragging = false,
		onPointerDown,
		onHoldCancel,
		onPreviewShow,
		onPreviewHide,
		onOpen
	} = $props<{
		tile: ConceptChildTileData;
		onPointerDown: (event: PointerEvent, childCard: ConceptCardView) => void;
		onHoldCancel: () => void;
		onPreviewShow: (event: MouseEvent, childCard: ConceptCardView) => void;
		onPreviewHide: () => void;
		onOpen?: (childCard: ConceptCardView) => void;
		isDragging?: boolean;
	}>();

	function openTile(event: MouseEvent | KeyboardEvent) {
		event.preventDefault();
		event.stopPropagation();
		onHoldCancel();
		onPreviewHide();
		onOpen?.(tile.card);
	}

	function handleKeyboardOpen(event: KeyboardEvent) {
		if (event.key !== 'Enter' && event.key !== ' ') {
			return;
		}

		openTile(event);
	}


</script>

<div
	class={`concept-child-tile concept-child-tile-${tile.mode}`}
	class:is-dragging={isDragging}
	style={`--child-tile-width: ${tile.width}px;`}
	role="button"
	tabindex="0"
	title={tile.fullTitle}
	aria-label={tile.fullTitle}
	onpointerdown={(event) => onPointerDown(event, tile.card)}
	onpointerup={onHoldCancel}
	onpointercancel={onHoldCancel}
	onmouseenter={(event) => onPreviewShow(event, tile.card)}
	onmouseleave={onPreviewHide}
	ondblclick={openTile}
	onkeydown={handleKeyboardOpen}
	
>
	<div class="concept-child-tile-title">{tile.label}</div>
</div>

<style>
	.concept-child-tile {
		flex: 0 0 var(--child-tile-width);
		width: var(--child-tile-width);
		min-width: 0;
		min-height: 0;

		display: flex;
		align-items: center;
		justify-content: center;

		border-radius: var(--child-tile-radius-small);
		border: 1px solid var(--child-tile-border);
		background: var(--child-tile-bg);
		color: var(--child-tile-text);

		cursor: grab;
		user-select: none;
		box-sizing: border-box;
		overflow: hidden;
	}

	.concept-child-tile:active {
		cursor: grabbing;
	}

	.concept-child-tile:hover,
	.concept-child-tile:focus {
		filter: brightness(1.08);
		outline: none;
	}

	.concept-child-tile-full {
		height: 25px;
		padding-inline: 6px;
	}

	.concept-child-tile-compact {
		height: 23px;
		padding-inline: 5px;
	}

	.concept-child-tile-tight {
		height: 22px;
		padding-inline: 4px;
	}

	.concept-child-tile-symbol {
		height: 24px;
		padding-inline: 0;
		border-radius: 4px;
	}

	.concept-child-tile-title {
		min-width: 0;
		max-width: 100%;

		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;

		font-size: var(--child-tile-font-size);
		font-weight: var(--child-tile-font-weight);
		line-height: var(--child-tile-line-height);
		text-align: center;
	}

	.concept-child-tile-compact .concept-child-tile-title {
		font-size: 0.6875rem;
	}

	.concept-child-tile-tight .concept-child-tile-title {
		font-size: 0.625rem;
		font-weight: 700;
	}

	.concept-child-tile-symbol .concept-child-tile-title {
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.02em;
	}

</style>
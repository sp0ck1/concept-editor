<script lang="ts">
	import type { ConceptCardView } from '$lib/types/ConceptCardView';
    import ConceptChildTile from '$lib/components/card/ConceptChildTile.svelte';

	type ChildTileModeName = 'full' | 'compact' | 'tight' | 'symbol';

	type ConceptDropAreaTile =
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

	type ConceptDropAreaLayout = {
		gap: number;
		tiles: ConceptDropAreaTile[];
	};

	let {
		card,
		childCardsCount,
		childTileLayout,
		dropAreaElement = $bindable<HTMLElement | null>(null),
		onCardOpen,
		onOverflowOpen,
		onChildOpen,
		onChildPointerDown,
		onChildTileHoldCancel,
		onChildPreviewShow,
		onChildPreviewHide
	} = $props<{
		card: ConceptCardView;
		childCardsCount: number;
		childTileLayout: ConceptDropAreaLayout;
		dropAreaElement?: HTMLElement | null;
		onCardOpen?: (card: ConceptCardView) => void;
		onOverflowOpen?: (card: ConceptCardView) => void;
		onChildOpen?: (card: ConceptCardView) => void;
		onChildPointerDown: (event: PointerEvent, childCard: ConceptCardView) => void;
		onChildTileHoldCancel: () => void;
		onChildPreviewShow: (event: MouseEvent, childCard: ConceptCardView) => void;
		onChildPreviewHide: () => void;
	}>();

	let concept = $derived(card.concept);
	let instance = $derived(card.instance);

	function openCardFromDropArea(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		onChildTileHoldCancel();
		onChildPreviewHide();
		onCardOpen?.(card);
	}

	function openOverflow(event: MouseEvent | KeyboardEvent) {
		event.preventDefault();
		event.stopPropagation();
		onChildTileHoldCancel();
		onChildPreviewHide();
		onOverflowOpen?.(card);
	}

	function handleKeyboardOpen(event: KeyboardEvent, open: () => void) {
		if (event.key !== 'Enter' && event.key !== ' ') {
			return;
		}

		open();
	}

   
</script>

<div
	bind:this={dropAreaElement}
	class="concept-drop-area"
	data-instance-id={instance.id}
	data-concept-id={concept.id}
	aria-label="Child concept area"
	ondblclick={openCardFromDropArea}
>
	{#if childCardsCount === 0}
		<div class="concept-drop-empty">Drop children here</div>
	{:else}
		<div class="concept-child-list" style={`--child-tile-gap: ${childTileLayout.gap}px;`}>
			{#each childTileLayout.tiles as tile (tile.key)}
				{#if tile.type === 'overflow'}
					<div
	class={`concept-child-overflow concept-child-overflow-${tile.mode}`}
	style={`--child-tile-width: ${tile.width}px;`}
	role="button"
	tabindex="0"
	title="See all child concepts"
	aria-label={`See ${tile.hiddenCount} hidden child concepts`}
	ondblclick={(event) => openOverflow(event)}
	onkeydown={(event) => handleKeyboardOpen(event, () => openOverflow(event))}
>
	<div class="concept-child-tile-title">{tile.label}</div>
</div>
				{:else}
					<ConceptChildTile
	{tile}
	onPointerDown={onChildPointerDown}
	onHoldCancel={onChildTileHoldCancel}
	onPreviewShow={onChildPreviewShow}
	onPreviewHide={onChildPreviewHide}
	onOpen={onChildOpen}
/>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<style>


	.concept-drop-area {
		min-width: 0;
		min-height: 0;
		position: relative;
		padding: 8px;
		box-sizing: border-box;
		overflow: hidden;
		background-color: #deefff;
		box-shadow:
			inset 2px 2px 4px rgba(0, 0, 0, 0.2),
			inset -2px -2px 4px rgba(208, 208, 208, 0.761);
	}

	.concept-drop-empty {
		height: 100%;
		box-sizing: border-box;
		display: grid;
		place-items: center;
		border: 1px dashed #d0d0d0;
		border-radius: 8px;
		color: #3c3c3c;
		font-size: clamp(10px, 4cqw, 13px);
		user-select: none;
	}

	.concept-child-list {
		display: flex;
		flex-wrap: wrap;
		align-content: flex-start;
		align-items: flex-start;
		gap: var(--child-tile-gap, 6px);
		height: 100%;
		overflow: hidden;
	}

	/* Only needed because overflow is still rendered here */
	.concept-child-overflow {
		flex: 0 0 var(--child-tile-width);
		width: var(--child-tile-width);
		min-width: 0;
		min-height: 0;

		display: flex;
		align-items: center;
		justify-content: center;

		height: 24px;
		padding-inline: 6px;
		border-radius: var(--child-tile-radius-small);
		border: 1px solid var(--child-tile-border);

		cursor: default;
		user-select: none;
		box-sizing: border-box;
		overflow: hidden;

		color: hsl(224 8% 88%);
		background: hsl(224 8% 32%);
	}

	.concept-child-overflow:hover,
	.concept-child-overflow:focus {
		filter: brightness(1.08);
		outline: none;
	}

	.concept-child-overflow .concept-child-tile-title {
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



    </style>

<script lang="ts">
	import ConceptTagsPreview from '$lib/components/ConceptTagsPreview.svelte';
	import type { Concept } from '$lib/model/Concept';
	import type { ConceptCardView } from '$lib/model/ConceptCardView';

	import ConceptDropArea from '$lib/components/card/ConceptDropArea.svelte';

	let {
		card,
		isActive = false,
		isDragging = false,
		isSelected = false,
		isArranging = false,
		isMarqueePreviewed = false,
		onPointerDown,
		onContextMenu,
		onTitleBlur,
		onTitleKeydown,
		onResizePointerDown,
		onCardOpen,
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
		onResizePointerDown: (event: PointerEvent, card: ConceptCardView) => void;
		onCardOpen?: (card: ConceptCardView) => void;
		onChildDragStart?: (event: PointerEvent, childCard: ConceptCardView) => void;
		tagConcepts?: Concept[];
		onManualTagAdd?: (card: ConceptCardView, title: string) => void;
		onTagOpen?: (tagConcept: Concept) => void;
		onTagRemove?: (card: ConceptCardView, tagConcept: Concept) => void;
		getConceptChildren: (conceptInstanceId: string) => ConceptCardView[];
	}>();

	let concept = $derived(card.concept);
	let instance = $derived(card.instance);

	let isCollapsed = $derived(instance.width <= 190 || instance.height <= 80);


	function handleChildTilePointerDown(event: PointerEvent, childCard: ConceptCardView) {
		if (event.button !== 0) {
			return;
		}

		const target = event.target;

		if (target instanceof Element && target.closest('button, input, textarea, select')) {
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


	let titleInput = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (!shouldFocusTitle || !titleInput) {
			return;
		}

		titleInput.focus();
		titleInput.select();
		onTitleFocused?.();
	});


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

<ConceptDropArea
	{card}
	{getConceptChildren}
	{onCardOpen}
	onChildPointerDown={handleChildTilePointerDown}
	onChildPointerUp={cancelChildTileHold}
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

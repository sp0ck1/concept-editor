<script lang="ts">
	import TreeView from '$lib/components/tree/TreeView.svelte';
	import type { ConceptCardView } from '$lib/types/ConceptCardView';

	let {
		card,
		getConceptChildren,
		dropAreaElement = $bindable<HTMLElement | null>(null),
		onCardOpen
	} = $props<{
		card: ConceptCardView;
		getConceptChildren: (conceptInstanceId: string) => ConceptCardView[];
		dropAreaElement?: HTMLElement | null;
		onCardOpen?: (card: ConceptCardView) => void;
	}>();

	let concept = $derived(card.concept);
	let instance = $derived(card.instance);

	let conceptChildren = $derived.by(() =>
		getConceptChildren(instance.id)
	);

	function openCardFromDropArea(event: MouseEvent) {
		const target = event.target;

		/*
		 * Do not open the parent card when the user double-clicks
		 * an actual tree row or expansion button.
		 */
		if (
			target instanceof Element &&
			target.closest('.tree-root-row, .tree-node-row')
		) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		onCardOpen?.(card);
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
	{#if conceptChildren.length === 0}
		<div class="concept-drop-empty">
			Drop children here
		</div>
	{:else}
		<TreeView
			rootCard={card}
			{getConceptChildren}
		/>
	{/if}
</div>

<style>
	.concept-drop-area {
		min-width: 0;
		min-height: 0;
		position: relative;
		padding: 8px;
		box-sizing: border-box;
		overflow: auto;
		background-color: #deefff;
		box-shadow:
			inset 2px 2px 4px rgba(0, 0, 0, 0.2),
			inset -2px -2px 4px rgba(208, 208, 208, 0.761);

		/*
		 * Tree colors for the light card background.
		 * These can be consumed by TreeView and TreeViewNode.
		 */
		--tree-text-color: #202124;
		--tree-root-text-color: #151515;
		--tree-muted-color: #60646c;
		--tree-line-color: rgba(0, 0, 0, 0.2);
		--tree-row-hover-background: rgba(0, 0, 0, 0.07);
		--tree-toggle-background: rgba(255, 255, 255, 0.65);
		--tree-toggle-hover-background: rgba(255, 255, 255, 0.95);
		--tree-toggle-border-color: rgba(0, 0, 0, 0.38);
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

	.concept-drop-area :global(.tree-view) {
	color: #202124;
	font-size: 0.75rem;
}

.concept-drop-area :global(.tree-root-label),
.concept-drop-area :global(.tree-node-label) {
	color: #202124;
}

.concept-drop-area :global(.tree-toggle) {
	border-color: rgba(0, 0, 0, 0.35);
	background: rgba(255, 255, 255, 0.65);
	color: #202124;
}

.concept-drop-area :global(.tree-toggle:hover) {
	background: rgba(255, 255, 255, 0.95);
}

.concept-drop-area :global(.tree-root-children),
.concept-drop-area :global(.tree-node-children) {
	border-left-color: rgba(0, 0, 0, 0.2);
}

.concept-drop-area :global(.tree-node-row:hover) {
	background: rgba(0, 0, 0, 0.07);
}

</style>
<script lang="ts">
	import TreeViewNode from './TreeViewNode.svelte';
	import type { ConceptCardView } from '$lib/types/ConceptCardView';
    import TreeView from '$lib/components/tree/TreeView.svelte';

	let {
		card,
		getConceptChildren,
		level
	} = $props<{
		card: ConceptCardView;
		getConceptChildren: (
			conceptInstanceId: string
		) => ConceptCardView[];
		level: number;
	}>();

	let expanded = $state(false);

	let children = $derived(
		getConceptChildren(card.instance.id)
	);

	let hasChildren = $derived(children.length > 0);

	let displayTitle = $derived(
		card.concept.title || card.concept.id
	);
</script>

<div
	class="tree-node"
	role="treeitem"
	aria-level={level}
	aria-expanded={hasChildren ? expanded : undefined}
	data-instance-id={card.instance.id}
	data-concept-id={card.concept.id}
>
	<div class="tree-node-row">
		{#if hasChildren}
			<button
				class="tree-toggle"
				type="button"
				aria-label={expanded
					? `Collapse ${displayTitle}`
					: `Expand ${displayTitle}`}
				onclick={() => {
					expanded = !expanded;
				}}
			>
				{expanded ? '−' : '+'}
			</button>
		{:else}
			<span
				class="tree-toggle-spacer"
				aria-hidden="true"
			></span>
		{/if}

		<span
			class="tree-node-label"
			title={displayTitle}
		>
			{displayTitle}
		</span>
	</div>

	{#if hasChildren && expanded}
		<div class="tree-node-children" role="group">
			{#each children as child (child.instance.id)}
				<TreeViewNode
					card={child}
					{getConceptChildren}
					level={level + 1}
				/>
			{/each}
		</div>
	{/if}
</div>

<style>
	.tree-node {
		min-width: 0;
	}

	.tree-node-row {
		display: grid;
		grid-template-columns: 18px minmax(0, 1fr);
		align-items: center;
		gap: 0.25rem;
		min-width: 0;
		min-height: 1.65rem;
	}

	.tree-node-row:hover {
		background: hsl(224 8% 18%);
	}

	.tree-toggle,
	.tree-toggle-spacer {
		width: 16px;
		height: 16px;
		box-sizing: border-box;
	}

	.tree-toggle {
		display: grid;
		place-items: center;
		padding: 0;
		border: 1px solid hsl(224 8% 42%);
		border-radius: 2px;
		background: hsl(224 8% 20%);
		color: hsl(0 0% 88%);
		font: inherit;
		font-size: 0.75rem;
		font-weight: 700;
		line-height: 1;
		cursor: pointer;
	}

	.tree-toggle:hover {
		border-color: hsl(224 8% 58%);
		background: hsl(224 8% 27%);
	}

	.tree-toggle:focus-visible {
		outline: 2px solid hsl(210 90% 60%);
		outline-offset: 1px;
	}

	.tree-toggle-spacer {
		display: block;
	}

	.tree-node-label {
		min-width: 0;
		overflow: hidden;
		padding: 0.2rem 0.25rem;
		color: hsl(0 0% 88%);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tree-node-children {
		min-width: 0;
		margin-left: 7px;
		padding-left: 10px;
		border-left: 1px solid hsl(224 8% 32%);
	}



	.tree-view {
	color: var(--tree-text-color, hsl(0 0% 88%));
}

.tree-root-label {
	color: var(--tree-root-text-color, hsl(0 0% 94%));
}

.tree-root-children,
.tree-node-children {
	border-left-color: var(
		--tree-line-color,
		hsl(224 8% 32%)
	);
}

.tree-node-row:hover {
	background: var(
		--tree-row-hover-background,
		hsl(224 8% 18%)
	);
}

.tree-toggle {
	border-color: var(
		--tree-toggle-border-color,
		hsl(224 8% 42%)
	);
	background: var(
		--tree-toggle-background,
		hsl(224 8% 20%)
	);
	color: var(--tree-text-color, hsl(0 0% 88%));
}

.tree-toggle:hover {
	background: var(
		--tree-toggle-hover-background,
		hsl(224 8% 27%)
	);
}
</style>
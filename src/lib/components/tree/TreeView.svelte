<script lang="ts">
	import TreeViewNode from '$lib/components/tree/TreeViewNode.svelte';
	import type { ConceptCardView } from '$lib/types/ConceptCardView';

	let {
		rootCard = null,
		getConceptChildren,
		getRootConceptInstances
	} = $props<{
		rootCard?: ConceptCardView | null;
		getConceptChildren: (
			conceptInstanceId: string
		) => ConceptCardView[];
		getRootConceptInstances?: () => ConceptCardView[];
	}>();

	let rootExpanded = $state(true);

	let rootLabel = $derived(
		rootCard
			? rootCard.concept.title || rootCard.concept.id
			: 'Root'
	);

	let rootConceptInstances = $derived.by(() => {
		if (rootCard) {
			return getConceptChildren(rootCard.instance.id);
		}

		return getRootConceptInstances?.() ?? [];
	});
</script>
<div
	class="tree-view"
	role="tree"
	aria-label={rootCard
		? `${rootLabel} hierarchy`
		: 'Concept hierarchy'}
>
	<div
		class="tree-root"
		role="treeitem"
		aria-level="1"
		aria-expanded={rootExpanded}
		data-instance-id={rootCard?.instance.id}
		data-concept-id={rootCard?.concept.id}
	>
		<div class="tree-root-row">
			<button
				class="tree-toggle"
				type="button"
				aria-label={rootExpanded
					? `Collapse ${rootLabel}`
					: `Expand ${rootLabel}`}
				onclick={() => {
					rootExpanded = !rootExpanded;
				}}
			>
				{rootExpanded ? '−' : '+'}
			</button>

			<span
				class="tree-root-label"
				title={rootLabel}
			>
				{rootLabel}
			</span>
		</div>

		{#if rootExpanded}
			<div class="tree-root-children" role="group">
				{#each rootConceptInstances as childCard (childCard.instance.id)}
					<TreeViewNode
						card={childCard}
						{getConceptChildren}
						level={2}
					/>
				{:else}
					<div class="tree-empty">
						No child concepts.
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.tree-view {
		width: 100%;
		min-width: 0;
		color: hsl(0 0% 88%);
		font-size: 0.8125rem;
		line-height: 1.3;
	}

	.tree-root {
		min-width: 0;
	}

	.tree-root-row {
		display: grid;
		grid-template-columns: 18px minmax(0, 1fr);
		align-items: center;
		gap: 0.25rem;
		min-width: 0;
		min-height: 1.75rem;
	}

	.tree-toggle {
		display: grid;
		place-items: center;
		width: 16px;
		height: 16px;
		box-sizing: border-box;
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

	.tree-root-label {
		min-width: 0;
		overflow: hidden;
		color: hsl(0 0% 94%);
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tree-root-children {
		min-width: 0;
		margin-left: 7px;
		padding-left: 10px;
		border-left: 1px solid hsl(224 8% 32%);
	}

	.tree-empty {
		padding: 0.35rem 0.25rem;
		color: hsl(224 8% 58%);
		font-style: italic;
	}




	/* Check and dedupe this css */
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
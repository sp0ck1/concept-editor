<script lang="ts">
	import { getEditorContext } from '$lib/components/editor/EditorContext';

	const editor = getEditorContext();
</script>

<header class="concept-topbar">
	<nav class="canvas-breadcrumb" aria-label="Canvas breadcrumb">
		<button class="canvas-breadcrumb-item" type="button" onclick={() => editor.openRootCanvas()}
			>Context Name (Root)</button
		>

		{#each editor.currentBreadcrumb as breadcrumbCard (breadcrumbCard.instance.id)}
			<span class="canvas-breadcrumb-separator">&gt;</span>

			<button
				class="canvas-breadcrumb-item"
				type="button"
				onclick={() => editor.openInstanceCanvas(breadcrumbCard.instance.id)}
			>
				{breadcrumbCard.concept.title || breadcrumbCard.concept.id}
			</button>
		{/each}
	</nav>

	<div class="concept-topbar-title">
		{#if editor.currentCanvasOwnerCard}
			{editor.currentCanvasOwnerCard.concept.title || editor.currentCanvasOwnerCard.concept.id}
		{:else}
			Context Name (Placeholder)
		{/if}
	</div>

	<div class="concept-topbar-actions">
		<div class="topbar-button-group" aria-label="Main view">
			<button
				class:active={editor.mainView === 'canvas'}
				type="button"
				onclick={() => editor.setMainView('canvas')}
			>
				Canvas
			</button>

			<button
				class:active={editor.mainView === 'table'}
				type="button"
				onclick={() => editor.setMainView('table')}
			>
				Table
			</button>
		</div>

		<div class="topbar-button-group" aria-label="Canvas navigation">
			<button type="button" onclick={() => editor.canvas.focusSelectionOrNearestCard()}
				>Focus Selected</button
			>
			<button type="button" onclick={() => editor.canvas.frameCardsInCurrentCanvas()}
				>Frame All</button
			>
			<button type="button" onclick={() => editor.canvas.arrangeCardsInCurrentCanvasInGrid()}
				>Grid</button
			>
		</div>
	</div>
</header>

<style>
	.concept-topbar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: center;
		gap: 1rem;
		padding: 0 0.75rem;
		border-bottom: 1px solid hsl(224 8% 24%);
		background: var(--ui-panel-bg-color);
		box-sizing: border-box;
	}

	.concept-topbar-title {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.875rem;
		font-weight: 650;
		color: hsl(0 0% 92%);
	}

	.concept-topbar-actions {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}

	.topbar-button-group {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.topbar-button-group button {
		border: 1px solid hsl(224 8% 32%);
		border-radius: 0.3rem;
		background: hsl(224 8% 20%);
		color: hsl(0 0% 88%);
		padding: 0.18rem 0.42rem;
		font: inherit;
		font-size: 0.7rem;
		line-height: 1.2;
		cursor: pointer;
	}

	.topbar-button-group button:hover {
		background: hsl(224 8% 25%);
	}

	.topbar-button-group button.active {
		border-color: hsl(210 90% 55%);
		background: hsl(210 45% 28%);
		color: white;
	}
</style>

<script lang="ts">
import { 
	type ConceptCardView,
	type MainView 
	} from '$lib/canvas/types';


let	{ 
	currentBreadcrumb,
	currentCanvasCard,
	currentCanvasInstanceId,
	mainView,
	onGoToRootCanvas,
	onGoToCanvas,
	onGoUpOneLevel,
	onMainViewChange,
	onFocus,
	onFrameAll,
	onArrangeGrid
} = $props<{
	currentBreadcrumb: ConceptCardView[];
	currentCanvasCard: ConceptCardView | null;
	currentCanvasInstanceId: string | null;
	mainView: MainView;
	onGoToRootCanvas: () => void;
	onGoToCanvas: (instanceId: string) => void;
	onGoUpOneLevel: () => void;
	onMainViewChange: (view: MainView) => void;
	onFocus: () => void;
	onFrameAll: () => void;
	onArrangeGrid: () => void;
}>();
</script>

<header class="concept-topbar">
		<nav
			class="canvas-breadcrumb"
			aria-label="Canvas breadcrumb"
			
		>
			<button class="canvas-breadcrumb-item" type="button" onclick={onGoToRootCanvas}>Context Name (Root)</button>

			{#each currentBreadcrumb as breadcrumbCard}
				<span class="canvas-breadcrumb-separator">&gt;</span>

				<button
					class="canvas-breadcrumb-item"
					type="button"
					onclick={() => onGoToCanvas(breadcrumbCard.instance.id)}
				>
					{breadcrumbCard.concept.title || breadcrumbCard.concept.id}
				</button>
			{/each}

			{#if currentCanvasInstanceId !== null}
				<button class="canvas-breadcrumb-up" type="button" onclick={onGoUpOneLevel}>Up</button>
			{/if}
		</nav>

		<div class="concept-topbar-title">
			{#if currentCanvasCard}
				{currentCanvasCard.concept.title || currentCanvasCard.concept.id}
			{:else}
				Context Name (Placeholder)
			{/if}
		</div>

		<div class="concept-topbar-actions">
			<div class="topbar-button-group" aria-label="Main view">
				<button
					class:active={mainView === 'canvas'}
					type="button"
					onclick={() => onMainViewChange('canvas')}
				>
					Canvas
				</button>

				<button
					class:active={mainView === 'table'}
					type="button"
					onclick={() => onMainViewChange('table')}
				>
					Table
				</button>
			</div>

			<div class="topbar-button-group" aria-label="Canvas navigation">
				<button type="button" onclick={onFocus}>Focus Selected</button>
				<button type="button" onclick={onFrameAll}>Frame All</button>
				<button type="button" onclick={onArrangeGrid}>Grid</button>
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
	background: hsl(224 8% 16%);
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
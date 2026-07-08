<script lang="ts">
	import type { ConceptSizePreset, ContextMenu } from '$lib/canvas/types';

	type ImportChildrenMenuState = {
		visible: boolean;
		x: number;
		y: number;
		targetInstanceId: string | null;
	};

	type ImportChildrenOption = {
		instanceId: string;
		breadcrumb: string;
	};

	let {
		contextMenu,
		importChildrenMenu,
		importOptions,
		onCreateConceptFromMenu,
		onGoToCanvas,
		onCloseContextMenu,
		onOpenImportChildrenMenu,
		onDeleteInstanceFromMenu,
		onImportChildrenFromSource
	} = $props<{
		contextMenu: ContextMenu;
		importChildrenMenu: ImportChildrenMenuState;
		importOptions: ImportChildrenOption[];
		onCreateConceptFromMenu: (sizePreset: ConceptSizePreset) => void;
		onGoToCanvas: (instanceId: string) => void;
		onCloseContextMenu: () => void;
		onOpenImportChildrenMenu: () => void;
		onDeleteInstanceFromMenu: () => void;
		onImportChildrenFromSource: (instanceId: string) => void;
	}>();
</script>

{#if contextMenu.visible}
	<div
		class="context-menu"
		style={`left: ${contextMenu.x}px; top: ${contextMenu.y}px;`}
		onclick={(event) => event.stopPropagation()}
		onpointerdown={(event) => event.stopPropagation()}
	>
		{#if contextMenu.targetType === 'canvas'}
			<button
				class="context-menu-item"
				type="button"
				onclick={(event) => {
					event.stopPropagation();
					onCreateConceptFromMenu('small');
				}}
			>
				New Small Concept
			</button>

			<button
				class="context-menu-item"
				type="button"
				onclick={(event) => {
					event.stopPropagation();
					onCreateConceptFromMenu('medium');
				}}
			>
				New Medium Concept
			</button>

			<button
				class="context-menu-item"
				type="button"
				onclick={(event) => {
					event.stopPropagation();
					onCreateConceptFromMenu('large');
				}}
			>
				New Large Concept
			</button>
		{/if}

		{#if contextMenu.targetType === 'card'}
			<button
				class="context-menu-item"
				type="button"
				onclick={(event) => {
					event.stopPropagation();
					onGoToCanvas(contextMenu.instanceId);
					onCloseContextMenu();
				}}
			>
				Open Canvas
			</button>

			<button
				class="context-menu-item"
				type="button"
				onclick={(event) => {
					event.stopPropagation();
					onOpenImportChildrenMenu();
				}}
			>
				Import Children from Same Concept
			</button>

			<button
				class="context-menu-item context-menu-item-danger"
				type="button"
				onclick={(event) => {
					event.stopPropagation();
					onDeleteInstanceFromMenu();
				}}
			>
				Delete
			</button>
		{/if}
	</div>
{/if}

{#if importChildrenMenu.visible && importChildrenMenu.targetInstanceId}
	<div
		class="context-menu import-children-menu"
		style={`left: ${importChildrenMenu.x}px; top: ${importChildrenMenu.y}px;`}
		onclick={(event) => event.stopPropagation()}
		onpointerdown={(event) => event.stopPropagation()}
	>
		{#if importOptions.length === 0}
			<div class="context-menu-empty">No other instances with children</div>
		{:else}
			{#each importOptions as option (option.instanceId)}
				<button
					class="context-menu-item"
					type="button"
					onclick={(event) => {
						event.stopPropagation();
						onImportChildrenFromSource(option.instanceId);
					}}
				>
					{option.breadcrumb}
				</button>
			{/each}
		{/if}
	</div>
{/if}

<style>
	.context-menu {
		position: fixed;
		z-index: 3000;
		min-width: 12rem;
		display: grid;
		gap: 0.2rem;
		padding: 0.35rem;
		border: 1px solid hsl(224 8% 35%);
		border-radius: 0.45rem;
		background: hsl(224 8% 16%);
		box-shadow: 0 12px 36px rgb(0 0 0 / 35%);
		color: white;
	}

	.import-children-menu {
		min-width: 16rem;
		max-width: 26rem;
	}

	.context-menu-item {
		width: 100%;
		border: 0;
		border-radius: 0.3rem;
		background: transparent;
		color: inherit;
		padding: 0.4rem 0.55rem;
		font: inherit;
		font-size: 0.8rem;
		text-align: left;
		cursor: pointer;
	}

	.context-menu-item:hover {
		background: hsl(0 0% 100% / 10%);
	}

	.context-menu-item-danger {
		color: hsl(0 85% 72%);
	}

	.context-menu-empty {
		padding: 0.45rem 0.6rem;
		font-size: 0.8rem;
		color: hsl(0 0% 78%);
	}
</style>
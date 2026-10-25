<script lang="ts">
	import { getEditorContext } from '$lib/components/editor/EditorContext';

	const editor = getEditorContext();
</script>

{#if editor.contextMenu.visible}
	<div
		class="context-menu"
		style={`left: ${editor.contextMenu.x}px; top: ${editor.contextMenu.y}px;`}
		onclick={(event) => event.stopPropagation()}
		onpointerdown={(event) => event.stopPropagation()}
	>
		{#if editor.contextMenu.targetType === 'canvas'}
			<button
				class="context-menu-item"
				type="button"
				onclick={(event) => {
					event.stopPropagation();
					editor.createConceptFromMenu('small');
				}}
			>
				New Small Concept
			</button>

			<button
				class="context-menu-item"
				type="button"
				onclick={(event) => {
					event.stopPropagation();
					editor.createConceptFromMenu('medium');
				}}
			>
				New Medium Concept
			</button>

			<button
				class="context-menu-item"
				type="button"
				onclick={(event) => {
					event.stopPropagation();
					editor.createConceptFromMenu('large');
				}}
			>
				New Large Concept
			</button>
		{/if}

		{#if editor.contextMenu.targetType === 'card'}
			<button
				class="context-menu-item"
				type="button"
				onclick={(event) => {
					event.stopPropagation();

					if (editor.contextMenu.instanceId) {
						editor.openInstanceCanvas(editor.contextMenu.instanceId);
					}

					editor.closeContextMenu();
				}}
			>
				Open Canvas
			</button>

			<button
				class="context-menu-item"
				type="button"
				onclick={(event) => {
					event.stopPropagation();
					editor.openImportChildrenMenu();
				}}
			>
				Import Children from Same Concept
			</button>

			<button
				class="context-menu-item context-menu-item-danger"
				type="button"
				onclick={(event) => {
					event.stopPropagation();
					editor.deleteInstanceFromMenu();
				}}
			>
				Delete
			</button>
		{/if}
	</div>
{/if}

{#if editor.importChildrenMenu.visible && editor.importChildrenMenu.targetInstanceId}
	<div
		class="context-menu import-children-menu"
		style={`left: ${editor.importChildrenMenu.x}px; top: ${editor.importChildrenMenu.y}px;`}
		onclick={(event) => event.stopPropagation()}
		onpointerdown={(event) => event.stopPropagation()}
	>
		{#if editor.importChildrenOptions.length === 0}
			<div class="context-menu-empty">No other instances with children</div>
		{:else}
			{#each editor.importChildrenOptions as option (option.instanceId)}
				<button
					class="context-menu-item"
					type="button"
					onclick={(event) => {
						event.stopPropagation();
						editor.importChildrenFromSource(option.instanceId);
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

<script lang="ts">
	import { untrack } from 'svelte';
	import CanvasContextMenu from '$lib/components/editor/canvas/CanvasContextMenu.svelte';
	import ConceptCanvas from '$lib/components/editor/canvas/ConceptCanvas.svelte';
	import CanvasTopbar from '$lib/components/editor/canvas/CanvasTopbar.svelte';
	import PasteImportConfirmation from '$lib/components/editor/canvas/PasteImportConfirmation.svelte';
	import ConceptSidebar from '$lib/components/editor/sidebar/ConceptSidebar.svelte';
	import { clamp } from '$lib/components/editor/canvas/geometry';
	import type { EditorData } from '$lib/components/editor/EditorTypes';
	import { Editor } from '$lib/components/editor/Editor.svelte';
	import { setEditorContext } from '$lib/components/editor/EditorContext';

	let { data } = $props<{ data: EditorData }>();

	const editor = untrack(() => new Editor(data));
	setEditorContext(editor);

	$effect(() => {
		const concepts = data.concepts;
		const instances = data.instances;
		const relationships = data.relationships;
		const relationshipDefinitions = data.relationshipDefinitions;

		untrack(() => {
			editor.replaceData({ concepts, instances, relationships, relationshipDefinitions });
		});
	});

	let sidebarElement = $state<HTMLElement | null>(null);
	let sidebarWidth = $state<number | null>(null);
	let isResizingSidebar = $state(false);
	let sidebarResizeStartX = 0;
	let sidebarResizeStartWidth = 0;

	const minSidebarWidth = 180;
	const minCanvasWidth = 240;

	function handleSidebarResizePointerDown(event: PointerEvent) {
		if (event.button !== 0 || !sidebarElement) return;
		event.preventDefault();
		event.stopPropagation();
		const handle = event.currentTarget as HTMLElement;
		handle.setPointerCapture(event.pointerId);
		isResizingSidebar = true;
		sidebarResizeStartX = event.clientX;
		sidebarResizeStartWidth = sidebarElement.getBoundingClientRect().width;
	}

	function handleSidebarResizePointerMove(event: PointerEvent) {
		if (!isResizingSidebar || !sidebarElement) return;
		const workspaceWidth =
			sidebarElement.parentElement?.getBoundingClientRect().width ?? window.innerWidth;
		const maxSidebarWidth = Math.max(minSidebarWidth, workspaceWidth - minCanvasWidth);
		sidebarWidth = clamp(
			sidebarResizeStartWidth + (event.clientX - sidebarResizeStartX),
			minSidebarWidth,
			maxSidebarWidth
		);
	}

	function handleSidebarResizePointerUp(event: PointerEvent) {
		if (!isResizingSidebar) return;
		const handle = event.currentTarget as HTMLElement;
		if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
		isResizingSidebar = false;
	}
</script>

<svelte:window
	onclick={() => editor.closeContextMenu()}
	onkeydown={(event) => editor.canvas.handleWindowKeydown(event)}
	onpointermove={(event) => editor.canvas.handleWindowPointerMove(event)}
	onpointerup={(event) => void editor.canvas.handleWindowPointerUp(event)}
/>

<section class="concept-workspace">
	<CanvasTopbar />

	<div class="concept-workspace-body">
		{#if editor.sidebarVisible}
			<div
				bind:this={sidebarElement}
				class="sidebar-shell"
				style:width={sidebarWidth === null ? undefined : `${sidebarWidth}px`}
			>
				<ConceptSidebar />

				<button
					class="sidebar-resize-handle"
					class:active={isResizingSidebar}
					type="button"
					aria-label="Resize sidebar"
					onpointerdown={handleSidebarResizePointerDown}
					onpointermove={handleSidebarResizePointerMove}
					onpointerup={handleSidebarResizePointerUp}
					onpointercancel={handleSidebarResizePointerUp}
				></button>
			</div>
		{/if}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<section
			bind:this={editor.canvas.canvasElement}
			class="canvas"
			class:sidebar-hidden={!editor.sidebarVisible}
			class:is-panning={editor.canvas.isPanning}
			role="application"
			aria-label="Concept canvas"
			tabindex="0"
			onwheel={(event) => editor.canvas.handleCanvasWheel(event)}
		>
			{#if editor.mainView === 'canvas'}
				<ConceptCanvas />
			{:else}
				<div class="table-placeholder">
					<h2>Table View</h2>
					<p>
						Table view will render here later. For now, switching to Table also forces the sidebar
						to Tree.
					</p>
				</div>
			{/if}

			{#if editor.canvas.pasteConfirmation.visible}
				<PasteImportConfirmation
					itemsCount={editor.canvas.pasteConfirmation.items.length}
					targetConceptName={editor.canvas.pasteConfirmation.targetConceptName}
					onConfirm={() => editor.canvas.confirmPasteImport()}
					onCancel={() => editor.canvas.cancelPasteImport()}
				/>
			{/if}
			<CanvasContextMenu />
		</section>
	</div>
</section>

<style>
	.concept-workspace {
		height: 100vh;
		width: 100vw;
		display: grid;
		grid-template-rows: 44px minmax(0, 1fr);

		overflow: hidden;
		background: hsl(224 8% 12%);
	}

	.concept-workspace-body {
		min-height: 0;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		overflow: hidden;
	}

	.concept-workspace-body.sidebar-hidden {
		grid-template-columns: minmax(0, 1fr);
	}

	.sidebar-shell {
		position: relative;
		display: flex;
		width: max(260px, 25vw);
		min-width: 0;
		min-height: 0;
	}

	.sidebar-shell :global(.concept-sidebar) {
		width: 100%;
		min-width: 0;
		min-height: 0;
	}

	.sidebar-resize-handle {
		position: absolute;
		z-index: 30;
		top: 0;
		right: -3px;
		bottom: 0;
		width: 6px;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: col-resize;
		touch-action: none;
	}

	.sidebar-resize-handle:hover,
	.sidebar-resize-handle.active {
		background: hsl(210 90% 55% / 45%);
	}

	.canvas {
		position: relative;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		background: var(--canvas-background-color);
		touch-action: none;
	}

</style>

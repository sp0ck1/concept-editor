<script lang="ts">
	import ConceptCard from '$lib/components/editor/card/ConceptCard.svelte';
	import { getEditorContext } from '$lib/components/editor/EditorContext';
	import CanvasSelectionBox from '$lib/components/editor/canvas/CanvasSelectionBox.svelte';

	const editor = getEditorContext();
</script>

{#if editor.canvas.childTileDragState.active}
	<div
		class="child-tile-drag-ghost"
		style={`left: ${editor.canvas.childTileDragState.mouseX}px; top: ${editor.canvas.childTileDragState.mouseY}px;`}
	>
		<div class="child-tile-drag-ghost-title">
			{editor.canvas.childTileDragState.childCard.concept.title ||
				editor.canvas.childTileDragState.childCard.concept.id}
		</div>
	</div>
{/if}

<div
	class="canvas-background"
	ondblclick={(event) => editor.canvas.handleCanvasDoubleClick(event)}
	oncontextmenu={(event) => editor.canvas.handleCanvasContextMenu(event)}
	onpointerdown={(event) => editor.canvas.handleCanvasPointerDown(event)}
	onpaste={(event) => editor.canvas.handleCanvasPaste(event)}
></div>

{#if editor.canvas.selectionBoxState.active}
	{@const selectionCanvasRect = editor.canvas.getSelectionBoxCanvasRect()}
	{#if selectionCanvasRect}
		<CanvasSelectionBox rect={selectionCanvasRect} />
	{/if}
{/if}

<div
	class="canvas-world"
	style={`transform: translate(${editor.canvas.panX}px, ${editor.canvas.panY}px) scale(${editor.canvas.zoom});`}
	class:is-arranging-camera={editor.canvas.arrangingCamera}
>
	{#each editor.cardsInCurrentCanvas as card (card.instance.id)}
		<ConceptCard {card} />
	{/each}
</div>

<div class="zoom-indicator">
	{Math.round(editor.canvas.zoom * 100)}%
</div>

<style>
	.child-tile-drag-ghost {
		position: fixed;
		z-index: var(--maximum-z-index);
		width: fit-content;
		max-width: 500px;
		text-overflow: ellipsis;
		height: var(--child-tile-height);
		transform: translate(-50%, -50%);
		pointer-events: none;

		display: flex;
		align-items: center;
		justify-content: center;

		padding: 0.75rem;
		border-radius: var(--child-tile-radius);
		border: 1px solid var(--child-tile-border-drag);
		background: var(--child-tile-bg);
		color: var(--child-tile-text);
		box-shadow: 2px 2px 1px black;

		user-select: none;
		box-sizing: border-box;
	}

	.child-tile-drag-ghost-title {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 8;

		max-width: 100%;
		max-height: 100%;

		overflow: hidden;
		text-overflow: ellipsis;

		font-size: var(--child-tile-drag-font-size);
		font-weight: var(--child-tile-drag-font-weight);
		line-height: var(--child-tile-line-height);
		text-align: center;

		white-space: normal;
		overflow-wrap: normal;
		word-break: normal;
	}

	.canvas-background {
		position: absolute;
		inset: 0;
		z-index: 0;
	}

	.canvas-world {
		position: absolute;
		left: 0;
		top: 0;
		z-index: 1;
		transform-origin: 0 0;
	}

	.zoom-indicator {
		position: absolute;
		right: 0.75rem;
		bottom: 0.75rem;
		z-index: 20;
		padding: 0.25rem 0.45rem;
		border-radius: 6px;
		background: hsl(0 0% 0% / 45%);
		color: white;
		font-size: 0.75rem;
		pointer-events: none;
	}

	.canvas-world.is-arranging-camera {
		transition: transform 4000ms ease;
	}
</style>

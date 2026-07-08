<script lang="ts">
	type CanvasSelectionRect = {
		left: number;
		top: number;
		right: number;
		bottom: number;
	};

	let { rect } = $props<{
		rect: CanvasSelectionRect;
	}>();

	let width = $derived(rect.right - rect.left);
	let height = $derived(rect.bottom - rect.top);
</script>

<div
	class="canvas-selection-box"
	style={`
		left: ${rect.left}px;
		top: ${rect.top}px;
		width: ${width}px;
		height: ${height}px;
	`}
></div>

<style>
	.canvas-selection-box {
		position: absolute;
		z-index: 3;
		pointer-events: none;
		border: 1px solid var(--selection-marquee-border-color);
		background: hsl(210 90% 50% / 12%);
		box-shadow: var(--selection-box-box-shadow);
	}
</style>
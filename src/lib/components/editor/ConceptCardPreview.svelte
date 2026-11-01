<script lang="ts">
	import { onMount } from 'svelte';
	import type { ConceptCardView } from '$lib/model/ConceptCardView';
	import type { TagPreview } from './Editor.svelte';
	import ConceptCard from './card/ConceptCard.svelte';
	import { getEditorContext } from './EditorContext';

	let { card, preview }: { card: ConceptCardView; preview: TagPreview } = $props();
	const editor = getEditorContext();
	let element: HTMLElement;

	onMount(() => {
		const unregister = editor.registerTagPreviewElement(preview.id, element);
		// Each preview uses the browser top layer, including previews opened from other cards.
		element.showPopover();
		return unregister;
	});
</script>

<div
	role="dialog"
	tabindex="-1"
	bind:this={element}
	popover="manual"
	class="concept-card-preview"
	class:opaque={preview.opaque}
	aria-label={`Preview: ${card.concept.title || 'Untitled Concept'}`}
	style:left={`${preview.x}px`}
	style:top={`${preview.y}px`}
	style:width={`${card.instance.width}px`}
	style:height={`${card.instance.height}px`}
	onpointerenter={() => editor.enterTagPreview(preview.id)}
	onpointerleave={(event) => editor.leaveTagPreview(event.relatedTarget)}
	onpointerdown={(event) => event.stopPropagation()}
	onwheel={(event) => event.stopPropagation()}
	onkeydown={(event) => {
		event.stopPropagation();
		if (event.key === 'Escape') {
			event.preventDefault();
			editor.dismissTagPreview();
		}
	}}
>
	<ConceptCard {card} preview />
</div>

<style>
	.concept-card-preview {
		position: fixed;
		inset: auto;
		margin: 0;
		padding: 0;
		border: 0;
		overflow: visible;
		background: transparent;
		color: inherit;
		transform: translateY(-100%);
		opacity: 1;
		animation: preview-fade-in 1s linear both;
	}

	.concept-card-preview.opaque {
		animation: none;
		opacity: 1;
	}

	@keyframes preview-fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>

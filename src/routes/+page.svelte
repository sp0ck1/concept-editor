<script lang="ts">
	import ConceptCanvas from '$lib/components/ConceptCanvas.svelte';
	import type { Concept } from '$lib/types/Concept';
	import type { ConceptCardView } from '$lib/types/ConceptCardView';

	let { data } = $props<{
		data: {
			concepts: Concept[];
			cards: ConceptCardView[];
		};
	}>();
</script>

<main class="app">
	<ConceptCanvas initialCards={data.cards} initialConcepts={data.concepts} />
</main>
<script lang="ts">
	import ConceptCanvas from '$lib/components/ConceptCanvas.svelte';
	import type { Concept } from '$lib/types/Concept';
	import type { ConceptCardView } from '$lib/types/ConceptCardView';
	import type { ConceptRelationship } from '$lib/types/ConceptRelationship';
	import type { RelationshipDefinition } from '$lib/types/RelationshipDefinition';

	let { data } = $props<{
		data: {
			concepts: Concept[];
			cards: ConceptCardView[];
			relationships: ConceptRelationship[];
			relationshipDefinitions: RelationshipDefinition[];
		};
	}>();
</script>

<main class="app">
	<ConceptCanvas 
	initialCards={data.cards} 
	initialConcepts={data.concepts} 
	initialRelationships={data.relationships}
	initialRelationshipDefinitions={data.relationshipDefinitions}
	/>
</main>
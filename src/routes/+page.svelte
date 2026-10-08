<script lang="ts">
	import ConceptEditor from '$lib/components/editor/ConceptEditor.svelte';
	import type { Concept } from '$lib/model/Concept';
	import type { ConceptCardView } from '$lib/model/ConceptCardView';
	import type { ConceptRelationship } from '$lib/model/ConceptRelationship';
	import type { RelationshipDefinition } from '$lib/model/RelationshipDefinition';

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
	<ConceptEditor
	initialCards={data.cards} 
	initialConcepts={data.concepts} 
	initialRelationships={data.relationships}
	initialRelationshipDefinitions={data.relationshipDefinitions}
	/>
</main>
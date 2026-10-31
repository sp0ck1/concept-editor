import { getContext } from '$lib/server/repositories/contextRepository';
import { getAllConcepts } from '$lib/server/repositories/conceptRepository';
import { getAllConceptInstances } from '$lib/server/repositories/conceptInstanceRepository';
import { getAllConceptRelationships } from '$lib/server/repositories/conceptRelationshipRepository';
import { getAllRelationshipDefinitions } from '$lib/server/repositories/relationshipDefinitionRepository';

export async function load() {
	const context = await getContext();
	const concepts = await getAllConcepts();
	const instances = await getAllConceptInstances();
	const relationships = await getAllConceptRelationships();
	const relationshipDefinitions = await getAllRelationshipDefinitions();

	// Corresponding to the items in $lib/data
	return {
		context,
		concepts,
		instances,
		relationships,
		relationshipDefinitions
	};
}

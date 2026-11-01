import { getAllTags } from '$lib/server/repositories/tagRepository';
import { getContext } from '$lib/server/repositories/contextRepository';
import { getAllConcepts } from '$lib/server/repositories/conceptRepository';
import { getAllConceptInstances } from '$lib/server/repositories/conceptInstanceRepository';
import { getAllConceptRelationships } from '$lib/server/repositories/conceptRelationshipRepository';
import { getAllRelationshipDefinitions } from '$lib/server/repositories/relationshipDefinitionRepository';

export async function load() {
	const context = await getContext();
	const tags = await getAllTags();
	const concepts = await getAllConcepts();
	const instances = await getAllConceptInstances();
	const relationships = await getAllConceptRelationships();
	const relationshipDefinitions = await getAllRelationshipDefinitions();

	// Corresponding to the items in $lib/data
	return {
		context,
		tags,
		concepts,
		instances,
		relationships,
		relationshipDefinitions
	};
}

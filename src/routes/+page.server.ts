import type { ConceptCardView } from '$lib/model/ConceptCardView';
import { getAllConcepts } from '$lib/server/repositories/conceptRepository';
import { getAllConceptInstances } from '$lib/server/repositories/conceptInstanceRepository';
import { getAllConceptRelationships } from '$lib/server/repositories/conceptRelationshipRepository';
import { getAllRelationshipDefinitions } from '$lib/server/repositories/relationshipDefinitionRepository';

export async function load() {
  const concepts = await getAllConcepts();
  const instances = await getAllConceptInstances();

  const cards: ConceptCardView[] = instances
    .map((instance) => {
      const concept = concepts.find((item) => item.id === instance.conceptId);

      if (!concept) {
        return null;
      }

      return {
        concept,
        instance
      };
    })
    .filter((card): card is ConceptCardView => card !== null);

    const relationships = await getAllConceptRelationships();
    const relationshipDefinitions = await getAllRelationshipDefinitions();

  // Corresponding to the items in $lib/data
  return {
    concepts,
    instances,
    cards,
    relationships,
    relationshipDefinitions
  };
}
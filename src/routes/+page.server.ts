import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Concept } from '$lib/types/Concept';
import type { ConceptInstance } from '$lib/types/ConceptInstance';
import type { ConceptCardView } from '$lib/types/ConceptCardView';
import { normalizeConcept } from '$lib/concepts/normalizeConcept';
import { normalizeConceptInstance } from '$lib/concepts/normalizeConceptInstance';

export async function load() {
  const conceptsPath = path.resolve('src/lib/data/concepts.json');
  const instancesPath = path.resolve('src/lib/data/concept_instances.json');

  const conceptsFile = await readFile(conceptsPath, 'utf-8');
  const instancesFile = await readFile(instancesPath, 'utf-8');

  const rawConcepts = JSON.parse(conceptsFile) as Partial<Concept>[];
  const rawInstances = JSON.parse(instancesFile) as Partial<ConceptInstance>[];

  const concepts = rawConcepts.map((concept, index) =>
    normalizeConcept(concept, index)
  );

  const instances = rawInstances.map((instance, index) =>
    normalizeConceptInstance(instance, index)
  );

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

  return {
    concepts,
    instances,
    cards
  };
}
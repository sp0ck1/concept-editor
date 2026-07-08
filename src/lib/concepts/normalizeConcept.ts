import type { Concept } from '$lib/types/Concept';

export function normalizeConcept(concept: Partial<Concept>, index = 0): Concept {
	return {
		id: concept.id ?? `missing-concept-id-${index}`,
		title: concept.title ?? '',
		properties: concept.properties ?? {},
		tagConceptIds: Array.isArray(concept.tagConceptIds) ? concept.tagConceptIds : []
	};
}
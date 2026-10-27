import {
	normalizeConceptNotes,
	normalizeConceptDates,
	normalizeConceptAppearance
} from './metadata';
import type { Concept } from '$lib/model/Concept';

export function normalizeConcept(concept: Partial<Concept>, index = 0): Concept {
	const appearance = normalizeConceptAppearance(concept.appearance);
	return {
		id: concept.id ?? `missing-concept-id-${index}`,
		title: concept.title ?? '',
		properties: { ...(concept.properties ?? {}) },
		tagConceptIds: Array.isArray(concept.tagConceptIds) ? [...concept.tagConceptIds] : [],
		notes: normalizeConceptNotes(concept.notes),
		dates: normalizeConceptDates(concept.dates),
		...(appearance !== undefined ? { appearance } : {})
	};
}

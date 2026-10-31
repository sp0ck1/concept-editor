import type { Context } from './Context';
import {
	isStringRecord,
	normalizeConceptAppearance,
	normalizeConceptDates,
	normalizeConceptNotes
} from './metadata';

export function normalizeContext(context: Partial<Context>): Context {
	const appearance = normalizeConceptAppearance(context.appearance);
	return {
		id: typeof context.id === 'string' ? context.id : 'missing-context-id',
		title: typeof context.title === 'string' ? context.title : 'Untitled Context',
		properties: isStringRecord(context.properties) ? { ...context.properties } : {},
		tagConceptIds: Array.isArray(context.tagConceptIds)
			? context.tagConceptIds.filter((id): id is string => typeof id === 'string')
			: [],
		notes: normalizeConceptNotes(context.notes),
		dates: normalizeConceptDates(context.dates),
		...(appearance !== undefined ? { appearance } : {})
	};
}

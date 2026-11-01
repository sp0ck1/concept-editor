import type { ConceptAppearance } from './ConceptAppearance';
import type { ConceptDate } from './ConceptDate';
import type { ConceptNotes } from './ConceptNotes';

export type Context = {
	id: string;
	title: string;
	properties: Record<string, string>;
	tagIds: string[];
	notes: ConceptNotes;
	dates: ConceptDate[];
	appearance?: ConceptAppearance;
};

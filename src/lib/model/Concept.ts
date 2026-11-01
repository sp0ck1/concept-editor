import type { ConceptNotes } from './ConceptNotes';
import type { ConceptDate } from './ConceptDate';
import type { ConceptAppearance } from './ConceptAppearance';

export type Concept = {
	id: string;
	title: string;
	properties: Record<string, string>;
	tagIds: string[];
	notes: ConceptNotes;
	dates: ConceptDate[];
	appearance?: ConceptAppearance;
	image: object;
};

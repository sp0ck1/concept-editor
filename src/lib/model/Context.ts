import type { Concept } from './Concept';
import type { ConceptAppearance } from './ConceptAppearance';
import type { ConceptDate } from './ConceptDate';
import type { ConceptInstance } from './ConceptInstance';
import type { ConceptNotes } from './ConceptNotes';
import type { ConceptRelationship } from './ConceptRelationship';
import type { RelationshipDefinition } from './RelationshipDefinition';

export type Context = {
	id: string;
	name: string;
	properties: Record<string, string>;
	tagConceptIds: string[];
	notes: ConceptNotes;
	dates: ConceptDate[];
	appearance?: ConceptAppearance;
	concepts: Concept[];
	instances: ConceptInstance[];
	relationships: ConceptRelationship[];
	relationshipDefinitions: RelationshipDefinition[];
};


// src/lib/types/ConceptRelationship.ts

export type RelationshipParticipantReference =
	| {
			type: 'concept';
			id: string;
	  }
	| {
			type: 'relationship';
			id: string;
	  };

export type RelationshipParticipantGroup = {
	participants: RelationshipParticipantReference[];
};

export type ConceptRelationship = {
	id: string;
	relationshipConceptId: string;
	participantGroups: RelationshipParticipantGroup[];
	representedByConceptId?: string;
	properties: Record<string, string>;
};

/*
Examples:

{
	"conceptId": "employee-of",
	"inverseConceptId": "employer-of",
	"isMutual": false,
	"forwardPattern": "[0] employee of [1]",
	"inversePattern": "[1] employer of [0]"
}
{
	"conceptId": "married-to",
	"inverseConceptId": "married-to",
	"isMutual": true,
	"forwardPattern": "[all] married to each other"
}
{
	"conceptId": "officiated-at",
	"isMutual": false,
	"forwardPattern": "[0] officiated at [1]"
}
*/

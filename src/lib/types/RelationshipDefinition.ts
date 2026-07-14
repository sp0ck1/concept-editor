
export type RelationshipDefinition = {
	conceptId: string;
	inverseConceptId?: string;
	isMutual?: boolean;
	forwardPattern?: string;
	inversePattern?: string;
};
import type { ConceptRelationship } from '$lib/types/ConceptRelationship';
import type { Concept } from '$lib/types/Concept';
import type { RelationshipDefinition } from '$lib/types/RelationshipDefinition';

/**
 * Returns relationships where the concept is an actual participant.
 */
export function getRelationshipsContainingConcept(
	relationships: ConceptRelationship[],
	conceptId: string
): ConceptRelationship[] {
	return relationships.filter((relationship) =>
		relationship.participantGroups.some((group) =>
			group.participants.some(
				(participant) =>
					participant.type === 'concept' &&
					participant.id === conceptId
			)
		)
	);
}

/**
 * Returns the relationship occurrence represented by this concept, if any.
 */
export function getRepresentedRelationship(
	relationships: ConceptRelationship[],
	conceptId: string
): ConceptRelationship | undefined {
	return relationships.find(
		(relationship) =>
			relationship.representedByConceptId === conceptId
	);
}

/**
 * Returns relationships containing the concept, plus the relationship
 * represented by the concept, without duplicates.
 */
export function getRelationshipsForConcept(
	relationships: ConceptRelationship[],
	conceptId: string
): ConceptRelationship[] {
	const containingRelationships =
		getRelationshipsContainingConcept(relationships, conceptId);

	const representedRelationship =
		getRepresentedRelationship(relationships, conceptId);

	if (
		!representedRelationship ||
		containingRelationships.some(
			(relationship) =>
				relationship.id === representedRelationship.id
		)
	) {
		return containingRelationships;
	}

	return [...containingRelationships, representedRelationship];
}


export type RelationshipDisplayPart =
	| {
			type: 'text';
			value: string;
	  }
	| {
			type: 'concept';
			concept: Concept;
	  };

function getCurrentParticipantGroupIndex(
	relationship: ConceptRelationship,
	currentConceptId: string
) {
	return relationship.participantGroups.findIndex((group) =>
		group.participants.some(
			(participant) =>
				participant.type === 'concept' &&
				participant.id === currentConceptId
		)
	);
}

function getRelationshipDefinition(
	relationshipDefinitions: RelationshipDefinition[],
	relationshipConceptId: string
) {
	return relationshipDefinitions.find(
		(definition) =>
			definition.conceptId === relationshipConceptId
	);
}

function getRelationshipPattern(
	definition: RelationshipDefinition,
	currentGroupIndex: number
) {
	if (definition.isMutual || currentGroupIndex === 0) {
		return definition.forwardPattern;
	}

	return definition.inversePattern ?? definition.forwardPattern;
}

function getDisplayGroupIndexes(
	relationship: ConceptRelationship,
	definition: RelationshipDefinition,
	currentGroupIndex: number
) {
	const groupIndexes = relationship.participantGroups.map(
		(_, index) => index
	);

	if (!definition.isMutual || currentGroupIndex === 0) {
		return groupIndexes;
	}

	return [
		currentGroupIndex,
		...groupIndexes.filter(
			(index) => index !== currentGroupIndex
		)
	];
}

export function getRelationshipDisplayParts(
	relationship: ConceptRelationship,
	relationshipDefinitions: RelationshipDefinition[],
	currentConceptId: string,
	getConceptById: (conceptId: string) => Concept | undefined
): RelationshipDisplayPart[] {
	const definition = getRelationshipDefinition(
		relationshipDefinitions,
		relationship.relationshipConceptId
	);

	if (!definition?.forwardPattern) {
		return [];
	}

	const currentGroupIndex = getCurrentParticipantGroupIndex(
		relationship,
		currentConceptId
	);

	if (currentGroupIndex === -1) {
		return [];
	}

	const pattern = getRelationshipPattern(
		definition,
		currentGroupIndex
	);

	if (!pattern) {
		return [];
	}

	const displayGroupIndexes = getDisplayGroupIndexes(
		relationship,
		definition,
		currentGroupIndex
	);

	const currentDisplayGroupIndex = definition.isMutual
		? 0
		: currentGroupIndex;

	const parts: RelationshipDisplayPart[] = [];
	const placeholderPattern = /\[(\d+)\]/g;

	let previousEnd = 0;

	for (const match of pattern.matchAll(placeholderPattern)) {
		const matchIndex = match.index ?? 0;
		const placeholderIndex = Number(match[1]);

		const precedingText = pattern.slice(
			previousEnd,
			matchIndex
		);

		if (precedingText) {
			parts.push({
				type: 'text',
				value: precedingText
			});
		}

		if (placeholderIndex !== currentDisplayGroupIndex) {
			const storedGroupIndex =
				displayGroupIndexes[placeholderIndex];

			const group =
				relationship.participantGroups[storedGroupIndex];

			for (const participant of group?.participants ?? []) {
				if (participant.type !== 'concept') {
					continue;
				}

				const concept = getConceptById(participant.id);

				if (concept) {
					parts.push({
						type: 'concept',
						concept
					});
				}
			}
		}

		previousEnd = matchIndex + match[0].length;
	}

	const trailingText = pattern.slice(previousEnd);

	if (trailingText) {
		parts.push({
			type: 'text',
			value: trailingText
		});
	}

	return cleanRelationshipDisplayParts(parts);
}

function cleanRelationshipDisplayParts(
	parts: RelationshipDisplayPart[]
): RelationshipDisplayPart[] {
	const cleanedParts = parts
		.map((part) => {
			if (part.type === 'concept') {
				return part;
			}

			return {
				...part,
				value: part.value.replace(/\s+/g, ' ')
			};
		})
		.filter(
			(part) =>
				part.type === 'concept' ||
				part.value.length > 0
		);

	const firstPart = cleanedParts[0];

	if (firstPart?.type === 'text') {
		firstPart.value = firstPart.value.trimStart();
	}

	const lastPart = cleanedParts.at(-1);

	if (lastPart?.type === 'text') {
		lastPart.value = lastPart.value.trimEnd();
	}

	return cleanedParts;
}
import type {
	ConceptRelationship,
	RelationshipParticipantGroup
} from '$lib/model/ConceptRelationship';
import { getErrorMessage } from '$lib/client/http';

export type CreateConceptRelationshipInput = Omit<ConceptRelationship, 'id'>;

export type UpdateConceptRelationshipInput = {
	id: string;
	relationshipConceptId?: string;
	participantGroups?: RelationshipParticipantGroup[];
	representedByConceptId?: string | null;
	properties?: Record<string, string>;
};


export async function fetchConceptRelationships(): Promise<
	ConceptRelationship[]
> {
	const response = await fetch('/api/relationships');

	if (!response.ok) {
		throw new Error(await getErrorMessage(response));
	}

	return (await response.json()) as ConceptRelationship[];
}

export async function createConceptRelationship(
	input: CreateConceptRelationshipInput
): Promise<ConceptRelationship> {
	const response = await fetch('/api/relationships', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(input)
	});

	if (!response.ok) {
		throw new Error(await getErrorMessage(response));
	}

	return (await response.json()) as ConceptRelationship;
}

export async function updateConceptRelationship(
	input: UpdateConceptRelationshipInput
): Promise<ConceptRelationship> {
	const response = await fetch('/api/relationships', {
		method: 'PATCH',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(input)
	});

	if (!response.ok) {
		throw new Error(await getErrorMessage(response));
	}

	return (await response.json()) as ConceptRelationship;
}

export async function deleteConceptRelationship(
	id: string
): Promise<void> {
	const response = await fetch('/api/relationships', {
		method: 'DELETE',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ id })
	});

	if (!response.ok) {
		throw new Error(await getErrorMessage(response));
	}
}

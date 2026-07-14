import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
	ConceptRelationship,
	RelationshipParticipantGroup
} from '$lib/types/ConceptRelationship';

const relationshipsFilePath = path.resolve(
	process.cwd(),
	'src/lib/data/concept_relationships.json'
);

export type CreateConceptRelationshipInput = Omit<ConceptRelationship, 'id'>;

export type UpdateConceptRelationshipInput = {
	id: string;
	relationshipConceptId?: string;
	participantGroups?: RelationshipParticipantGroup[];
	representedByConceptId?: string | null;
	properties?: Record<string, string>;
};

async function readConceptRelationshipsFile(): Promise<ConceptRelationship[]> {
	const contents = await readFile(relationshipsFilePath, 'utf8');

	if (!contents.trim()) {
		return [];
	}

	const parsed: unknown = JSON.parse(contents);

	if (!Array.isArray(parsed)) {
		throw new Error('concept_relationships.json must contain an array.');
	}

	return parsed as ConceptRelationship[];
}

async function writeConceptRelationshipsFile(
	relationships: ConceptRelationship[]
): Promise<void> {
	await writeFile(
		relationshipsFilePath,
		`${JSON.stringify(relationships, null, '\t')}\n`,
		'utf8'
	);
}

export async function getAllConceptRelationships(): Promise<
	ConceptRelationship[]
> {
	return readConceptRelationshipsFile();
}

export async function createConceptRelationship(
	input: CreateConceptRelationshipInput
): Promise<ConceptRelationship> {
	const relationships = await readConceptRelationshipsFile();

	const relationship: ConceptRelationship = {
		id: crypto.randomUUID(),
		relationshipConceptId: input.relationshipConceptId,
		participantGroups: input.participantGroups,
		properties: input.properties ?? {},
		...(input.representedByConceptId
			? { representedByConceptId: input.representedByConceptId }
			: {})
	};

	relationships.push(relationship);
	await writeConceptRelationshipsFile(relationships);

	return relationship;
}

export async function updateConceptRelationship(
	input: UpdateConceptRelationshipInput
): Promise<ConceptRelationship | null> {
	const relationships = await readConceptRelationshipsFile();
	const relationshipIndex = relationships.findIndex(
		(relationship) => relationship.id === input.id
	);

	if (relationshipIndex === -1) {
		return null;
	}

	const currentRelationship = relationships[relationshipIndex];

	const updatedRelationship: ConceptRelationship = {
		...currentRelationship,
		...(input.relationshipConceptId !== undefined
			? { relationshipConceptId: input.relationshipConceptId }
			: {}),
		...(input.participantGroups !== undefined
			? { participantGroups: input.participantGroups }
			: {}),
		...(input.properties !== undefined
			? { properties: input.properties }
			: {})
	};

	if (input.representedByConceptId === null) {
		delete updatedRelationship.representedByConceptId;
	} else if (input.representedByConceptId !== undefined) {
		updatedRelationship.representedByConceptId =
			input.representedByConceptId;
	}

	relationships[relationshipIndex] = updatedRelationship;
	await writeConceptRelationshipsFile(relationships);

	return updatedRelationship;
}

export async function deleteConceptRelationship(
	relationshipId: string
): Promise<boolean> {
	const relationships = await readConceptRelationshipsFile();
	const remainingRelationships = relationships.filter(
		(relationship) => relationship.id !== relationshipId
	);

	if (remainingRelationships.length === relationships.length) {
		return false;
	}

	await writeConceptRelationshipsFile(remainingRelationships);
	return true;
}

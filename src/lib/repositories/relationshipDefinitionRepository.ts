import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { RelationshipDefinition } from '$lib/types/RelationshipDefinition';

const relationshipDefinitionsFilePath = path.resolve(
	process.cwd(),
	'src/lib/data/relationship_definitions.json'
);

export async function getAllRelationshipDefinitions(): Promise<
	RelationshipDefinition[]
> {
	const contents = await readFile(
		relationshipDefinitionsFilePath,
		'utf8'
	);

	if (!contents.trim()) {
		return [];
	}

	const parsed: unknown = JSON.parse(contents);

	if (!Array.isArray(parsed)) {
		throw new Error(
			'relationship-definitions.json must contain an array.'
		);
	}

	return parsed as RelationshipDefinition[];
}
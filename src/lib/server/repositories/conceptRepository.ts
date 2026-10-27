import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Concept } from '$lib/model/Concept';
import {
	isConceptNotes,
	isConceptDates,
	isConceptAppearance,
	normalizeConceptNotes,
	normalizeConceptDates,
	normalizeConceptAppearance
} from '$lib/model/metadata';
import { normalizeConcept } from '$lib/model/normalizeConcept';

const conceptsPath = path.resolve(process.cwd(), 'src/lib/data/concepts.json');

export type UpdateConceptInput = {
	notes?: Concept['notes'];
	dates?: Concept['dates'];
	appearance?: Concept['appearance'];
	properties?: Record<string, string>;
	tagConceptIds?: string[];
};

export async function getAllConcepts(): Promise<Concept[]> {
	const file = await readFile(conceptsPath, 'utf8');
	const rawConcepts = JSON.parse(file) as Partial<Concept>[];

	return rawConcepts.map((concept, index) => normalizeConcept(concept, index));
}

export async function saveAllConcepts(concepts: Concept[]): Promise<void> {
	await writeFile(conceptsPath, `${JSON.stringify(concepts, null, '\t')}\n`, 'utf8');
}

export function createConceptId(): string {
	return `concept-${crypto.randomUUID()}`;
}

export async function getConceptById(id: string): Promise<Concept | undefined> {
	const concepts = await getAllConcepts();
	return concepts.find((concept) => concept.id === id);
}

export async function findConceptByTitle(title: string): Promise<Concept | undefined> {
	const normalizedTitle = title.trim().toLowerCase();

	if (!normalizedTitle) {
		return undefined;
	}

	const concepts = await getAllConcepts();
	return concepts.find((concept) => concept.title.trim().toLowerCase() === normalizedTitle);
}

export async function createConcept(
	title = '',
	metadata: UpdateConceptInput = {}
): Promise<Concept> {
	const concepts = await getAllConcepts();

	const concept: Concept = {
		id: createConceptId(),
		title: title.trim(),
		properties: {},
		tagConceptIds: [],
		notes: normalizeConceptNotes(undefined),
		dates: normalizeConceptDates(undefined)
	};

	applyConceptUpdates(concept, metadata);
	concepts.push(concept);
	await saveAllConcepts(concepts);

	return concept;
}

export async function ensureConceptByTitle(
	title: string
): Promise<{ concept: Concept; created: boolean }> {
	const concepts = await getAllConcepts();
	const normalizedTitle = title.trim();

	const existingConcept = concepts.find(
		(concept) => concept.title.trim().toLowerCase() === normalizedTitle.toLowerCase()
	);

	if (existingConcept) {
		return { concept: existingConcept, created: false };
	}

	const concept: Concept = {
		id: createConceptId(),
		title: normalizedTitle,
		properties: {},
		tagConceptIds: [],
		notes: normalizeConceptNotes(undefined),
		dates: normalizeConceptDates(undefined)
	};

	concepts.push(concept);
	await saveAllConcepts(concepts);

	return { concept, created: true };
}

export async function updateConcept(
	id: string,
	updates: UpdateConceptInput
): Promise<Concept | null> {
	const concepts = await getAllConcepts();
	const concept = concepts.find((item) => item.id === id);

	if (!concept) {
		return null;
	}

	applyConceptUpdates(concept, updates);

	await saveAllConcepts(concepts);
	return concept;
}

function applyConceptUpdates(concept: Concept, updates: UpdateConceptInput): void {
	if (updates.properties !== undefined) {
		concept.properties = updates.properties;
	}

	if (updates.tagConceptIds !== undefined) {
		concept.tagConceptIds = updates.tagConceptIds;
	}

	if (isConceptNotes(updates.notes)) concept.notes = normalizeConceptNotes(updates.notes);
	if (isConceptDates(updates.dates)) concept.dates = normalizeConceptDates(updates.dates);
	if (isConceptAppearance(updates.appearance))
		concept.appearance = normalizeConceptAppearance(updates.appearance);
}

import { json } from '@sveltejs/kit';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from './$types';
import type { Concept } from '$lib/types/Concept';
import { normalizeConcept } from '$lib/concepts/normalizeConcept';

const conceptsPath = path.resolve('src/lib/data/concepts.json');

function createConceptId() {
	return `concept-${crypto.randomUUID()}`;
}

async function readConcepts() {
	const file = await readFile(conceptsPath, 'utf-8');
	const rawConcepts = JSON.parse(file) as Partial<Concept>[];

	return rawConcepts.map((concept, index) => normalizeConcept(concept, index));
}

async function writeConcepts(concepts: Concept[]) {
	await writeFile(conceptsPath, JSON.stringify(concepts, null, 2), 'utf-8');
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const title = typeof body.title === 'string' ? body.title.trim() : '';

	if (!title) {
		return json({ message: 'Concept title is required.' }, { status: 400 });
	}

	const concepts = await readConcepts();

	const existingConcept = concepts.find(
		(concept) => concept.title.trim().toLowerCase() === title.toLowerCase()
	);

	if (existingConcept) {
		return json({
			concept: existingConcept,
			created: false
		});
	}

	const concept: Concept = {
		id: createConceptId(),
		title,
		properties: {},
		tagConceptIds: []
	};

	concepts.push(concept);

	await writeConcepts(concepts);

	return json(
		{
			concept,
			created: true
		},
		{ status: 201 }
	);
};
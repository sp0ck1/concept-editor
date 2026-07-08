import { json } from '@sveltejs/kit';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Concept } from '$lib/types/Concept';
import type { ConceptInstance } from '$lib/types/ConceptInstance';
import { normalizeConcept } from '$lib/concepts/normalizeConcept';
import {
	normalizeConceptInstance,
	defaultConceptWidth,
	defaultConceptHeight
} from '$lib/concepts/normalizeConceptInstance';

const conceptsPath = path.resolve('src/lib/data/concepts.json');
const instancesPath = path.resolve('src/lib/data/concept_instances.json');

async function readConcepts() {
	const file = await readFile(conceptsPath, 'utf-8');
	const rawConcepts = JSON.parse(file) as Partial<Concept>[];

	return rawConcepts.map((concept, index) => normalizeConcept(concept, index));
}

async function writeConcepts(concepts: Concept[]) {
	await writeFile(conceptsPath, JSON.stringify(concepts, null, 2), 'utf-8');
}

async function readInstances() {
	const file = await readFile(instancesPath, 'utf-8');
	const rawInstances = JSON.parse(file) as Partial<ConceptInstance>[];

	return rawInstances.map((instance, index) => normalizeConceptInstance(instance, index));
}

async function writeInstances(instances: ConceptInstance[]) {
	await writeFile(instancesPath, JSON.stringify(instances, null, 2), 'utf-8');
}

function createConceptId() {
	return `concept-${crypto.randomUUID()}`;
}

function createInstanceId() {
	return `instance-${crypto.randomUUID()}`;
}

type CreateConceptBody = {
	title?: unknown;
	x?: unknown;
	y?: unknown;
	width?: unknown;
	height?: unknown;
	parentInstanceId?: unknown;
};

export async function POST({ request }) {
	const concepts = await readConcepts();
	const instances = await readInstances();

	let body: CreateConceptBody = {};

	try {
		body = await request.json();
	} catch {
		body = {};
	}

	const title = typeof body.title === 'string' ? body.title.trim() : '';

	const concept: Concept = {
		id: createConceptId(),
		title,
		properties: {},
		tagConceptIds: []
	};

	const instance: ConceptInstance = {
		id: createInstanceId(),
		conceptId: concept.id,
		parentInstanceId:
			body.parentInstanceId === null || typeof body.parentInstanceId === 'string'
				? body.parentInstanceId
				: null,
		x: typeof body.x === 'number' ? body.x : 32 + instances.length * 248,
		y: typeof body.y === 'number' ? body.y : 32,
		width: typeof body.width === 'number' ? body.width : defaultConceptWidth,
		height: typeof body.height === 'number' ? body.height : defaultConceptHeight
	};

	concepts.push(concept);
	instances.push(instance);

	await writeConcepts(concepts);
	await writeInstances(instances);

	return json({ concept, instance }, { status: 201 });
}

export async function PATCH({ request }) {
	const body = await request.json();

	const id = body.id as string | undefined;

	if (!id) {
		return json({ message: 'Concept id is required.' }, { status: 400 });
	}

	const concepts = await readConcepts();
	const concept = concepts.find((item) => item.id === id);

	if (!concept) {
		return json({ message: 'Concept not found.' }, { status: 404 });
	}

	if (typeof body.title === 'string') {
		const nextTitle = body.title.trim();
		const instanceId = body.instanceId as string | undefined;

		if (!instanceId) {
			return json(
				{ message: 'Concept instance id is required when changing title.' },
				{ status: 400 }
			);
		}

		const instances = await readInstances();
		const instance = instances.find((item) => item.id === instanceId);

		if (!instance) {
			return json({ message: 'Concept instance not found.' }, { status: 404 });
		}

		const matchingConcept =
			nextTitle.length > 0
				? concepts.find((item) => item.title.trim().toLowerCase() === nextTitle.toLowerCase())
				: undefined;

		if (matchingConcept) {
			instance.conceptId = matchingConcept.id;

			await writeInstances(instances);

			return json({
				concept: matchingConcept,
				instance
			});
		}

		const usageCount = instances.filter((item) => item.conceptId === concept.id).length;

		const currentConceptIsUntitled = concept.title.trim().length === 0;
		const currentConceptIsOnlyUsedHere = usageCount === 1;

		if (nextTitle.length > 0 && currentConceptIsUntitled && currentConceptIsOnlyUsedHere) {
			concept.title = nextTitle;

			await writeConcepts(concepts);

			return json({
				concept,
				instance
			});
		}

		const newConcept: Concept = {
			id: createConceptId(),
			title: nextTitle,
			properties: {
				...concept.properties
			},
			tagConceptIds: [...(concept.tagConceptIds ?? [])]
		};

		concepts.push(newConcept);
		instance.conceptId = newConcept.id;

		await writeConcepts(concepts);
		await writeInstances(instances);

		return json({
			concept: newConcept,
			instance
		});
	}

	if (body.properties && typeof body.properties === 'object' && !Array.isArray(body.properties)) {
		concept.properties = body.properties;
	}

	if (Array.isArray(body.tagConceptIds)) {
		concept.tagConceptIds = body.tagConceptIds.filter((id: unknown): id is string => {
			return typeof id === 'string';
		});
	}

	await writeConcepts(concepts);

	return json(concept);
}

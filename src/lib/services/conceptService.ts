import type { Concept } from '$lib/types/Concept';
import type { TitleConflictMode } from '$lib/types/TitleConflictMode';
import type { ConceptInstance } from '$lib/types/ConceptInstance';
import {
	createConceptId,
	getAllConcepts,
	saveAllConcepts
} from '$lib/repositories/conceptRepository';
import {
	createConceptInstanceId,
	getAllConceptInstances,
	saveAllConceptInstances
} from '$lib/repositories/conceptInstanceRepository';
import {
	defaultConceptHeight,
	defaultConceptWidth
} from '$lib/concepts/normalizeConceptInstance';



export type CreateConceptWithInstanceInput = {
	title?: string;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	parentInstanceId?: string | null;
	lastCameraPanX?: number;
	lastCameraPanY?: number;
	lastCameraZoom?: number;
};



export async function createConceptWithInstance(
	input: CreateConceptWithInstanceInput
): Promise<{ concept: Concept; instance: ConceptInstance }> {
	const concepts = await getAllConcepts();
	const instances = await getAllConceptInstances();

	const concept: Concept = {
		id: createConceptId(),
		title: input.title?.trim() ?? '',
		properties: {},
		tagConceptIds: []
	};

	const instance: ConceptInstance = {
		id: createConceptInstanceId(),
		conceptId: concept.id,
		parentInstanceId: input.parentInstanceId ?? null,
		x: input.x ?? 32 + instances.length * 248,
		y: input.y ?? 32,
		width: input.width ?? defaultConceptWidth,
		height: input.height ?? defaultConceptHeight,
		lastCameraPanX: input.lastCameraPanX ?? 0,
		lastCameraPanY: input.lastCameraPanY ?? 0,
		lastCameraZoom: input.lastCameraZoom ?? 1
	};

	concepts.push(concept);
	instances.push(instance);

	await saveAllConcepts(concepts);
	await saveAllConceptInstances(instances);

	return { concept, instance };
}

export async function updateConceptTitleFromInstance(
	conceptId: string,
	instanceId: string,
	title: string,
	conflictMode: TitleConflictMode = 'report-conflict'
): Promise<
	| { status: 'ok'; concept: Concept; instance: ConceptInstance }
	| { status: 'title-conflict'; matchingConcepts: Concept[] }
	| { status: 'concept-not-found' }
	| { status: 'instance-not-found' }
> {

	
	const concepts = await getAllConcepts();
	const instances = await getAllConceptInstances();
	const concept = concepts.find((item) => item.id === conceptId);

	if (!concept) {
		return { status: 'concept-not-found' };
	}

	const instance = instances.find((item) => item.id === instanceId);

	if (!instance) {
		return { status: 'instance-not-found' };
	}

	const nextTitle = title.trim();
	const matchingConcepts = nextTitle
	? concepts.filter(
			(item) =>
				item.id !== concept.id &&
				item.title.trim().toLowerCase() === nextTitle.toLowerCase()
		)
	: [];

	if (
	matchingConcepts.length > 0 &&
	conflictMode === 'report-conflict'
) {
	return {
		status: 'title-conflict',
		matchingConcepts
	};
}

if (
	matchingConcepts.length > 0 &&
	conflictMode === 'use-existing'
) {
	const matchingConcept = matchingConcepts[0];

	instance.conceptId = matchingConcept.id;

	await saveAllConceptInstances(instances);

	return {
		status: 'ok',
		concept: matchingConcept,
		instance
	};
}

	const usageCount = instances.filter((item) => item.conceptId === concept.id).length;
	const canRenameInPlace = concept.title.trim() === '' && usageCount === 1;

	if (nextTitle && canRenameInPlace) {
		concept.title = nextTitle;
		await saveAllConcepts(concepts);
		return { status: 'ok', concept, instance };
	}

	const newConcept: Concept = {
		id: createConceptId(),
		title: nextTitle,
		properties: { ...concept.properties },
		tagConceptIds: [...concept.tagConceptIds]
	};

	concepts.push(newConcept);
	instance.conceptId = newConcept.id;

	await saveAllConcepts(concepts);
	await saveAllConceptInstances(instances);

	return { status: 'ok', concept: newConcept, instance };
}

import { isStringRecord, normalizeConceptNotes, normalizeConceptDates } from '$lib/model/metadata';
import type { CreateConceptInstanceInput } from '$lib/server/repositories/conceptInstanceRepository';
import type { Concept } from '$lib/model/Concept';
import type { TitleConflictMode, TitleConflictResolution } from '$lib/model/TitleConflictMode';
import type { ConceptInstance } from '$lib/model/ConceptInstance';
import {
	createConceptId,
	getAllConcepts,
	saveAllConcepts
} from '$lib/server/repositories/conceptRepository';
import {
	copyDescendantInstances,
	createConceptInstanceId,
	getAllConceptInstances,
	saveAllConceptInstances
} from '$lib/server/repositories/conceptInstanceRepository';
import { defaultConceptHeight, defaultConceptWidth } from '$lib/model/normalizeConceptInstance';

export type CreateConceptWithInstanceInput = Omit<CreateConceptInstanceInput, 'conceptId'> & {
	title?: string;
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
		tagIds: [],
		notes: normalizeConceptNotes(undefined),
		dates: normalizeConceptDates(undefined)
	};

	const instance: ConceptInstance = {
		...(typeof input.sequence === 'number' && Number.isFinite(input.sequence)
			? { sequence: input.sequence }
			: {}),
		id: createConceptInstanceId(),
		conceptId: concept.id,
		parentInstanceId: input.parentInstanceId ?? null,
		x: input.x ?? 32 + instances.length * 248,
		y: input.y ?? 32,
		width: input.width ?? defaultConceptWidth,
		height: input.height ?? defaultConceptHeight,
		lastCameraPanX: input.lastCameraPanX ?? 0,
		lastCameraPanY: input.lastCameraPanY ?? 0,
		lastCameraZoom: input.lastCameraZoom ?? 1,
		notes: normalizeConceptNotes(input.notes),
		properties: isStringRecord(input.properties) ? { ...input.properties } : {},
		view: input.view === 'notes' || input.view === 'metadata' ? input.view : 'tree',
		isPinned: typeof input.isPinned === 'boolean' ? input.isPinned : false
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
	conflictMode: TitleConflictMode = 'report-conflict',
	resolution?: TitleConflictResolution
): Promise<
	| { status: 'ok'; concept: Concept; instance: ConceptInstance }
	| { status: 'title-conflict'; matchingConcepts: Concept[] }
	| { status: 'concept-not-found' }
	| { status: 'instance-not-found' }
	| { status: 'invalid-resolution'; message: string }
	| { status: 'stale-instance'; message: string }
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

	if (instance.conceptId !== conceptId) {
		return { status: 'stale-instance', message: 'The instance no longer references this Concept.' };
	}

	const nextTitle = title.trim();
	const matchingConcepts = nextTitle
		? concepts.filter(
				(item) =>
					item.id !== concept.id && item.title.trim().toLowerCase() === nextTitle.toLowerCase()
			)
		: [];

	if (matchingConcepts.length > 0 && conflictMode === 'report-conflict') {
		return {
			status: 'title-conflict',
			matchingConcepts
		};
	}

	if (resolution !== undefined) {
		const invalid = (message: string) => ({ status: 'invalid-resolution' as const, message });
		if (conflictMode !== 'use-existing') {
			return invalid('A resolution requires use-existing mode.');
		}
		const selectedConcept = matchingConcepts.find((item) => item.id === resolution.targetConceptId);
		if (!selectedConcept) {
			return invalid('The selected Concept does not match the requested title.');
		}
		const source =
			resolution.sourceInstanceId === undefined
				? undefined
				: instances.find((item) => item.id === resolution.sourceInstanceId);
		if (
			resolution.sourceInstanceId !== undefined &&
			(!source ||
				source.conceptId !== selectedConcept.id ||
				instances.filter((item) => item.id === source.id).length !== 1)
		) {
			return invalid(
				'The source instance must belong to the selected Concept and have a unique ID.'
			);
		}
		if (
			!source &&
			(resolution.propertyKeys.length > 0 ||
				resolution.copyNotes ||
				resolution.copyChildren ||
				resolution.retainChildMetadata)
		) {
			return invalid('Copy options require a source instance.');
		}
		if (!source && instances.some((item) => item.conceptId === selectedConcept.id)) {
			return invalid('Choose a source instance for a placed Concept.');
		}
		if (source && resolution.propertyKeys.some((key) => !Object.hasOwn(source.properties, key))) {
			return invalid('A requested property is not an own property of the source instance.');
		}
		const properties = Object.fromEntries(
			resolution.propertyKeys.map((key) => [key, source!.properties[key]])
		);
		const destination: ConceptInstance =
			resolution.destination === 'new-instance'
				? {
						id: createConceptInstanceId(),
						conceptId: selectedConcept.id,
						parentInstanceId: instance.parentInstanceId,
						x: instance.x + instance.width + 24,
						y: instance.y,
						width: defaultConceptWidth,
						height: defaultConceptHeight,
						lastCameraPanX: 0,
						lastCameraPanY: 0,
						lastCameraZoom: 1,
						properties,
						notes: resolution.copyNotes
							? structuredClone(source!.notes)
							: normalizeConceptNotes(undefined),
						view: 'tree',
						isPinned: false
					}
				: {
						...structuredClone(instance),
						conceptId: selectedConcept.id,
						properties: { ...instance.properties, ...properties },
						notes: structuredClone(resolution.copyNotes ? source!.notes : instance.notes)
					};
		let children: ConceptInstance[] = [];
		if (resolution.copyChildren && source) {
			try {
				children = copyDescendantInstances(
					instances,
					source.id,
					destination.id,
					resolution.retainChildMetadata,
					new Set(concepts.map((item) => item.id))
				);
			} catch (error) {
				return invalid(error instanceof Error ? error.message : 'Invalid source subtree.');
			}
		}
		if (resolution.destination === 'new-instance') {
			instances.push(destination);
		} else {
			instances[instances.indexOf(instance)] = destination;
		}
		instances.push(...children);
		await saveAllConceptInstances(instances);
		return { status: 'ok', concept: selectedConcept, instance: destination };
	}

	if (matchingConcepts.length > 0 && conflictMode === 'use-existing') {
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
		...structuredClone(concept),
		id: createConceptId(),
		title: nextTitle
	};

	concepts.push(newConcept);
	instance.conceptId = newConcept.id;

	await saveAllConcepts(concepts);
	await saveAllConceptInstances(instances);

	return { status: 'ok', concept: newConcept, instance };
}

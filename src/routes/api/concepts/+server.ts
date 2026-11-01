import { isConceptNotes, isConceptDates, isConceptAppearance } from '$lib/model/metadata';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import {
	createConceptWithInstance,
	updateConceptTitleFromInstance,
	type CreateConceptWithInstanceInput
} from '$lib/server/conceptService';
import type { TitleConflictMode, TitleConflictResolution } from '$lib/model/TitleConflictMode';

import { updateConcept, type UpdateConceptInput } from '$lib/server/repositories/conceptRepository';

export const POST: RequestHandler = async ({ request }) => {
	const input = ((await request.json().catch(() => ({}))) ?? {}) as CreateConceptWithInstanceInput;

	const result = await createConceptWithInstance(input);

	return json(result, { status: 201 });
};

export const PATCH: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as Record<string, unknown>;

	const id = typeof body.id === 'string' ? body.id : undefined;

	if (!id) {
		return json({ error: 'Concept id is required.' }, { status: 400 });
	}

	if (typeof body.title === 'string') {
		const instanceId = typeof body.instanceId === 'string' ? body.instanceId : undefined;

		if (!instanceId) {
			return json(
				{
					error: 'Concept instance id is required when changing title.'
				},
				{ status: 400 }
			);
		}

		const conflictMode: TitleConflictMode =
			body.conflictMode === 'use-existing' || body.conflictMode === 'create-duplicate'
				? body.conflictMode
				: 'report-conflict';

		let resolution: TitleConflictResolution | undefined;
		if (body.resolution !== undefined) {
			const value = body.resolution;
			if (
				typeof value !== 'object' ||
				value === null ||
				Array.isArray(value) ||
				!('targetConceptId' in value) ||
				typeof value.targetConceptId !== 'string' ||
				('sourceInstanceId' in value && typeof value.sourceInstanceId !== 'string') ||
				!('destination' in value) ||
				(value.destination !== 'current-instance' && value.destination !== 'new-instance') ||
				!('propertyKeys' in value) ||
				!Array.isArray(value.propertyKeys) ||
				!value.propertyKeys.every((key) => typeof key === 'string') ||
				!('copyNotes' in value) ||
				typeof value.copyNotes !== 'boolean' ||
				!('copyChildren' in value) ||
				typeof value.copyChildren !== 'boolean' ||
				!('retainChildMetadata' in value) ||
				typeof value.retainChildMetadata !== 'boolean'
			) {
				return json(
					{ error: 'Invalid title resolution.', message: 'Invalid title resolution.' },
					{ status: 400 }
				);
			}
			resolution = {
				targetConceptId: value.targetConceptId,
				...('sourceInstanceId' in value && typeof value.sourceInstanceId === 'string'
					? { sourceInstanceId: value.sourceInstanceId }
					: {}),
				destination: value.destination,
				propertyKeys: value.propertyKeys,
				copyNotes: value.copyNotes,
				copyChildren: value.copyChildren,
				retainChildMetadata: value.retainChildMetadata
			};
		}
		const result = await updateConceptTitleFromInstance(
			id,
			instanceId,
			body.title,
			conflictMode,
			resolution
		);
		if (result.status === 'invalid-resolution' || result.status === 'stale-instance') {
			return json(
				{ error: result.message, message: result.message },
				{
					status: result.status === 'stale-instance' ? 409 : 400
				}
			);
		}

		if (result.status === 'concept-not-found') {
			return json({ error: 'Concept not found.' }, { status: 404 });
		}

		if (result.status === 'instance-not-found') {
			return json({ error: 'Concept instance not found.' }, { status: 404 });
		}

		if (result.status === 'title-conflict') {
			return json(
				{
					error: 'A concept with this title already exists.',
					code: 'TITLE_CONFLICT',
					matchingConcepts: result.matchingConcepts
				},
				{ status: 409 }
			);
		}

		return json({
			concept: result.concept,
			instance: result.instance
		});
	}

	const updates: UpdateConceptInput = {};

	if (
		typeof body.properties === 'object' &&
		body.properties !== null &&
		!Array.isArray(body.properties)
	) {
		updates.properties = body.properties as Record<string, string>;
	}

	if (Array.isArray(body.tagIds)) {
		updates.tagIds = body.tagIds.filter((value): value is string => typeof value === 'string');
	}

	if (isConceptNotes(body.notes)) updates.notes = body.notes;
	if (isConceptDates(body.dates)) updates.dates = body.dates;
	if (isConceptAppearance(body.appearance)) updates.appearance = body.appearance;

	const concept = await updateConcept(id, updates);

	if (!concept) {
		return json({ error: 'Concept not found.' }, { status: 404 });
	}

	return json(concept);
};

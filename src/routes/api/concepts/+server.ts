import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import {
	createConceptWithInstance,
	updateConceptTitleFromInstance,
	type CreateConceptWithInstanceInput,
	type TitleConflictMode
} from '$lib/services/conceptService';

import {
	updateConcept,
	type UpdateConceptInput
} from '$lib/repositories/conceptRepository';

export const POST: RequestHandler = async ({ request }) => {
	const input = ((await request.json().catch(() => ({}))) ??
		{}) as CreateConceptWithInstanceInput;

	const result = await createConceptWithInstance(input);

	return json(result, { status: 201 });
};

export const PATCH: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as Record<string, unknown>;

	const id = typeof body.id === 'string' ? body.id : undefined;

	if (!id) {
		return json(
			{ error: 'Concept id is required.' },
			{ status: 400 }
		);
	}

	if (typeof body.title === 'string') {
		const instanceId =
			typeof body.instanceId === 'string'
				? body.instanceId
				: undefined;

		if (!instanceId) {
			return json(
				{
					error:
						'Concept instance id is required when changing title.'
				},
				{ status: 400 }
			);
		}

		const conflictMode: TitleConflictMode =
			body.conflictMode === 'use-existing' ||
			body.conflictMode === 'create-duplicate'
				? body.conflictMode
				: 'report-conflict';

		const result = await updateConceptTitleFromInstance(
			id,
			instanceId,
			body.title,
			conflictMode
		);

		if (result.status === 'concept-not-found') {
			return json(
				{ error: 'Concept not found.' },
				{ status: 404 }
			);
		}

		if (result.status === 'instance-not-found') {
			return json(
				{ error: 'Concept instance not found.' },
				{ status: 404 }
			);
		}

		if (result.status === 'title-conflict') {
			return json(
				{
					error:
						'A concept with this title already exists.',
					code: 'TITLE_CONFLICT',
					matchingConcepts:
						result.matchingConcepts
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
		updates.properties =
			body.properties as Record<string, string>;
	}

	if (Array.isArray(body.tagConceptIds)) {
		updates.tagConceptIds =
			body.tagConceptIds.filter(
				(value): value is string =>
					typeof value === 'string'
			);
	}

	const concept = await updateConcept(id, updates);

	if (!concept) {
		return json(
			{ error: 'Concept not found.' },
			{ status: 404 }
		);
	}

	return json(concept);
};
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	updateConceptInstancesBatch,
	type ConceptInstanceBatchUpdate
} from '$lib/repositories/conceptInstanceRepository';

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const PATCH: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as unknown;

	if (!isPlainObject(body) || !Array.isArray(body.updates)) {
		return json({ error: 'Expected body.updates to be an array.' }, { status: 400 });
	}

	const updates = body.updates.filter(
		(item): item is ConceptInstanceBatchUpdate =>
			isPlainObject(item) &&
			typeof item.id === 'string' &&
			isPlainObject(item.updates)
	);

	const updated = await updateConceptInstancesBatch(updates);
	return json({ updated });
};

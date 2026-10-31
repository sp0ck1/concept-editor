import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	deleteConceptInstancesBatch,
	updateConceptInstancesBatch,
	type ConceptInstanceBatchUpdate
} from '$lib/server/repositories/conceptInstanceRepository';

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
			isPlainObject(item) && typeof item.id === 'string' && isPlainObject(item.updates)
	);

	const updated = await updateConceptInstancesBatch(updates);
	return json({ updated });
};

export const DELETE: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Expected a JSON body with a nonempty ids array.' }, { status: 400 });
	}

	if (
		!isPlainObject(body) ||
		!Array.isArray(body.ids) ||
		body.ids.length === 0 ||
		!body.ids.every((id: unknown) => typeof id === 'string' && id.length > 0)
	) {
		return json({ error: 'Expected a JSON body with a nonempty ids array.' }, { status: 400 });
	}

	const deleted = await deleteConceptInstancesBatch(body.ids);
	return json({ deleted });
};

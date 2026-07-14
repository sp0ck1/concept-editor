import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	deleteConceptInstance,
	updateConceptInstance,
	type UpdateConceptInstanceInput
} from '$lib/repositories/conceptInstanceRepository';

export const PATCH: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as Record<string, unknown>;
	const id = typeof body.id === 'string' ? body.id : undefined;

	if (!id) {
		return json({ error: 'Concept instance id is required.' }, { status: 400 });
	}

	const updates = body as UpdateConceptInstanceInput;
	const instance = await updateConceptInstance(id, updates);

	if (!instance) {
		return json({ error: 'Concept instance not found.' }, { status: 404 });
	}

	return json(instance);
};

export const DELETE: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as { id?: unknown };
	const id = typeof body.id === 'string' ? body.id : undefined;

	if (!id) {
		return json({ error: 'Concept instance id is required.' }, { status: 400 });
	}

	const deleted = await deleteConceptInstance(id);

	if (!deleted) {
		return json({ error: 'Concept instance not found.' }, { status: 404 });
	}

	return new Response(null, { status: 204 });
};

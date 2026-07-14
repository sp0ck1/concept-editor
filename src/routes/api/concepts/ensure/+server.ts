import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ensureConceptByTitle } from '$lib/repositories/conceptRepository';

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as { title?: unknown };
	const title = typeof body.title === 'string' ? body.title.trim() : '';

	if (!title) {
		return json({ error: 'Concept title is required.' }, { status: 400 });
	}

	const result = await ensureConceptByTitle(title);
	return json(result, { status: result.created ? 201 : 200 });
};

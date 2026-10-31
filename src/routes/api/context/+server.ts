import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Context } from '$lib/model/Context';
import { updateContext } from '$lib/server/repositories/contextRepository';

export const PATCH: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Context updates must be a JSON object.' }, { status: 400 });
	}
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		return json({ error: 'Context updates must be a JSON object.' }, { status: 400 });
	}

	const context = await updateContext(body as Partial<Omit<Context, 'id'>>);
	return json(context);
};

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { materializeTag, type CreateTagInstanceInput } from '$lib/server/tagService';
import { TagCommandError } from '$lib/server/repositories/tagRepository';

export const POST: RequestHandler = async ({ request, params }) => {
	const body: unknown = await request.json().catch(() => null);
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return json({ error: 'Tag placement must be a JSON object.' }, { status: 400 });
	}
	const input = body as CreateTagInstanceInput;
	try {
		const result = await materializeTag(params.id, {
			parentInstanceId: input.parentInstanceId,
			x: input.x,
			y: input.y
		});
		return json(result, { status: 201 });
	} catch (error) {
		if (error instanceof TagCommandError)
			return json({ error: error.message }, { status: error.status });
		throw error;
	}
};

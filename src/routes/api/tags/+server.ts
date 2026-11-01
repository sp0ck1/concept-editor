import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ensureTag, TagCommandError } from '$lib/server/repositories/tagRepository';

export const POST: RequestHandler = async ({ request }) => {
	const body: unknown = await request.json().catch(() => null);
	if (
		!body ||
		typeof body !== 'object' ||
		Array.isArray(body) ||
		!('title' in body) ||
		typeof body.title !== 'string'
	) {
		return json({ error: 'Tag title is required.' }, { status: 400 });
	}
	if (
		'representedByConceptId' in body &&
		(typeof body.representedByConceptId !== 'string' || !body.representedByConceptId.trim())
	) {
		return json({ error: 'A valid source Concept ID is required.' }, { status: 400 });
	}
	try {
		const result = await ensureTag(
			body.title,
			'representedByConceptId' in body ? (body.representedByConceptId as string) : undefined
		);
		return json(result, { status: result.created ? 201 : 200 });
	} catch (error) {
		if (error instanceof TagCommandError)
			return json({ error: error.message }, { status: error.status });
		throw error;
	}
};

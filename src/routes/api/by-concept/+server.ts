import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllConceptRelationships } from '$lib/repositories/conceptRelationshipRepository';
import { getRelationshipsForConcept } from '$lib/queries/conceptRelationshipQueries';

export const GET: RequestHandler = async ({ url }) => {
	const conceptId = url.searchParams.get('conceptId');

	if (!conceptId) {
		return json({ error: 'conceptId is required.' }, { status: 400 });
	}

	const relationships = await getAllConceptRelationships();

	const results = getRelationshipsForConcept(
		relationships,
		conceptId
	);

	return json(results);
};
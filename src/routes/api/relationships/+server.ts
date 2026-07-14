import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createConceptRelationship,
	deleteConceptRelationship,
	getAllConceptRelationships,
	updateConceptRelationship,
	type CreateConceptRelationshipInput,
	type UpdateConceptRelationshipInput
} from '$lib/repositories/conceptRelationshipRepository';

export const GET: RequestHandler = async () => {
	return json(await getAllConceptRelationships());
};

export const POST: RequestHandler = async ({ request }) => {
	const input = (await request.json()) as CreateConceptRelationshipInput;

	if (
		!input.relationshipConceptId ||
		!Array.isArray(input.participantGroups)
	) {
		return json(
			{
				error:
					'relationshipConceptId and participantGroups are required.'
			},
			{ status: 400 }
		);
	}

	const relationship = await createConceptRelationship(input);

	return json(relationship, { status: 201 });
};

export const PATCH: RequestHandler = async ({ request }) => {
	const input = (await request.json()) as UpdateConceptRelationshipInput;

	if (!input.id) {
		return json({ error: 'id is required.' }, { status: 400 });
	}

	const relationship = await updateConceptRelationship(input);

	if (!relationship) {
		return json(
			{ error: `Relationship ${input.id} was not found.` },
			{ status: 404 }
		);
	}

	return json(relationship);
};

export const DELETE: RequestHandler = async ({ request }) => {
	const input = (await request.json()) as { id?: string };

	if (!input.id) {
		return json({ error: 'id is required.' }, { status: 400 });
	}

	const deleted = await deleteConceptRelationship(input.id);

	if (!deleted) {
		return json(
			{ error: `Relationship ${input.id} was not found.` },
			{ status: 404 }
		);
	}

	return new Response(null, { status: 204 });
};

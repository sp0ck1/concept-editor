import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getAllConceptInstances,
	importChildrenFromConceptInstance
} from '$lib/repositories/conceptInstanceRepository';

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as Record<string, unknown>;
	const sourceInstanceId =
		typeof body.sourceInstanceId === 'string' ? body.sourceInstanceId : undefined;
	const targetInstanceId =
		typeof body.targetInstanceId === 'string' ? body.targetInstanceId : undefined;

	if (!sourceInstanceId || !targetInstanceId) {
		return json(
			{ error: 'sourceInstanceId and targetInstanceId are required.' },
			{ status: 400 }
		);
	}

	if (sourceInstanceId === targetInstanceId) {
		return json(
			{ error: 'Cannot import children from the same instance.' },
			{ status: 400 }
		);
	}

	const instances = await getAllConceptInstances();
	const sourceInstance = instances.find((instance) => instance.id === sourceInstanceId);
	const targetInstance = instances.find((instance) => instance.id === targetInstanceId);

	if (!sourceInstance || !targetInstance) {
		return json({ error: 'Source or target instance not found.' }, { status: 404 });
	}

	if (sourceInstance.conceptId !== targetInstance.conceptId) {
		return json(
			{ error: 'Source and target must be instances of the same concept.' },
			{ status: 400 }
		);
	}

	const result = await importChildrenFromConceptInstance(
		sourceInstanceId,
		targetInstanceId
	);

	return json(result);
};

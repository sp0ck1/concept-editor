import { json } from '@sveltejs/kit';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from './$types';
import type { ConceptInstance } from '$lib/types/ConceptInstance';

const instancesPath = path.resolve('src/lib/data/concept_instances.json');

type InstanceBatchUpdate = {
	id: string;
	updates: Partial<Omit<ConceptInstance, 'id' | 'conceptId'>>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeInstanceUpdates(
	updates: Partial<Omit<ConceptInstance, 'id' | 'conceptId'>>
): Partial<Omit<ConceptInstance, 'id' | 'conceptId'>> {
	const sanitized: Partial<Omit<ConceptInstance, 'id' | 'conceptId'>> = {};

	if ('parentInstanceId' in updates) {
		sanitized.parentInstanceId = updates.parentInstanceId ?? null;
	}

	if (typeof updates.x === 'number' && Number.isFinite(updates.x)) {
		sanitized.x = updates.x;
	}

	if (typeof updates.y === 'number' && Number.isFinite(updates.y)) {
		sanitized.y = updates.y;
	}

	if (typeof updates.width === 'number' && Number.isFinite(updates.width)) {
		sanitized.width = updates.width;
	}

	if (typeof updates.height === 'number' && Number.isFinite(updates.height)) {
		sanitized.height = updates.height;
	}

	return sanitized;
}

export const PATCH: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as unknown;

	if (!isPlainObject(body) || !Array.isArray(body.updates)) {
		return json({ error: 'Expected body.updates to be an array' }, { status: 400 });
	}

	const requestedUpdates = body.updates
		.filter((item): item is InstanceBatchUpdate => {
			return (
				isPlainObject(item) &&
				typeof item.id === 'string' &&
				isPlainObject(item.updates)
			);
		})
		.map((item) => ({
			id: item.id,
			updates: sanitizeInstanceUpdates(item.updates)
		}))
		.filter((item) => Object.keys(item.updates).length > 0);

	if (requestedUpdates.length === 0) {
		return json({ updated: 0 });
	}

	const instances = JSON.parse(await readFile(instancesPath, 'utf-8')) as ConceptInstance[];

	const instancesById = new Map(instances.map((instance) => [instance.id, instance]));

	let updated = 0;

	for (const item of requestedUpdates) {
		const instance = instancesById.get(item.id);

		if (!instance) {
			continue;
		}

		Object.assign(instance, item.updates);
		updated += 1;
	}

	await writeFile(instancesPath, `${JSON.stringify(instances, null, 2)}\n`);

	return json({ updated });
};
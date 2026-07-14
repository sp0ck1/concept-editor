import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ConceptInstance } from '$lib/types/ConceptInstance';
import {
	defaultConceptHeight,
	defaultConceptWidth,
	normalizeConceptInstance
} from '$lib/concepts/normalizeConceptInstance';

const instancesPath = path.resolve(
	process.cwd(),
	'src/lib/data/concept_instances.json'
);

export type CreateConceptInstanceInput = {
	conceptId: string;
	parentInstanceId?: string | null;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	lastCameraPanX?: number;
	lastCameraPanY?: number;
	lastCameraZoom?: number;
};

export type UpdateConceptInstanceInput = Partial<
	Omit<ConceptInstance, 'id' | 'conceptId'>
>;

export type ConceptInstanceBatchUpdate = {
	id: string;
	updates: UpdateConceptInstanceInput;
};

export async function getAllConceptInstances(): Promise<ConceptInstance[]> {
	const file = await readFile(instancesPath, 'utf8');
	const rawInstances = JSON.parse(file) as Partial<ConceptInstance>[];

	return rawInstances.map((instance, index) =>
		normalizeConceptInstance(instance, index)
	);
}

export async function saveAllConceptInstances(
	instances: ConceptInstance[]
): Promise<void> {
	await writeFile(instancesPath, `${JSON.stringify(instances, null, 2)}\n`, 'utf8');
}

export function createConceptInstanceId(): string {
	return `instance-${crypto.randomUUID()}`;
}

export async function createConceptInstance(
	input: CreateConceptInstanceInput
): Promise<ConceptInstance> {
	const instances = await getAllConceptInstances();

	const instance: ConceptInstance = {
		id: createConceptInstanceId(),
		conceptId: input.conceptId,
		parentInstanceId: input.parentInstanceId ?? null,
		x: input.x ?? 32 + instances.length * 248,
		y: input.y ?? 32,
		width: input.width ?? defaultConceptWidth,
		height: input.height ?? defaultConceptHeight,
		lastCameraPanX: input.lastCameraPanX ?? 0,
		lastCameraPanY: input.lastCameraPanY ?? 0,
		lastCameraZoom: input.lastCameraZoom ?? 1
	};

	instances.push(instance);
	await saveAllConceptInstances(instances);

	return instance;
}

export async function updateConceptInstance(
	id: string,
	updates: UpdateConceptInstanceInput
): Promise<ConceptInstance | null> {
	const instances = await getAllConceptInstances();
	const instance = instances.find((item) => item.id === id);

	if (!instance) {
		return null;
	}

	const numberFields = [
		'x',
		'y',
		'width',
		'height',
		'lastCameraPanX',
		'lastCameraPanY',
		'lastCameraZoom'
	] as const;

	for (const field of numberFields) {
		const value = updates[field];
		if (typeof value === 'number' && Number.isFinite(value)) {
			instance[field] = value;
		}
	}

	if (
		updates.parentInstanceId === null ||
		typeof updates.parentInstanceId === 'string'
	) {
		instance.parentInstanceId = updates.parentInstanceId;
	}

	await saveAllConceptInstances(instances);
	return instance;
}

export async function updateConceptInstancesBatch(
	requestedUpdates: ConceptInstanceBatchUpdate[]
): Promise<number> {
	const instances = await getAllConceptInstances();
	const instancesById = new Map(instances.map((instance) => [instance.id, instance]));

	let updated = 0;

	for (const item of requestedUpdates) {
		const instance = instancesById.get(item.id);
		if (!instance) {
			continue;
		}

		const next = await applyConceptInstanceUpdates(instance, item.updates);
		if (next) {
			updated += 1;
		}
	}

	if (updated > 0) {
		await saveAllConceptInstances(instances);
	}

	return updated;
}

async function applyConceptInstanceUpdates(
	instance: ConceptInstance,
	updates: UpdateConceptInstanceInput
): Promise<boolean> {
	let changed = false;

	const numberFields = ['x', 'y', 'width', 'height'] as const;

	for (const field of numberFields) {
		const value = updates[field];
		if (typeof value === 'number' && Number.isFinite(value)) {
			instance[field] = value;
			changed = true;
		}
	}

	if ('parentInstanceId' in updates) {
		instance.parentInstanceId = updates.parentInstanceId ?? null;
		changed = true;
	}

	return changed;
}

export async function deleteConceptInstance(id: string): Promise<boolean> {
	const instances = await getAllConceptInstances();
	const nextInstances = instances.filter((instance) => instance.id !== id);

	if (nextInstances.length === instances.length) {
		return false;
	}

	await saveAllConceptInstances(nextInstances);
	return true;
}

export async function importChildrenFromConceptInstance(
	sourceInstanceId: string,
	targetInstanceId: string
): Promise<{ importedCount: number; instances: ConceptInstance[] } | null> {
	const instances = await getAllConceptInstances();
	const sourceInstance = instances.find((instance) => instance.id === sourceInstanceId);
	const targetInstance = instances.find((instance) => instance.id === targetInstanceId);

	if (!sourceInstance || !targetInstance) {
		return null;
	}

	const sourceChildren = instances.filter(
		(instance) => instance.parentInstanceId === sourceInstanceId
	);
	const targetChildren = instances.filter(
		(instance) => instance.parentInstanceId === targetInstanceId
	);
	const targetChildConceptIds = new Set(
		targetChildren.map((instance) => instance.conceptId)
	);
	const newChildren: ConceptInstance[] = [];

	for (const child of sourceChildren) {
		if (targetChildConceptIds.has(child.conceptId)) {
			continue;
		}

		const childIndex = targetChildren.length + newChildren.length;

		newChildren.push({
			...child,
			id: createConceptInstanceId(),
			parentInstanceId: targetInstanceId,
			x: 32 + childIndex * 24,
			y: 32 + childIndex * 24
		});

		targetChildConceptIds.add(child.conceptId);
	}

	if (newChildren.length > 0) {
		instances.push(...newChildren);
		await saveAllConceptInstances(instances);
	}

	return {
		importedCount: newChildren.length,
		instances: newChildren
	};
}

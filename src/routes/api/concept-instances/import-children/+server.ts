import { json } from '@sveltejs/kit';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ConceptInstance } from '$lib/types/ConceptInstance';
import { normalizeConceptInstance } from '$lib/concepts/normalizeConceptInstance';

const instancesPath = path.resolve('src/lib/data/concept_instances.json');

async function readInstances() {
  const file = await readFile(instancesPath, 'utf-8');
  const rawInstances = JSON.parse(file) as Partial<ConceptInstance>[];

  return rawInstances.map((instance, index) =>
    normalizeConceptInstance(instance, index)
  );
}

async function writeInstances(instances: ConceptInstance[]) {
  await writeFile(instancesPath, JSON.stringify(instances, null, 2), 'utf-8');
}

function createInstanceId() {
  return `instance-${crypto.randomUUID()}`;
}

export async function POST({ request }) {
  const body = await request.json();

  const sourceInstanceId = body.sourceInstanceId as string | undefined;
  const targetInstanceId = body.targetInstanceId as string | undefined;

  if (!sourceInstanceId || !targetInstanceId) {
    return json(
      { message: 'sourceInstanceId and targetInstanceId are required.' },
      { status: 400 }
    );
  }

  if (sourceInstanceId === targetInstanceId) {
    return json(
      { message: 'Cannot import children from the same instance.' },
      { status: 400 }
    );
  }

  const instances = await readInstances();

  const sourceInstance = instances.find(
    (instance) => instance.id === sourceInstanceId
  );

  const targetInstance = instances.find(
    (instance) => instance.id === targetInstanceId
  );

  if (!sourceInstance || !targetInstance) {
    return json(
      { message: 'Source or target instance not found.' },
      { status: 404 }
    );
  }

  if (sourceInstance.conceptId !== targetInstance.conceptId) {
    return json(
      { message: 'Source and target must be instances of the same concept.' },
      { status: 400 }
    );
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
      id: createInstanceId(),
      parentInstanceId: targetInstanceId,
      x: 32 + childIndex * 24,
      y: 32 + childIndex * 24
    });

    targetChildConceptIds.add(child.conceptId);
  }

  instances.push(...newChildren);

  await writeInstances(instances);

  return json({
    importedCount: newChildren.length,
    instances: newChildren
  });
}
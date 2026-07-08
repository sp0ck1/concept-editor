import { json } from '@sveltejs/kit';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ConceptInstance } from '$lib/types/ConceptInstance';
import { normalizeConceptInstance } from '$lib/concepts/normalizeConceptInstance';

const filePath = path.resolve('src/lib/data/concept_instances.json');

async function readInstances() {
  const file = await readFile(filePath, 'utf-8');
  const rawInstances = JSON.parse(file) as Partial<ConceptInstance>[];

  return rawInstances.map((instance, index) =>
    normalizeConceptInstance(instance, index)
  );
}

async function writeInstances(instances: ConceptInstance[]) {
  await writeFile(filePath, JSON.stringify(instances, null, 2), 'utf-8');
}

export async function PATCH({ request }) {
  const body = await request.json();

  const id = body.id as string | undefined;

  if (!id) {
    return json({ message: 'Concept instance id is required.' }, { status: 400 });
  }

  const instances = await readInstances();
  const instance = instances.find((item) => item.id === id);

  if (!instance) {
    return json({ message: 'Concept instance not found.' }, { status: 404 });
  }

  if (typeof body.x === 'number') {
    instance.x = body.x;
  }

  if (typeof body.y === 'number') {
    instance.y = body.y;
  }

  if (typeof body.width === 'number') {
    instance.width = body.width;
  }

  if (typeof body.height === 'number') {
    instance.height = body.height;
  }

  if (
    body.parentInstanceId === null ||
    typeof body.parentInstanceId === 'string'
  ) {
    instance.parentInstanceId = body.parentInstanceId;
  }

  await writeInstances(instances);

  return json(instance);
}

export async function DELETE({ request }) {
  const body = await request.json();

  const id = body.id as string | undefined;

  if (!id) {
    return json({ message: 'Concept instance id is required.' }, { status: 400 });
  }

  const instances = await readInstances();
  const nextInstances = instances.filter((instance) => instance.id !== id);

  if (nextInstances.length === instances.length) {
    return json({ message: 'Concept instance not found.' }, { status: 404 });
  }

  await writeInstances(nextInstances);

  return json({ id });
}
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UpdateConceptInput } from './conceptRepository';
import type { UpdateConceptInstanceInput } from './conceptInstanceRepository';
let directory: string;
let concepts: typeof import('./conceptRepository');
let instances: typeof import('./conceptInstanceRepository');
let service: typeof import('../conceptService');
const notes = { format: 'plain' as const, text: 'Saved notes' };
const metadata = {
	notes,
	properties: { shared: 'saved' },
	tagConceptIds: ['tag'],
	dates: [
		{ date: '2024-02-29', dateLabel: 'Started' },
		{ date: '', dateLabel: 'Undated' }
	],
	appearance: {
		backgroundColor: 'blue',
		backgroundLayers: [
			{
				source: { type: 'asset' as const, reference: 'asset-1' },
				position: 'center',
				size: 'cover',
				repeat: 'no-repeat',
				origin: 'padding-box',
				clip: 'border-box',
				attachment: 'scroll',
				blendMode: 'normal'
			},
			{ source: { type: 'gradient' as const, value: 'linear-gradient(red, blue)' } }
		]
	}
};
const localMetadata = {
	notes,
	properties: { local: 'saved' },
	view: 'notes' as const,
	isPinned: true,
	sequence: 4
};
async function writeRecords(file: string, records: unknown[]) {
	await writeFile(path.join(directory, 'src/lib/data', file), JSON.stringify(records));
}
beforeEach(async () => {
	directory = await mkdtemp(path.join(os.tmpdir(), 'concept-model-persistence-'));
	await mkdir(path.join(directory, 'src/lib/data'), { recursive: true });
	await writeRecords('concepts.json', []);
	await writeRecords('concept_instances.json', []);
	vi.resetModules();
	// Paths resolve at import time: mutation tests must never use live data.
	vi.spyOn(process, 'cwd').mockReturnValue(directory);
	concepts = await import('./conceptRepository');
	instances = await import('./conceptInstanceRepository');
	service = await import('../conceptService');
});
afterEach(async () => {
	vi.restoreAllMocks();
	vi.resetModules();
	if (directory) await rm(directory, { recursive: true, force: true });
});
describe('expanded model persistence', () => {
	it('creates defaults through every creation path, preserving camera defaults', async () => {
		const concept = await concepts.createConcept(' First ');
		const ensured = await concepts.ensureConceptByTitle('Second');
		const instance = await instances.createConceptInstance({ conceptId: concept.id });
		const pair = await service.createConceptWithInstance({ title: ' Third ' });
		for (const item of [concept, ensured.concept, pair.concept])
			expect(item).toMatchObject({
				notes: { format: 'plain', text: '' },
				dates: [],
				properties: {},
				tagConceptIds: []
			});
		for (const item of [instance, pair.instance])
			expect(item).toMatchObject({
				notes: { format: 'plain', text: '' },
				properties: {},
				view: 'tree',
				isPinned: false,
				lastCameraZoom: 1,
				width: 350,
				height: 250
			});
		expect(concept.title).toBe('First');
		expect(pair.concept.title).toBe('Third');
		expect((await concepts.ensureConceptByTitle('first')).created).toBe(false);
		expect(await concepts.getAllConcepts()).toContainEqual(pair.concept);
		expect(await instances.getAllConceptInstances()).toContainEqual(pair.instance);
	});
	it('loads legacy records without rewriting files', async () => {
		await writeRecords('concepts.json', [{ id: 'legacy', title: 'Legacy' }]);
		await writeRecords('concept_instances.json', [{ id: 'legacy-instance', conceptId: 'legacy' }]);
		expect(await concepts.getAllConcepts()).toEqual([
			expect.objectContaining({ notes: { format: 'plain', text: '' }, dates: [] })
		]);
		expect(await instances.getAllConceptInstances()).toEqual([
			expect.objectContaining({
				notes: { format: 'plain', text: '' },
				properties: {},
				view: 'tree',
				isPinned: false,
				lastCameraZoom: 0
			})
		]);
		expect(
			JSON.parse(await readFile(path.join(directory, 'src/lib/data/concepts.json'), 'utf8'))
		).toEqual([{ id: 'legacy', title: 'Legacy' }]);
	});
	it('accepts creation metadata without retaining nested caller references', async () => {
		const input = structuredClone(metadata);
		const local = structuredClone(localMetadata);
		const concept = await concepts.createConcept('Full', input);
		const instance = await instances.createConceptInstance({ conceptId: concept.id, ...local });
		const pair = await service.createConceptWithInstance({ title: 'Pair', ...local });
		input.notes.text = 'changed';
		input.dates[0].dateLabel = 'changed';
		input.appearance.backgroundLayers[0].source = { type: 'asset', reference: 'changed' };
		local.notes.text = 'changed';
		local.properties.local = 'changed';
		expect(concept).toMatchObject(metadata);
		expect(instance).toMatchObject(localMetadata);
		expect(pair.instance).toMatchObject(localMetadata);
	});
	it('updates nonempty Concept metadata with independent nested copies', async () => {
		const concept = await concepts.createConcept('Updated');
		const input = structuredClone(metadata);
		const result = await concepts.updateConcept(concept.id, input);
		input.notes.text = 'changed caller';
		input.dates[0].dateLabel = 'changed caller';
		input.appearance.backgroundLayers[0].source = { type: 'asset', reference: 'changed caller' };
		expect(result).toMatchObject(metadata);
		expect(await concepts.getConceptById(concept.id)).toEqual(result);
	});
	it('ignores invalid or omitted Concept metadata and accepts clearing', async () => {
		const concept = await concepts.createConcept('Full', structuredClone(metadata));
		for (const invalid of [
			{},
			{ notes: { format: 'markdown', text: 'bad' } },
			{ notes: { format: 'plain', text: 1 } },
			{ dates: [{ date: '2023-02-29', dateLabel: 'bad' }] },
			{ dates: [{ date: '2024-01-01', dateLabel: 1 }] },
			{ appearance: null },
			{ appearance: { backgroundLayers: [{ source: { type: 'asset', reference: 1 } }] } }
		]) {
			await concepts.updateConcept(concept.id, invalid as unknown as UpdateConceptInput);
			expect(await concepts.getConceptById(concept.id)).toEqual(concept);
		}
		const result = await concepts.updateConcept(concept.id, {
			notes: { format: 'plain', text: '' },
			dates: [],
			appearance: {}
		});
		expect(result).toMatchObject({
			notes: { format: 'plain', text: '' },
			dates: [],
			properties: metadata.properties,
			tagConceptIds: metadata.tagConceptIds
		});
		expect(result?.appearance ?? {}).toEqual({});
		expect((await concepts.getConceptById(concept.id))?.appearance ?? {}).toEqual({});
	});
	for (const batch of [false, true]) {
		it(
			'validates, preserves and clears instance metadata via ' +
				(batch ? 'batch' : 'single') +
				' updates',
			async () => {
				const instance = await instances.createConceptInstance({
					conceptId: 'concept',
					parentInstanceId: 'parent',
					...structuredClone(localMetadata)
				});
				const update = async (updates: UpdateConceptInstanceInput) =>
					batch
						? instances.updateConceptInstancesBatch([{ id: instance.id, updates }])
						: instances.updateConceptInstance(instance.id, updates);
				await update({});
				await update({
					notes: { format: 'bad', text: 'bad' },
					properties: { invalid: 1 },
					view: 'bad',
					isPinned: 1,
					parentInstanceId: undefined
				} as unknown as UpdateConceptInstanceInput);
				expect((await instances.getAllConceptInstances())[0]).toEqual(instance);
				await update({
					notes: { format: 'plain', text: '' },
					properties: {},
					view: 'metadata',
					isPinned: false,
					x: 0,
					lastCameraPanX: 0,
					lastCameraPanY: 12,
					lastCameraZoom: 2
				});
				expect((await instances.getAllConceptInstances())[0]).toMatchObject({
					notes: { format: 'plain', text: '' },
					properties: {},
					view: 'metadata',
					isPinned: false,
					parentInstanceId: 'parent',
					x: 0,
					lastCameraPanX: 0,
					lastCameraPanY: 12,
					lastCameraZoom: 2
				});
				await update({ view: 'tree', parentInstanceId: null });
				expect((await instances.getAllConceptInstances())[0]).toMatchObject({
					view: 'tree',
					parentInstanceId: null
				});
			}
		);
	}
	it('clones all Concept metadata on title reassignment while preserving the instance', async () => {
		const concept = await concepts.createConcept('Original', structuredClone(metadata));
		const instance = await instances.createConceptInstance({
			conceptId: concept.id,
			...structuredClone(localMetadata),
			lastCameraZoom: 3
		});
		const child = await instances.createConceptInstance({
			conceptId: 'child',
			parentInstanceId: instance.id
		});
		const result = await service.updateConceptTitleFromInstance(concept.id, instance.id, 'Renamed');
		if (result.status !== 'ok') throw new Error('Title reassignment failed');
		expect(result.concept.id).not.toBe(concept.id);
		expect(result.concept).toMatchObject({ ...metadata, title: 'Renamed' });
		expect(result.instance).toEqual({ ...instance, conceptId: result.concept.id });
		result.concept.notes.text = 'Changed clone';
		result.concept.dates[0].dateLabel = 'Changed clone';
		result.concept.appearance!.backgroundLayers![0].source = {
			type: 'asset',
			reference: 'changed'
		};
		await concepts.updateConcept(result.concept.id, result.concept);
		expect(await concepts.getConceptById(concept.id)).toEqual(concept);
		expect(await instances.getAllConceptInstances()).toContainEqual(child);
	});
	it('preserves metadata for blank renames and existing-Concept reassignment', async () => {
		const concept = await concepts.createConcept('', structuredClone(metadata));
		const instance = await instances.createConceptInstance({
			conceptId: concept.id,
			...structuredClone(localMetadata)
		});
		expect(
			await service.updateConceptTitleFromInstance(concept.id, instance.id, 'Named')
		).toMatchObject({
			status: 'ok',
			concept: { ...metadata, id: concept.id, title: 'Named' },
			instance
		});
		const existing = await concepts.createConcept('Existing');
		expect(
			await service.updateConceptTitleFromInstance(concept.id, instance.id, 'existing')
		).toMatchObject({ status: 'title-conflict', matchingConcepts: [existing] });
		expect(
			await service.updateConceptTitleFromInstance(
				concept.id,
				instance.id,
				'existing',
				'use-existing'
			)
		).toEqual({
			status: 'ok',
			concept: existing,
			instance: { ...instance, conceptId: existing.id }
		});
	});
	it('imports independent immediate-child metadata without resetting pins', async () => {
		const source = await instances.createConceptInstance({ conceptId: 'parent' });
		const target = await instances.createConceptInstance({ conceptId: 'parent' });
		const child = await instances.createConceptInstance({
			conceptId: 'child',
			parentInstanceId: source.id,
			...structuredClone(localMetadata)
		});
		await instances.createConceptInstance({ conceptId: 'grandchild', parentInstanceId: child.id });
		const result = await instances.importChildrenFromConceptInstance(source.id, target.id);
		expect(result?.importedCount).toBe(1);
		const imported = result!.instances[0];
		expect(imported.id).not.toBe(child.id);
		expect(imported).toMatchObject({
			...localMetadata,
			conceptId: child.conceptId,
			parentInstanceId: target.id
		});
		imported.notes.text = 'Imported edit';
		imported.properties.local = 'Imported edit';
		await instances.updateConceptInstance(imported.id, imported);
		expect((await instances.getAllConceptInstances()).find((item) => item.id === child.id)).toEqual(
			child
		);
		expect(
			(await instances.importChildrenFromConceptInstance(source.id, target.id))?.importedCount
		).toBe(0);
	});
});

describe('instance sequence persistence', () => {
	it('omits unassigned sequence and preserves it through both creation paths', async () => {
		const unassigned = await instances.createConceptInstance({ conceptId: 'concept' });
		const defaultPair = await service.createConceptWithInstance({ title: 'Default' });
		const assigned = await instances.createConceptInstance({ conceptId: 'concept', sequence: 0 });
		const assignedPair = await service.createConceptWithInstance({
			title: 'Assigned',
			sequence: 3
		});
		expect(unassigned).not.toHaveProperty('sequence');
		expect(defaultPair.instance).not.toHaveProperty('sequence');
		expect(assigned.sequence).toBe(0);
		expect(assignedPair.instance.sequence).toBe(3);
		const records = JSON.parse(
			await readFile(path.join(directory, 'src/lib/data/concept_instances.json'), 'utf8')
		);
		expect(records.find((item: { id: string }) => item.id === unassigned.id)).not.toHaveProperty(
			'sequence'
		);
		expect(
			(await instances.getAllConceptInstances()).find((item) => item.id === assigned.id)?.sequence
		).toBe(0);
	});
	it('ignores invalid sequence inputs during creation', async () => {
		for (const sequence of [null, '2', NaN, Infinity]) {
			expect(
				await instances.createConceptInstance({
					conceptId: 'concept',
					sequence: sequence as number
				})
			).not.toHaveProperty('sequence');
			expect(
				(await service.createConceptWithInstance({ sequence: sequence as number })).instance
			).not.toHaveProperty('sequence');
		}
	});
	it.each([false, true])(
		'updates sequence and preserves it for omitted or invalid fields (batch=%s)',
		async (batch) => {
			const instance = await instances.createConceptInstance({ conceptId: 'concept', sequence: 5 });
			const update = (updates: UpdateConceptInstanceInput) =>
				batch
					? instances.updateConceptInstancesBatch([{ id: instance.id, updates }])
					: instances.updateConceptInstance(instance.id, updates);
			await update({ x: 25 });
			for (const sequence of [undefined, null, '1', NaN, Infinity]) {
				await update({ sequence: sequence as number });
			}
			expect((await instances.getAllConceptInstances())[0].sequence).toBe(5);
			await update({ sequence: 0 });
			expect((await instances.getAllConceptInstances())[0]).toMatchObject({ sequence: 0, x: 25 });
		}
	);
});

describe('instance batch deletion persistence', () => {
	it('deletes only unique requested instances, preserving descendants and other files', async () => {
		const concept = await concepts.createConcept('Shared', structuredClone(metadata));
		const parent = await instances.createConceptInstance({ conceptId: concept.id });
		const other = await instances.createConceptInstance({ conceptId: concept.id });
		const child = await instances.createConceptInstance({
			conceptId: concept.id,
			parentInstanceId: parent.id,
			...structuredClone(localMetadata),
			sequence: 0,
			x: -12.5,
			y: 8.25,
			width: 412.5,
			height: 275.25,
			lastCameraPanX: -32.5,
			lastCameraPanY: 14.25,
			lastCameraZoom: 1.75
		});
		const grandchild = await instances.createConceptInstance({
			conceptId: concept.id,
			parentInstanceId: child.id,
			...structuredClone(localMetadata)
		});
		const survivor = await instances.createConceptInstance({ conceptId: concept.id });
		await writeRecords('context.json', [{ id: 'context', title: 'Untouched' }]);
		await writeRecords('concept_relationships.json', [{ id: 'relationship' }]);
		await writeRecords('relationship_definitions.json', [{ id: 'definition' }]);
		const protectedFiles = [
			'concepts.json',
			'context.json',
			'concept_relationships.json',
			'relationship_definitions.json'
		];
		const before = await Promise.all(
			protectedFiles.map((file) => readFile(path.join(directory, 'src/lib/data', file)))
		);

		expect(
			await instances.deleteConceptInstancesBatch([parent.id, parent.id, other.id, 'missing'])
		).toBe(2);
		expect(await instances.getAllConceptInstances()).toEqual([child, grandchild, survivor]);
		expect(
			JSON.parse(
				await readFile(path.join(directory, 'src/lib/data/concept_instances.json'), 'utf8')
			)
		).toEqual([child, grandchild, survivor]);
		for (const [index, file] of protectedFiles.entries()) {
			expect(await readFile(path.join(directory, 'src/lib/data', file))).toEqual(before[index]);
		}
	});

	it.each([{ ids: ['missing', 'missing'] }, { ids: [] }])(
		'does not write for unmatched or empty IDs: %j',
		async ({ ids }) => {
			// Unformatted legacy bytes would change if the repository saved them.
			const file = path.join(directory, 'src/lib/data/concept_instances.json');
			await writeFile(
				file,
				'  ' + JSON.stringify([{ id: 'survivor', conceptId: 'concept' }]) + '  '
			);
			const before = await readFile(file);
			expect(await instances.deleteConceptInstancesBatch(ids)).toBe(0);
			expect(await readFile(file)).toEqual(before);
		}
	);
});

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
	isPinned: true
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

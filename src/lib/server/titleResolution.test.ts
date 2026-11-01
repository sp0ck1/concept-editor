import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeConcept } from '$lib/model/normalizeConcept';
import { normalizeConceptInstance } from '$lib/model/normalizeConceptInstance';
import type { ConceptInstance } from '$lib/model/ConceptInstance';
import type { TitleConflictResolution } from '$lib/model/TitleConflictMode';

let directory: string;
let service: typeof import('./conceptService');
let repository: typeof import('./repositories/conceptInstanceRepository');
let conceptRepository: typeof import('./repositories/conceptRepository');
let records: ConceptInstance[];
const concepts = [
	normalizeConcept({
		id: 'old',
		title: 'Original',
		notes: { format: 'plain', text: 'Original shared' }
	}),
	normalizeConcept({ id: 'first', title: 'Selected' }),
	normalizeConcept({
		id: 'selected',
		title: ' SELECTED ',
		properties: { shared: 'untouched' },
		tagIds: ['first'],
		notes: { format: 'plain', text: 'Shared notes' },
		dates: [{ date: '2026-10-31', dateLabel: 'Date' }],
		appearance: { backgroundColor: 'blue' }
	}),
	normalizeConcept({ id: 'child-concept', title: 'Child' }),
	normalizeConcept({ id: 'unplaced', title: 'Selected' })
];
const resolution: TitleConflictResolution = {
	targetConceptId: 'selected',
	sourceInstanceId: 'source',
	destination: 'current-instance',
	propertyKeys: ['replace'],
	copyNotes: false,
	copyChildren: false,
	retainChildMetadata: false
};
const emptyNotes = { format: 'plain', text: '' };
const defaults = {
	width: 350,
	height: 250,
	lastCameraPanX: 0,
	lastCameraPanY: 0,
	lastCameraZoom: 1,
	properties: {},
	notes: emptyNotes,
	view: 'tree',
	isPinned: false
};
function file(name: string) {
	return path.join(directory, 'src/lib/data', name);
}
async function seed() {
	await writeFile(file('concepts.json'), JSON.stringify(concepts));
	await writeFile(file('concept_instances.json'), JSON.stringify(records));
}
async function savedInstances(): Promise<ConceptInstance[]> {
	return JSON.parse(await readFile(file('concept_instances.json'), 'utf8'));
}
async function resolve(overrides: Partial<TitleConflictResolution> = {}) {
	return service.updateConceptTitleFromInstance('old', 'target', ' selected ', 'use-existing', {
		...resolution,
		...overrides
	});
}
async function expectNoWrites(action: () => Promise<unknown>) {
	const before = await Promise.all(
		['concepts.json', 'concept_instances.json'].map((name) => readFile(file(name), 'utf8'))
	);
	const result = await action();
	expect(repository.saveAllConceptInstances).not.toHaveBeenCalled();
	expect(conceptRepository.saveAllConcepts).not.toHaveBeenCalled();
	expect(
		await Promise.all(
			['concepts.json', 'concept_instances.json'].map((name) => readFile(file(name), 'utf8'))
		)
	).toEqual(before);
	return result;
}
beforeEach(async () => {
	directory = await mkdtemp(path.join(os.tmpdir(), 'concept-title-resolution-'));
	await mkdir(path.join(directory, 'src/lib/data'), { recursive: true });
	records = [
		normalizeConceptInstance({
			id: 'target',
			conceptId: 'old',
			parentInstanceId: 'parent',
			x: 70,
			y: 80,
			width: 490,
			height: 390,
			lastCameraPanX: 9,
			lastCameraPanY: 10,
			lastCameraZoom: 2,
			view: 'metadata',
			isPinned: true,
			sequence: 0,
			properties: { keep: 'destination', replace: 'old' },
			notes: { format: 'plain', text: 'Destination' }
		}),
		normalizeConceptInstance({
			id: 'source',
			conceptId: 'selected',
			properties: { replace: 'saved source', notSelected: 'do not copy' },
			notes: { format: 'plain', text: 'Source notes' }
		}),
		normalizeConceptInstance({
			id: 'existing-child',
			conceptId: 'child-concept',
			parentInstanceId: 'target'
		}),
		...['child-a', 'child-b'].map((id) =>
			normalizeConceptInstance({
				id,
				conceptId: 'child-concept',
				parentInstanceId: 'source',
				x: 99,
				y: 88,
				width: 777,
				height: 666,
				lastCameraPanX: 10,
				lastCameraPanY: 20,
				lastCameraZoom: 3,
				sequence: 8,
				view: 'notes',
				isPinned: true,
				properties: { child: id },
				notes: { format: 'plain', text: id }
			})
		),
		normalizeConceptInstance({
			id: 'grandchild',
			conceptId: 'first',
			parentInstanceId: 'child-a',
			view: 'metadata',
			sequence: 0,
			properties: { deep: 'value' },
			notes: { format: 'plain', text: 'Deep' }
		})
	];
	await seed();
	vi.resetModules();
	// Repositories capture cwd at import time; never import them before redirecting storage.
	vi.spyOn(process, 'cwd').mockReturnValue(directory);
	repository = await import('./repositories/conceptInstanceRepository');
	conceptRepository = await import('./repositories/conceptRepository');
	service = await import('./conceptService');
	vi.spyOn(repository, 'saveAllConceptInstances');
	vi.spyOn(conceptRepository, 'saveAllConcepts');
});
afterEach(async () => {
	vi.restoreAllMocks();
	vi.resetModules();
	if (directory) await rm(directory, { recursive: true, force: true });
});

describe('existing Concept title resolution', () => {
	for (const copyNotes of [false, true]) {
		it(`chooses exact ID, merges selected saved properties and ${copyNotes ? 'replaces' : 'keeps'} notes`, async () => {
			const result = await resolve({ copyNotes });
			expect(result).toEqual({
				status: 'ok',
				concept: concepts[2],
				instance: {
					...records[0],
					conceptId: 'selected',
					properties: { keep: 'destination', replace: 'saved source' },
					notes: copyNotes ? records[1].notes : records[0].notes
				}
			});
			expect(await savedInstances()).toEqual([
				result.status === 'ok' ? result.instance : null,
				...records.slice(1)
			]);
			expect(repository.saveAllConceptInstances).toHaveBeenCalledTimes(1);
			expect(conceptRepository.saveAllConcepts).not.toHaveBeenCalled();
			expect(JSON.parse(await readFile(file('concepts.json'), 'utf8'))).toEqual(concepts);
		});
	}
	for (const copyNotes of [false, true]) {
		it(`creates a defaulted nearby sibling, leaving the original unchanged (notes=${copyNotes})`, async () => {
			const result = await resolve({ destination: 'new-instance', copyNotes });
			expect(result.status).toBe('ok');
			if (result.status !== 'ok') throw new Error('Expected success');
			expect(result.instance).toEqual({
				...defaults,
				id: expect.any(String),
				conceptId: 'selected',
				parentInstanceId: 'parent',
				x: 584,
				y: 80,
				properties: { replace: 'saved source' },
				notes: copyNotes ? records[1].notes : emptyNotes
			});
			expect(records.map((item) => item.id)).not.toContain(result.instance.id);
			expect(await savedInstances()).toEqual([...records, result.instance]);
		});
	}
	for (const retainChildMetadata of [false, true]) {
		for (const destination of ['current-instance', 'new-instance'] as const) {
			it(`copies all descendants with fresh parents/IDs (${destination}, metadata=${retainChildMetadata})`, async () => {
				const result = await resolve({ copyChildren: true, retainChildMetadata, destination });
				if (result.status !== 'ok') throw new Error('Expected success');
				const saved = await savedInstances();
				const clones = saved.filter(
					(item) => !records.some((old) => old.id === item.id) && item.id !== result.instance.id
				);
				expect(clones).toHaveLength(3);
				expect(new Set(saved.map((item) => item.id)).size).toBe(saved.length);
				for (const [index, clone] of clones.entries()) {
					const original = records[index + 3];
					const parentInstanceId = index < 2 ? result.instance.id : clones[0].id;
					expect(clone).toEqual(
						retainChildMetadata
							? { ...original, id: clone.id, parentInstanceId }
							: {
									...defaults,
									id: clone.id,
									conceptId: original.conceptId,
									parentInstanceId,
									x: index === 1 ? 56 : 32,
									y: index === 1 ? 56 : 32
								}
					);
				}
				for (const original of records.slice(1)) expect(saved).toContainEqual(original);
				if (destination === 'new-instance') expect(saved).toContainEqual(records[0]);
				expect(
					saved.filter(
						(item) =>
							item.parentInstanceId === result.instance.id && item.conceptId === 'child-concept'
					)
				).toHaveLength(destination === 'current-instance' ? 3 : 2);
				expect(repository.saveAllConceptInstances).toHaveBeenCalledTimes(1);
				expect(conceptRepository.saveAllConcepts).not.toHaveBeenCalled();
			});
		}
	}
	it('snapshots when the target is already a descendant of the source', async () => {
		records[0].parentInstanceId = 'source';
		await seed();
		const result = await resolve({ copyChildren: true, retainChildMetadata: true });
		expect(result.status).toBe('ok');
		const saved = await savedInstances();
		expect(saved).toHaveLength(records.length + 5);
		const targetCopy = saved.find((item) => item.id !== 'target' && item.conceptId === 'old');
		expect(targetCopy).toMatchObject({
			parentInstanceId: 'target',
			properties: records[0].properties
		});
		expect(
			saved.some(
				(item) => item.parentInstanceId === targetCopy?.id && item.conceptId === 'child-concept'
			)
		).toBe(true);
	});
	it('allows an unplaced Concept without a source or copy options', async () => {
		const result = await resolve({
			targetConceptId: 'unplaced',
			sourceInstanceId: undefined,
			propertyKeys: []
		});
		expect(result).toMatchObject({
			status: 'ok',
			concept: { id: 'unplaced' },
			instance: {
				conceptId: 'unplaced',
				properties: records[0].properties,
				notes: records[0].notes
			}
		});
	});
	it('report-conflict is a read-only cancellation boundary', async () => {
		const result = await expectNoWrites(() =>
			service.updateConceptTitleFromInstance('old', 'target', ' selected ')
		);
		expect(result).toEqual({
			status: 'title-conflict',
			matchingConcepts: [concepts[1], concepts[2], concepts[4]]
		});
	});
	it.each([
		{ targetConceptId: 'missing' },
		{ targetConceptId: 'old' },
		{ sourceInstanceId: 'missing' },
		{ sourceInstanceId: 'target' },
		{ propertyKeys: ['missing'] },
		{ propertyKeys: ['toString'] },
		{ sourceInstanceId: undefined, propertyKeys: [] },
		{ targetConceptId: 'unplaced', sourceInstanceId: undefined },
		...['copyNotes', 'copyChildren', 'retainChildMetadata'].map((flag) => ({
			targetConceptId: 'unplaced',
			sourceInstanceId: undefined,
			propertyKeys: [],
			[flag]: true
		}))
	])('rejects invalid source/selection/options without writes: %j', async (overrides) => {
		expect(await expectNoWrites(() => resolve(overrides))).toMatchObject({
			status: 'invalid-resolution',
			message: expect.any(String)
		});
	});
	it('rejects a stale target before any write', async () => {
		records[0].conceptId = 'first';
		await seed();
		expect(await expectNoWrites(() => resolve())).toMatchObject({ status: 'stale-instance' });
	});
	it.each(['cycle', 'duplicate-child', 'duplicate-source', 'missing-concept'])(
		'rejects malformed reachable trees before writes: %s',
		async (kind) => {
			if (kind === 'cycle') records[1].parentInstanceId = 'grandchild';
			if (kind === 'duplicate-child') records.push({ ...records[3], parentInstanceId: null });
			if (kind === 'duplicate-source') records.push({ ...records[1] });
			if (kind === 'missing-concept') records[5].conceptId = 'missing';
			await seed();
			expect(await expectNoWrites(() => resolve({ copyChildren: true }))).toMatchObject({
				status: 'invalid-resolution'
			});
		}
	);
	it('does not repair or reject unrelated malformed trees', async () => {
		records.push(
			normalizeConceptInstance({
				id: 'unrelated',
				conceptId: 'missing',
				parentInstanceId: 'unrelated'
			})
		);
		await seed();
		expect(await resolve({ copyChildren: true })).toMatchObject({ status: 'ok' });
		expect(await savedInstances()).toContainEqual(records.at(-1));
	});
	it('preserves legacy use-existing first-match behavior', async () => {
		expect(
			await service.updateConceptTitleFromInstance('old', 'target', 'Selected', 'use-existing')
		).toMatchObject({
			status: 'ok',
			concept: { id: 'first' },
			instance: { ...records[0], conceptId: 'first' }
		});
	});
	it('preserves create-duplicate shared metadata cloning', async () => {
		const result = await service.updateConceptTitleFromInstance(
			'old',
			'target',
			' Selected ',
			'create-duplicate'
		);
		if (result.status !== 'ok') throw new Error('Expected success');
		expect(result.concept).toEqual({ ...concepts[0], id: expect.any(String), title: 'Selected' });
		expect(result.concept.id).not.toBe('old');
		expect(result.instance).toEqual({ ...records[0], conceptId: result.concept.id });
	});
	it('preserves blank single-use rename behavior', async () => {
		await writeFile(
			file('concepts.json'),
			JSON.stringify([{ ...concepts[0], title: '' }, ...concepts.slice(1)])
		);
		expect(
			await service.updateConceptTitleFromInstance('old', 'target', ' New title ')
		).toMatchObject({
			status: 'ok',
			concept: { id: 'old', title: 'New title' },
			instance: records[0]
		});
		expect(repository.saveAllConceptInstances).not.toHaveBeenCalled();
	});
});

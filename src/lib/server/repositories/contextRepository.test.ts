import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Context } from '$lib/model/Context';

let directory: string;
let contextPath: string;
let repository: typeof import('./contextRepository');
const context: Context = {
	id: 'context',
	title: 'Workspace',
	properties: { status: 'active' },
	tagIds: ['tag'],
	notes: { format: 'plain', text: 'Saved notes' },
	dates: [
		{ date: '2024-02-29', dateLabel: 'Started' },
		{ date: '', dateLabel: 'Undated' }
	],
	appearance: {
		backgroundColor: 'blue',
		backgroundLayers: [
			{ source: { type: 'asset', reference: 'asset-1' }, position: 'center', size: 'cover' },
			{ source: { type: 'gradient', value: 'linear-gradient(red, blue)' } }
		]
	}
};
const otherFiles = [
	'concepts.json',
	'concept_instances.json',
	'concept_relationships.json',
	'relationship_definitions.json'
];

beforeEach(async () => {
	directory = await mkdtemp(path.join(os.tmpdir(), 'concept-context-persistence-'));
	const dataPath = path.join(directory, 'src/lib/data');
	await mkdir(dataPath, { recursive: true });
	contextPath = path.join(dataPath, 'context.json');
	await writeFile(contextPath, JSON.stringify(context));
	for (const file of otherFiles) await writeFile(path.join(dataPath, file), '[]\n');
	vi.resetModules();
	// Repository paths resolve at import time; never point mutation tests at live data.
	vi.spyOn(process, 'cwd').mockReturnValue(directory);
	repository = await import('./contextRepository');
});

afterEach(async () => {
	vi.restoreAllMocks();
	vi.resetModules();
	if (directory) await rm(directory, { recursive: true, force: true });
});

describe('singleton Context persistence', () => {
	it('normalizes a legacy record without rewriting its bytes', async () => {
		const original = ' { "id": "legacy", "title": "Legacy" }\n';
		await writeFile(contextPath, original);
		expect(await repository.getContext()).toEqual({
			id: 'legacy',
			title: 'Legacy',
			properties: {},
			tagIds: [],
			notes: { format: 'plain', text: '' },
			dates: []
		});
		expect(await readFile(contextPath, 'utf8')).toBe(original);
	});

	it('saves only normalized Context fields, including nested metadata', async () => {
		await repository.saveContext({
			...context,
			concepts: [{ id: 'not-context-data' }],
			instances: [],
			relationships: [],
			relationshipDefinitions: [],
			name: 'legacy-name',
			notes: { ...context.notes, extra: true },
			dates: context.dates.map((date) => ({ ...date, extra: true })),
			appearance: { ...context.appearance, extra: true }
		} as Context);
		expect(JSON.parse(await readFile(contextPath, 'utf8'))).toEqual(context);
		expect(await repository.getContext()).toEqual(context);
	});

	it('updates every supported field with detached copies and a trimmed title', async () => {
		const input = structuredClone(context);
		input.title = ' Updated ';
		input.properties = { status: 'updated' };
		input.tagIds = ['new-tag'];
		input.notes.text = 'Updated notes';
		input.dates = [
			{ date: '2026-10-28', dateLabel: 'Updated' },
			{ date: '', dateLabel: 'Planned' }
		];
		input.appearance!.backgroundColor = 'green';
		input.appearance!.backgroundLayers![0].source = { type: 'asset', reference: 'new-asset' };
		const expected = { ...structuredClone(input), title: 'Updated' };
		const result = await repository.updateContext(input);
		expect(result).toEqual(expected);
		input.properties.status = 'changed';
		input.tagIds.push('changed');
		input.notes.text = 'changed';
		input.dates[0].dateLabel = 'changed';
		input.appearance!.backgroundLayers![0].source = { type: 'asset', reference: 'changed' };
		expect(result).toEqual(expected);
		expect(await repository.getContext()).toEqual(expected);
	});

	it('preserves omitted and invalid fields and cannot change identity or save collections', async () => {
		const invalidUpdates = [
			{},
			{
				title: null,
				properties: null,
				tagIds: null,
				notes: null,
				dates: null,
				appearance: null
			},
			{ title: 1, properties: { bad: 1 }, tagIds: ['tag', 1] },
			{ properties: [], tagIds: 'tag', notes: { format: 'markdown', text: 'bad' } },
			{ notes: { format: 'plain', text: 1 } },
			{ dates: [{ date: '2023-02-29', dateLabel: 'Invalid' }] },
			{ dates: [{ date: '2024-02-29', dateLabel: 1 }] },
			{ appearance: { backgroundLayers: [{ source: { type: 'asset', reference: 1 } }] } },
			{
				id: 'replacement',
				name: 'Ignored',
				concepts: [],
				instances: [],
				relationships: [],
				relationshipDefinitions: []
			}
		];
		for (const updates of invalidUpdates) {
			expect(
				await repository.updateContext(updates as unknown as Partial<Omit<Context, 'id'>>)
			).toEqual(context);
			expect(JSON.parse(await readFile(contextPath, 'utf8'))).toEqual(context);
		}
		const result = await repository.updateContext({ title: 'Renamed' });
		expect(result).toEqual({ ...context, title: 'Renamed' });
	});

	it('accepts empty supported values for clearing', async () => {
		const cleared = {
			id: context.id,
			title: '',
			properties: {},
			tagIds: [],
			notes: { format: 'plain' as const, text: '' },
			dates: [],
			appearance: {}
		};
		expect(await repository.updateContext({ ...cleared, title: '   ' })).toEqual(cleared);
		expect(await repository.getContext()).toEqual(cleared);
	});

	it('touches no other data files and keeps its import-time path', async () => {
		vi.mocked(process.cwd).mockReturnValue(path.join(directory, 'not-the-repository'));
		await repository.getContext();
		await repository.saveContext(context);
		await repository.updateContext({ title: 'Updated' });
		const dataPath = path.dirname(contextPath);
		expect((await readdir(dataPath)).sort()).toEqual([...otherFiles, 'context.json'].sort());
		for (const file of otherFiles)
			expect(await readFile(path.join(dataPath, file), 'utf8')).toBe('[]\n');
	});

	it('propagates missing-file failures without creating a fallback record', async () => {
		await rm(contextPath);
		await expect(repository.getContext()).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(repository.updateContext({ title: 'Do not create' })).rejects.toMatchObject({
			code: 'ENOENT'
		});
		await expect(readFile(contextPath)).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('propagates parse failures without overwriting corrupt data', async () => {
		await writeFile(contextPath, '{ corrupt');
		await expect(repository.getContext()).rejects.toBeInstanceOf(SyntaxError);
		await expect(repository.updateContext({ title: 'Do not overwrite' })).rejects.toBeInstanceOf(
			SyntaxError
		);
		expect(await readFile(contextPath, 'utf8')).toBe('{ corrupt');
	});

	it('propagates save and update write failures', async () => {
		await rm(contextPath);
		await mkdir(contextPath);
		await expect(repository.saveContext(context)).rejects.toMatchObject({ code: 'EISDIR' });
		await rm(contextPath, { recursive: true });
		await writeFile(contextPath, JSON.stringify(context));
		const failure = new Error('Write failed');
		const failedWrite = vi.fn().mockRejectedValue(failure);
		vi.doMock('node:fs/promises', async (importOriginal) => ({
			...(await importOriginal<typeof import('node:fs/promises')>()),
			writeFile: failedWrite
		}));
		vi.resetModules();
		try {
			const failingRepository = await import('./contextRepository');
			expect(await failingRepository.getContext()).toEqual(context);
			await expect(failingRepository.saveContext(context)).rejects.toBe(failure);
			await expect(failingRepository.updateContext({ title: 'Not saved' })).rejects.toBe(failure);
			expect(failedWrite).toHaveBeenCalledTimes(2);
			expect(JSON.parse(await readFile(contextPath, 'utf8'))).toEqual(context);
		} finally {
			vi.doUnmock('node:fs/promises');
		}
	});
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateAll } from '$app/navigation';
import { createConceptRecord, updateConceptTitleFromInstanceRecord } from '$lib/client/concepts';
import { normalizeContext } from '$lib/model/normalizeContext';
import { normalizeConcept } from '$lib/model/normalizeConcept';
import { normalizeConceptInstance } from '$lib/model/normalizeConceptInstance';
import { Editor } from './Editor.svelte';
import type { EditorData } from './EditorTypes';
import type { TitleConflictResolution } from '$lib/model/TitleConflictMode';

vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn() }));
vi.mock('$lib/client/concepts', () => ({
	createConceptRecord: vi.fn(),
	updateConceptTitleFromInstanceRecord: vi.fn(),
	updateConceptRecord: vi.fn()
}));

function fixture(): EditorData {
	return {
		context: normalizeContext({ id: 'project', title: 'Test project' }),
		tags: [],
		concepts: [
			normalizeConcept({ id: 'original', title: 'Original' }),
			normalizeConcept({
				id: 'candidate-a',
				title: 'Updates Ideas',
				properties: { shared: 'one', other: 'two' }
			}),
			normalizeConcept({ id: 'candidate-b', title: 'Updates Ideas' }),
			normalizeConcept({ id: 'category', title: 'Category' })
		],
		instances: [
			normalizeConceptInstance({
				id: 'target',
				conceptId: 'original',
				notes: { format: 'plain', text: 'Current notes' },
				properties: { keep: 'original', local: 'before' }
			}),
			normalizeConceptInstance({
				id: 'source-a',
				conceptId: 'candidate-a',
				properties: { shared: 'local', local: 'value' },
				notes: { format: 'plain', text: 'Source notes' }
			}),
			normalizeConceptInstance({ id: 'category-instance', conceptId: 'category' }),
			normalizeConceptInstance({
				id: 'source-b',
				conceptId: 'candidate-a',
				parentInstanceId: 'category-instance'
			}),
			normalizeConceptInstance({
				id: 'source-child',
				conceptId: 'original',
				parentInstanceId: 'source-a'
			})
		],
		relationships: [],
		relationshipDefinitions: []
	};
}

let editor: Editor;
let data: EditorData;
const fetchGuard = vi.fn(() => {
	throw new Error('No real requests in title tests');
});

beforeEach(() => {
	vi.resetAllMocks();
	vi.stubGlobal('fetch', fetchGuard);
	vi.spyOn(console, 'error').mockImplementation(() => {});
	data = fixture();
	editor = new Editor(data);
	vi.mocked(invalidateAll).mockRejectedValue(new Error('Refresh failed'));
});

afterEach(() => {
	expect(fetchGuard).not.toHaveBeenCalled();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

async function begin() {
	vi.mocked(updateConceptTitleFromInstanceRecord).mockResolvedValueOnce({
		status: 'title-conflict',
		matchingConcepts: [data.concepts[1], data.concepts[2]]
	});
	const completion = editor.commitTitleEdit(editor.getCard('target')!, 'Updates Ideas');
	await Promise.resolve();
	return { completion };
}

function choice(): TitleConflictResolution {
	return {
		targetConceptId: 'candidate-a',
		sourceInstanceId: 'source-a',
		destination: 'current-instance',
		propertyKeys: ['local'],
		copyNotes: true,
		copyChildren: true,
		retainChildMetadata: true
	};
}

function successfulResponse() {
	return {
		status: 'updated' as const,
		concept: data.concepts[1],
		instance: { ...data.instances[0], conceptId: 'candidate-a' }
	};
}

describe('title-conflict sessions', () => {
	it('lists every path and unplaced Concept with combined, not deduplicated, property counts', async () => {
		const { completion } = await begin();
		const rows = editor.getTitleConflictCandidates();
		expect(rows).toHaveLength(3);
		expect(rows[0]).toMatchObject({
			path: 'Test project > Updates Ideas',
			propertiesCount: 4,
			childrenCount: 1
		});
		expect(rows[1]).toMatchObject({
			path: 'Test project > Category > Updates Ideas',
			propertiesCount: 2
		});
		expect(rows[2]).toMatchObject({
			instance: null,
			path: 'Test project > Not placed > Updates Ideas',
			propertiesCount: 0
		});
		editor.cancelTitleConflict();
		await expect(completion).resolves.toBe('cancelled');
	});

	it('joins repeated Enter/blur commits and cancels without mutation', async () => {
		const { completion } = await begin();
		const repeated = editor.commitTitleEdit(editor.getCard('target')!, 'Updates Ideas');
		expect(repeated).toBe(completion);
		expect(updateConceptTitleFromInstanceRecord).toHaveBeenCalledTimes(1);
		expect(editor.titleConflict?.previousTitle).toBe('Original');
		editor.cancelTitleConflict();
		await expect(completion).resolves.toBe('cancelled');
		expect(editor.instances).toEqual(data.instances);
		expect(invalidateAll).not.toHaveBeenCalled();
	});

	it('sends the exact selected IDs and waits for refreshed records', async () => {
		const { completion } = await begin();
		const result = successfulResponse();
		vi.mocked(updateConceptTitleFromInstanceRecord).mockResolvedValueOnce(result);
		const refreshed = structuredClone(data);
		refreshed.instances[0] = result.instance;
		vi.mocked(invalidateAll).mockImplementationOnce(async () => editor.replaceData(refreshed));
		await expect(editor.resolveTitleConflict('use-existing', choice())).resolves.toBe(true);
		expect(updateConceptTitleFromInstanceRecord).toHaveBeenLastCalledWith(
			'original',
			'target',
			'Updates Ideas',
			'use-existing',
			choice()
		);
		await expect(completion).resolves.toBe('resolved');
		expect(editor.titleConflict).toBeNull();
		expect(editor.getCard('target')?.concept.id).toBe('candidate-a');
	});

	it('preserves the original card when another occurrence is created', async () => {
		const { completion } = await begin();
		const original = structuredClone(data.instances[0]);
		const result = successfulResponse();
		result.instance.id = 'new-occurrence';
		vi.mocked(updateConceptTitleFromInstanceRecord).mockResolvedValueOnce(result);
		const refreshed = structuredClone(data);
		refreshed.instances.push(result.instance);
		vi.mocked(invalidateAll).mockImplementationOnce(async () => editor.replaceData(refreshed));
		await expect(
			editor.resolveTitleConflict('use-existing', { ...choice(), destination: 'new-instance' })
		).resolves.toBe(true);
		await expect(completion).resolves.toBe('resolved');
		expect(editor.getCard('target')?.instance).toEqual(original);
		expect(editor.activeInstanceId).toBe('new-occurrence');
	});

	it('keeps failed resolutions open without navigating or losing current data', async () => {
		const { completion } = await begin();
		vi.mocked(updateConceptTitleFromInstanceRecord).mockRejectedValueOnce(
			new Error('Source no longer exists')
		);
		await expect(editor.resolveTitleConflict('use-existing', choice())).resolves.toBe(false);
		expect(editor.titleConflictError).toBe('Source no longer exists');
		expect(editor.titleConflictSaving).toBe(false);
		expect(editor.instances).toEqual(data.instances);
		expect(invalidateAll).not.toHaveBeenCalled();
		editor.cancelTitleConflict();
		await completion;
	});

	it('prevents double confirmation and cancellation while saving', async () => {
		const { completion } = await begin();
		let resolve!: (value: ReturnType<typeof successfulResponse>) => void;
		const request = new Promise<ReturnType<typeof successfulResponse>>((done) => {
			resolve = done;
		});
		vi.mocked(updateConceptTitleFromInstanceRecord).mockReturnValueOnce(request);
		vi.mocked(invalidateAll).mockResolvedValueOnce(undefined);
		const confirmed = editor.resolveTitleConflict('use-existing', choice());
		expect(editor.titleConflictSaving).toBe(true);
		editor.cancelTitleConflict();
		expect(editor.titleConflict).not.toBeNull();
		await expect(editor.resolveTitleConflict('use-existing', choice())).resolves.toBe(false);
		expect(updateConceptTitleFromInstanceRecord).toHaveBeenCalledTimes(2);
		resolve(successfulResponse());
		await confirmed;
		await completion;
	});

	it('closes after a saved choice whose refresh fails to avoid repeated copying', async () => {
		const { completion } = await begin();
		vi.mocked(updateConceptTitleFromInstanceRecord).mockResolvedValueOnce(successfulResponse());
		await expect(editor.resolveTitleConflict('use-existing', choice())).resolves.toBe(false);
		await expect(completion).resolves.toBe('failed');
		expect(editor.titleConflict).toBeNull();
		expect(editor.saveError).toContain('refreshed data could not be loaded');
	});

	it('restores a title input after canceling a conflict from blur', async () => {
		vi.mocked(updateConceptTitleFromInstanceRecord).mockResolvedValueOnce({
			status: 'title-conflict',
			matchingConcepts: [data.concepts[1]]
		});
		const input = { value: 'Updates Ideas' } as HTMLInputElement;
		const handler = editor.canvas.handleConceptTitleBlur(
			{ currentTarget: input } as unknown as FocusEvent,
			editor.getCard('target')!
		);
		await Promise.resolve();
		editor.cancelTitleConflict();
		await handler;
		expect(input.value).toBe('Original');
	});

	it('does not create an extra blank card when double Enter resolves through the wizard', async () => {
		vi.spyOn(editor.canvas, 'consumeDoubleEnter').mockReturnValue(true);
		vi.mocked(updateConceptTitleFromInstanceRecord).mockResolvedValueOnce({
			status: 'title-conflict',
			matchingConcepts: [data.concepts[1]]
		});
		const input = { value: 'Updates Ideas' } as HTMLInputElement;
		const handler = editor.canvas.handleConceptTitleKeydown(
			{ key: 'Enter', currentTarget: input, preventDefault: vi.fn() } as unknown as KeyboardEvent,
			editor.getCard('target')!
		);
		await Promise.resolve();
		vi.mocked(updateConceptTitleFromInstanceRecord).mockResolvedValueOnce(successfulResponse());
		vi.mocked(invalidateAll).mockResolvedValueOnce(undefined);
		await editor.resolveTitleConflict('use-existing', choice());
		await handler;
		expect(createConceptRecord).not.toHaveBeenCalled();
	});

	it('preserves normal double Enter creation for an unchanged title', async () => {
		vi.spyOn(editor.canvas, 'consumeDoubleEnter').mockReturnValue(true);
		const create = vi
			.spyOn(editor, 'createConcept')
			.mockResolvedValue({ concept: data.concepts[0], instance: data.instances[0] });
		const input = { value: 'Original' } as HTMLInputElement;
		await editor.canvas.handleConceptTitleKeydown(
			{ key: 'Enter', currentTarget: input, preventDefault: vi.fn() } as unknown as KeyboardEvent,
			editor.getCard('target')!
		);
		expect(create).toHaveBeenCalledTimes(1);
		expect(updateConceptTitleFromInstanceRecord).not.toHaveBeenCalled();
	});
});

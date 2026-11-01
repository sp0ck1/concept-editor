import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateAll } from '$app/navigation';
import { createTagInstance, ensureTag } from '$lib/client/tags';
import { createConceptRecord, updateConceptRecord } from '$lib/client/concepts';
import { updateContextRecord } from '$lib/client/context';
import { normalizeConcept } from '$lib/model/normalizeConcept';
import { normalizeConceptInstance } from '$lib/model/normalizeConceptInstance';
import { normalizeContext } from '$lib/model/normalizeContext';
import { Editor } from './Editor.svelte';
import type { EditorData } from './EditorTypes';

vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn() }));
vi.mock('$lib/client/tags', () => ({ ensureTag: vi.fn(), createTagInstance: vi.fn() }));
vi.mock('$lib/client/concepts', () => ({
	createConceptRecord: vi.fn(),
	updateConceptRecord: vi.fn(),
	updateConceptTitleFromInstanceRecord: vi.fn()
}));
vi.mock('$lib/client/context', () => ({ updateContextRecord: vi.fn() }));

function fixture(): EditorData {
	return {
		context: normalizeContext({ id: 'project', title: 'Project', tagIds: ['tag'] }),
		tags: [{ id: 'tag', title: 'Shared title' }],
		concepts: [normalizeConcept({ id: 'owner', title: 'Shared title', tagIds: ['tag'] })],
		instances: [normalizeConceptInstance({ id: 'owner-instance', conceptId: 'owner' })],
		relationships: [],
		relationshipDefinitions: []
	};
}

let editor: Editor;
const fetchGuard = vi.fn(() => {
	throw new Error('Tag tests must not make real requests');
});

beforeEach(() => {
	vi.resetAllMocks();
	vi.stubGlobal('fetch', fetchGuard);
	vi.spyOn(console, 'error').mockImplementation(() => {});
	editor = new Editor(fixture());
	vi.mocked(invalidateAll).mockResolvedValue(undefined);
	vi.mocked(updateConceptRecord).mockResolvedValue(fixture().concepts[0]);
	vi.mocked(updateContextRecord).mockResolvedValue(fixture().context);
});

afterEach(() => {
	try {
		expect(fetchGuard).not.toHaveBeenCalled();
	} finally {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	}
});

describe('Tag state and metadata commands', () => {
	it('resolves references from Tags, not ordinary same-title Concepts', () => {
		expect(editor.getTags(['tag', 'owner', 'missing'])).toEqual(fixture().tags);
		expect(editor.concepts).toEqual(fixture().concepts);
	});

	it('detaches refreshed Tag records and restores the latest baseline on save failure', async () => {
		const refreshed = fixture();
		refreshed.tags[0] = { id: 'tag', title: 'Refreshed tag', representedByConceptId: 'owner' };
		const expected = structuredClone(refreshed.tags);
		editor.replaceData(refreshed);
		refreshed.tags[0].title = 'Mutated loader record';
		refreshed.tags[0].representedByConceptId = 'wrong-concept';
		refreshed.tags.push({ id: 'extra', title: 'Not loaded' });
		expect(editor.tags).toEqual(expected);
		expect(editor.tags[0]).not.toBe(refreshed.tags[0]);

		editor.tags[0].title = 'Unsaved editor change';
		vi.mocked(updateContextRecord).mockRejectedValueOnce(new Error('Offline'));
		await editor.setContextTagIds([]);
		expect(editor.tags).toEqual(expected);
		expect(editor.tags[0]).not.toBe(refreshed.tags[0]);
		expect(invalidateAll).not.toHaveBeenCalled();
	});

	it('deduplicates Concept tag IDs without filtering an ID equal to the Concept ID', async () => {
		await editor.setConceptTagIds(editor.getCard('owner-instance')!, ['owner', 'tag', 'owner']);
		expect(updateConceptRecord).toHaveBeenCalledExactlyOnceWith('owner', {
			tagIds: ['owner', 'tag']
		});
		expect(editor.concepts[0].tagIds).toEqual(['owner', 'tag']);
	});

	it('deduplicates Context tag IDs independently of Concept metadata', async () => {
		await editor.setContextTagIds(['tag', 'tag', 'other']);
		expect(updateContextRecord).toHaveBeenCalledExactlyOnceWith({ tagIds: ['tag', 'other'] });
		expect(updateConceptRecord).not.toHaveBeenCalled();
		expect(editor.concepts).toEqual(fixture().concepts);
	});

	it('ensures and adds a new Tag without creating or adding a Concept', async () => {
		const tag = { id: 'new-tag', title: 'Shared title' };
		vi.mocked(ensureTag).mockResolvedValueOnce({ tag, created: true });
		await editor.addTag(editor.getCard('owner-instance')!, tag.title);
		expect(ensureTag).toHaveBeenCalledExactlyOnceWith('Shared title');
		expect(updateConceptRecord).toHaveBeenCalledExactlyOnceWith('owner', {
			tagIds: ['tag', 'new-tag']
		});
		expect(editor.getTags(['new-tag'])).toEqual([tag]);
		expect(editor.concepts.map((concept) => concept.id)).toEqual(['owner']);
		expect(createConceptRecord).not.toHaveBeenCalled();
		expect(createTagInstance).not.toHaveBeenCalled();
		expect(invalidateAll).toHaveBeenCalledTimes(1);
	});

	it('reuses an existing Tag without duplicating the collection or its references', async () => {
		vi.mocked(ensureTag).mockResolvedValueOnce({ tag: fixture().tags[0], created: false });
		await editor.addTag(editor.getCard('owner-instance')!, 'Shared title');
		expect(editor.tags).toEqual(fixture().tags);
		expect(updateConceptRecord).toHaveBeenCalledExactlyOnceWith('owner', { tagIds: ['tag'] });
		expect(createConceptRecord).not.toHaveBeenCalled();
	});
});

function createdResult(parentInstanceId: string | null) {
	return {
		tag: { id: 'tag', title: 'Shared title', representedByConceptId: 'represented' },
		concept: normalizeConcept({ id: 'represented', title: 'Shared title' }),
		instance: normalizeConceptInstance({
			id: 'created-instance',
			conceptId: 'represented',
			parentInstanceId,
			x: 123,
			y: -45
		})
	};
}

function refreshedData(result: ReturnType<typeof createdResult>): EditorData {
	const data = fixture();
	data.tags = [result.tag];
	data.concepts.push(result.concept);
	data.instances.push(result.instance);
	return data;
}

describe('createInstanceFromTag', () => {
	it.each([null, 'owner-instance'])(
		'places an occurrence on canvas owned by %s and selects it after refresh',
		async (parentInstanceId) => {
			editor.currentCanvasOwnerInstanceId = parentInstanceId;
			const result = createdResult(parentInstanceId);
			vi.mocked(createTagInstance).mockResolvedValueOnce(result);
			let release!: () => void;
			const refresh = new Promise<void>((resolve) => {
				release = resolve;
			});
			vi.mocked(invalidateAll).mockImplementationOnce(async () => {
				await refresh;
				editor.replaceData(refreshedData(result));
			});

			const creation = editor.createInstanceFromTag('tag', { x: 123, y: -45 });
			await Promise.resolve();
			expect(createTagInstance).toHaveBeenCalledExactlyOnceWith('tag', {
				parentInstanceId,
				x: 123,
				y: -45
			});
			expect(invalidateAll).toHaveBeenCalledTimes(1);
			expect(editor.selectedInstanceIds.has(result.instance.id)).toBe(false);
			release();
			await creation;

			expect(editor.getCard(result.instance.id)?.instance).toMatchObject({
				parentInstanceId,
				x: 123,
				y: -45
			});
			expect([...editor.selectedInstanceIds]).toEqual([result.instance.id]);
			expect(editor.activeInstanceId).toBe(result.instance.id);
			expect(editor.getTags(['tag'])).toEqual([result.tag]);
			expect(invalidateAll).toHaveBeenCalledTimes(1);
			expect(createConceptRecord).not.toHaveBeenCalled();
			expect(ensureTag).not.toHaveBeenCalled();
		}
	);

	it('does not steal selection when the user navigates before the refresh completes', async () => {
		const result = createdResult(null);
		vi.mocked(createTagInstance).mockResolvedValueOnce(result);
		vi.mocked(invalidateAll).mockImplementationOnce(async () => {
			editor.replaceData(refreshedData(result));
			editor.currentCanvasOwnerInstanceId = 'owner-instance';
		});
		const select = vi.spyOn(editor, 'selectOnlyInstance');
		await editor.createInstanceFromTag('tag', { x: 123, y: -45 });
		expect(select).not.toHaveBeenCalled();
		expect(editor.currentCanvasOwnerInstanceId).toBe('owner-instance');
	});

	it('does not select a returned instance absent from refreshed visible records', async () => {
		vi.mocked(createTagInstance).mockResolvedValueOnce(createdResult(null));
		const select = vi.spyOn(editor, 'selectOnlyInstance');
		await editor.createInstanceFromTag('tag', { x: 123, y: -45 });
		expect(select).not.toHaveBeenCalled();
		expect(invalidateAll).toHaveBeenCalledTimes(1);
	});

	it('uses global recovery without invalidation or navigation when creation fails', async () => {
		vi.mocked(createTagInstance).mockRejectedValueOnce(new Error('Creation failed'));
		editor.currentCanvasOwnerInstanceId = 'owner-instance';
		editor.context.title = 'Unsaved';
		await editor.createInstanceFromTag('tag', { x: 123, y: -45 });
		expect(editor.context).toEqual(fixture().context);
		expect(editor.instances).toEqual(fixture().instances);
		expect(editor.currentCanvasOwnerInstanceId).toBe('owner-instance');
		expect(editor.saveError).toContain('The last loaded data has been restored');
		expect(createTagInstance).toHaveBeenCalledTimes(1);
		expect(invalidateAll).not.toHaveBeenCalled();
	});

	it('does not retry creation or refresh when creation succeeds but refresh fails', async () => {
		vi.mocked(createTagInstance).mockResolvedValueOnce(createdResult(null));
		vi.mocked(invalidateAll).mockRejectedValueOnce(new Error('Refresh failed'));
		const select = vi.spyOn(editor, 'selectOnlyInstance');
		await editor.createInstanceFromTag('tag', { x: 123, y: -45 });
		expect(createTagInstance).toHaveBeenCalledTimes(1);
		expect(invalidateAll).toHaveBeenCalledTimes(1);
		expect(select).not.toHaveBeenCalled();
		expect(editor.instances).toEqual(fixture().instances);
		expect(editor.saveError).toBeTruthy();
	});
});

describe('explicit Concept tagging', () => {
	it('passes source identity without treating a Concept ID as a Tag ID', async () => {
		const tag = { id: 'specific-tag', title: 'Shared title', representedByConceptId: 'owner' };
		vi.mocked(ensureTag).mockResolvedValueOnce({ tag, created: true });
		await editor.addTag(editor.getCard('owner-instance')!, tag.title, 'owner');
		expect(ensureTag).toHaveBeenCalledExactlyOnceWith(tag.title, 'owner');
		expect(updateConceptRecord).toHaveBeenCalledExactlyOnceWith('owner', {
			tagIds: ['tag', 'specific-tag']
		});
		expect(editor.getTags(['specific-tag'])).toEqual([tag]);
		expect(createConceptRecord).not.toHaveBeenCalled();
	});
});

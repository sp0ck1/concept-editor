import { normalizeContext } from '$lib/model/normalizeContext';
import { updateContextRecord } from '$lib/client/context';
import { normalizeConcept } from '$lib/model/normalizeConcept';
import { normalizeConceptInstance } from '$lib/model/normalizeConceptInstance';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateAll } from '$app/navigation';
import {
	createConceptRecord,
	ensureConceptByTitle,
	updateConceptRecord,
	updateConceptTitleFromInstanceRecord
} from '$lib/client/concepts';
import {
	deleteConceptInstanceRecord,
	deleteConceptInstancesBatch,
	importChildrenFromConceptInstance,
	updateConceptInstanceRecord,
	updateConceptInstancesBatch
} from '$lib/client/conceptInstances';
import { Editor } from './Editor.svelte';
import type { EditorData } from './EditorTypes';

vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn() }));
vi.mock('$lib/client/context', () => ({ updateContextRecord: vi.fn() }));
vi.mock('$lib/client/concepts', () => ({
	createConceptRecord: vi.fn(),
	ensureConceptByTitle: vi.fn(),
	updateConceptRecord: vi.fn(),
	updateConceptTitleFromInstanceRecord: vi.fn()
}));
vi.mock('$lib/client/conceptInstances', () => ({
	deleteConceptInstanceRecord: vi.fn(),
	deleteConceptInstancesBatch: vi.fn(),
	importChildrenFromConceptInstance: vi.fn(),
	updateConceptInstanceRecord: vi.fn(),
	updateConceptInstancesBatch: vi.fn()
}));

function fixture(): EditorData {
	return {
		context: normalizeContext({ id: 'test-context', title: 'Test project' }),
		concepts: [
			{
				id: 'test-concept',
				title: 'Test item',
				properties: { status: 'saved', keep: 'original' },
				tagConceptIds: ['test-tag']
			},
			{
				id: 'test-tag',
				title: 'Test tag',
				properties: {} as Record<string, string>,
				tagConceptIds: []
			}
		].map((concept) => normalizeConcept(concept)),
		instances: [
			{
				id: 'test-instance-a',
				conceptId: 'test-concept',
				parentInstanceId: null,
				x: 10,
				y: 20,
				width: 350,
				height: 250,
				lastCameraPanX: 0,
				lastCameraPanY: 0,
				lastCameraZoom: 1
			},
			{
				id: 'test-instance-b',
				conceptId: 'test-concept',
				parentInstanceId: null,
				x: 400,
				y: 50,
				width: 350,
				height: 250,
				lastCameraPanX: 0,
				lastCameraPanY: 0,
				lastCameraZoom: 1
			}
		].map((instance) => normalizeConceptInstance(instance)),
		relationships: [],
		relationshipDefinitions: []
	};
}

function deferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

const conceptUpdates = { properties: { status: 'changed' } };
const geometry = { x: 900, y: 800, width: 500, height: 400 };
const batchUpdates = [
	{ id: 'test-instance-a', updates: geometry },
	{ id: 'test-instance-b', updates: { x: 1000, y: 1100 } }
];
const saveCases = [
	{
		title: 'Context',
		client: vi.mocked(updateContextRecord),
		args: [{ title: 'Changed project' }],
		save: (editor: Editor) => editor.updateContext({ title: 'Changed project' })
	},
	{
		title: 'Concept',
		client: vi.mocked(updateConceptRecord),
		args: ['test-concept', conceptUpdates],
		save: (editor: Editor) => editor.updateConcept('test-concept', conceptUpdates)
	},
	{
		title: 'instance',
		client: vi.mocked(updateConceptInstanceRecord),
		args: ['test-instance-a', geometry],
		save: (editor: Editor) => editor.updateInstance('test-instance-a', geometry)
	},
	{
		title: 'batch',
		client: vi.mocked(updateConceptInstancesBatch),
		args: [batchUpdates],
		save: (editor: Editor) => editor.updateInstancesBatch(batchUpdates)
	}
];

let editor: Editor;
let loadedData: EditorData;
const fetchGuard = vi.fn(() => {
	throw new Error('Tests must never make real HTTP requests');
});

beforeEach(() => {
	vi.resetAllMocks();
	vi.stubGlobal('fetch', fetchGuard);
	vi.spyOn(console, 'error').mockImplementation(() => {});
	loadedData = fixture();
	vi.mocked(updateContextRecord).mockResolvedValue(fixture().context);
	editor = new Editor(loadedData);
	vi.mocked(invalidateAll).mockRejectedValue(new Error('Navigation must not run during recovery'));
	vi.mocked(updateConceptRecord).mockResolvedValue(fixture().concepts[0]);
	vi.mocked(updateConceptInstanceRecord).mockResolvedValue(fixture().instances[0]);
	vi.mocked(updateConceptInstancesBatch).mockResolvedValue(2);
	for (const client of [
		createConceptRecord,
		ensureConceptByTitle,
		updateConceptTitleFromInstanceRecord,
		deleteConceptInstanceRecord,
		deleteConceptInstancesBatch,
		importChildrenFromConceptInstance
	]) {
		vi.mocked(client).mockRejectedValue(new Error('Unexpected client call'));
	}
});

afterEach(() => {
	try {
		expect(fetchGuard).not.toHaveBeenCalled();
	} finally {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	}
});

describe('Editor save recovery', () => {
	it('returns false from an optimistic property update and restores last-loaded properties locally', async () => {
		const write = deferred<Awaited<ReturnType<typeof updateConceptRecord>>>();
		const failure = new Error('Property write failed');
		vi.mocked(updateConceptRecord).mockReturnValueOnce(write.promise);
		const card = { concept: editor.concepts[0], instance: editor.instances[0] };
		const properties = { status: 'unsaved', added: 'temporary' };

		const result = editor.setProperties(card, properties);

		expect(editor.concepts[0].properties).toEqual(properties);
		expect(invalidateAll).not.toHaveBeenCalled();
		write.reject(failure);
		await expect(result).resolves.toBe(false);
		expect(updateConceptRecord).toHaveBeenCalledExactlyOnceWith('test-concept', { properties });
		expect(invalidateAll).not.toHaveBeenCalled();
		expect(editor.concepts).toEqual(fixture().concepts);
		expect(editor.saveError).toContain('The last loaded data has been restored');
		expect(console.error).toHaveBeenCalledWith(expect.any(String), failure);
	});

	it('returns true from setProperties after the write and canonical refresh succeed', async () => {
		const persisted = fixture();
		persisted.concepts[0].properties = { status: 'changed', keep: 'original' };
		vi.mocked(invalidateAll).mockImplementationOnce(async () => editor.replaceData(persisted));

		await expect(
			editor.setProperties(
				{ concept: editor.concepts[0], instance: editor.instances[0] },
				persisted.concepts[0].properties
			)
		).resolves.toBe(true);

		expect(editor.concepts).toEqual(persisted.concepts);
		expect(invalidateAll).toHaveBeenCalledTimes(1);
		expect(editor.saveError).toBeNull();
	});

	it.each(['add', 'remove'] as const)(
		'restores last-loaded tags locally after an optimistic tag %s fails',
		async (operation) => {
			const failure = new Error('Tag write failed');
			const card = { concept: editor.concepts[0], instance: editor.instances[0] };
			const tag = fixture().concepts[1];
			const expectedTags = operation === 'add' ? ['test-tag', 'test-new-tag'] : [];
			const write = deferred<Awaited<ReturnType<typeof updateConceptRecord>>>();
			vi.mocked(updateConceptRecord).mockReturnValueOnce(write.promise);
			vi.mocked(ensureConceptByTitle).mockResolvedValueOnce({
				concept: { ...tag, id: 'test-new-tag', title: 'New test tag' },
				created: true
			});

			const result =
				operation === 'add' ? editor.addTag(card, 'New test tag') : editor.removeTag(card, tag);
			// addTag first awaits ensureConceptByTitle before applying its optimistic change.
			await Promise.resolve();
			expect(editor.concepts[0].tagConceptIds).toEqual(expectedTags);
			if (operation === 'add') {
				expect(ensureConceptByTitle).toHaveBeenCalledExactlyOnceWith('New test tag');
				expect(editor.concepts.map((concept) => concept.id)).toContain('test-new-tag');
			} else {
				expect(ensureConceptByTitle).not.toHaveBeenCalled();
			}

			write.reject(failure);
			await expect(result).resolves.toBeUndefined();

			expect(updateConceptRecord).toHaveBeenCalledExactlyOnceWith('test-concept', {
				tagConceptIds: expectedTags
			});
			expect(invalidateAll).not.toHaveBeenCalled();
			expect(editor.concepts).toEqual(fixture().concepts);
			expect(editor.saveError).toContain('The last loaded data has been restored');
			expect(console.error).toHaveBeenCalledWith(expect.any(String), failure);
		}
	);

	it('recovers without throwing if ensuring a tag fails before the optimistic update', async () => {
		const failure = new Error('Ensure tag failed');
		vi.mocked(ensureConceptByTitle).mockRejectedValueOnce(failure);

		await expect(
			editor.addTag({ concept: editor.concepts[0], instance: editor.instances[0] }, 'New tag')
		).resolves.toBeUndefined();

		expect(updateConceptRecord).not.toHaveBeenCalled();
		expect(invalidateAll).not.toHaveBeenCalled();
		expect(editor.concepts).toEqual(fixture().concepts);
		expect(editor.saveError).toContain('Could not confirm that the tag was saved');
		expect(console.error).toHaveBeenCalledWith(expect.any(String), failure);
	});

	it('restores last-loaded position and size locally after a failed instance save', async () => {
		Object.assign(editor.instances[0], geometry);
		vi.mocked(updateConceptInstanceRecord).mockRejectedValueOnce(new Error('Resize failed'));

		await expect(editor.updateInstance('test-instance-a', geometry)).resolves.toBe(false);

		expect(updateConceptInstanceRecord).toHaveBeenCalledExactlyOnceWith(
			'test-instance-a',
			geometry
		);
		expect(invalidateAll).not.toHaveBeenCalled();
		expect(editor.instances).toEqual(fixture().instances);
		expect(editor.saveError).toContain('The last loaded data has been restored');
	});

	it('restores every optimistic geometry change after a failed batch save', async () => {
		Object.assign(editor.instances[0], batchUpdates[0].updates);
		Object.assign(editor.instances[1], batchUpdates[1].updates);
		vi.mocked(updateConceptInstancesBatch).mockRejectedValueOnce(new Error('Group drag failed'));

		await expect(editor.updateInstancesBatch(batchUpdates)).resolves.toBe(false);

		expect(updateConceptInstancesBatch).toHaveBeenCalledExactlyOnceWith(batchUpdates);
		expect(invalidateAll).not.toHaveBeenCalled();
		expect(editor.instances).toEqual(fixture().instances);
		expect(editor.saveError).toContain('The last loaded data has been restored');
	});

	it.each(saveCases)(
		'$name save returns true only after write and invalidation succeed',
		async ({ client, args, save }) => {
			const reload = deferred<void>();
			vi.mocked(invalidateAll).mockReturnValueOnce(reload.promise);
			const settled = vi.fn();
			const result = save(editor).then((value) => {
				settled(value);
				return value;
			});
			await Promise.resolve();

			expect(client).toHaveBeenCalledExactlyOnceWith(...args);
			expect(invalidateAll).toHaveBeenCalledTimes(1);
			expect(settled).not.toHaveBeenCalled();
			reload.resolve();

			await expect(result).resolves.toBe(true);
			expect(editor.saveError).toBeNull();
			expect(console.error).not.toHaveBeenCalled();
		}
	);

	it('treats an empty batch as success without a request or invalidation', async () => {
		await expect(editor.updateInstancesBatch([])).resolves.toBe(true);

		expect(updateConceptInstancesBatch).not.toHaveBeenCalled();
		expect(updateConceptInstanceRecord).not.toHaveBeenCalled();
		expect(updateConceptRecord).not.toHaveBeenCalled();
		expect(invalidateAll).not.toHaveBeenCalled();
		expect(editor.saveError).toBeNull();
	});

	it('keeps the rollback baseline detached from the original fixture properties and tags', async () => {
		const originalProperties = loadedData.concepts[0].properties;
		const originalTags = loadedData.concepts[0].tagConceptIds;
		originalProperties.status = 'mutated through loader data';
		delete originalProperties.keep;
		originalTags.push('test-unsaved-tag');
		vi.mocked(updateConceptRecord).mockRejectedValueOnce(new Error('Offline write'));

		await expect(editor.updateConcept('test-concept', conceptUpdates)).resolves.toBe(false);

		expect(editor.concepts).toEqual(fixture().concepts);
		expect(editor.concepts[0].properties).not.toBe(originalProperties);
		expect(editor.concepts[0].tagConceptIds).not.toBe(originalTags);
		expect(originalProperties).toEqual({ status: 'mutated through loader data' });
		expect(originalTags).toEqual(['test-tag', 'test-unsaved-tag']);
		expect(invalidateAll).not.toHaveBeenCalled();
	});

	it.each(saveCases)(
		'$name save repeatedly rolls back nested properties, tags and geometry offline without navigation',
		async ({ client, args, save }) => {
			const writeError = new Error('Offline write');
			client.mockRejectedValue(writeError);
			vi.mocked(invalidateAll).mockRejectedValue(new Error('Offline navigation must not run'));

			for (let attempt = 1; attempt <= 3; attempt++) {
				const properties = editor.concepts[0].properties;
				const tags = editor.concepts[0].tagConceptIds;
				const instance = editor.instances[0];
				properties.status = `unsaved attempt ${attempt}`;
				properties.added = 'temporary';
				delete properties.keep;
				tags.splice(0, tags.length, `test-unsaved-tag-${attempt}`);
				Object.assign(instance, geometry);
				Object.assign(editor.instances[1], batchUpdates[1].updates);

				await expect(save(editor)).resolves.toBe(false);

				expect(editor.concepts).toEqual(fixture().concepts);
				expect(editor.instances).toEqual(fixture().instances);
				expect(editor.concepts[0].properties).not.toBe(properties);
				expect(editor.concepts[0].tagConceptIds).not.toBe(tags);
				expect(editor.instances[0]).not.toBe(instance);
				expect(client).toHaveBeenCalledTimes(attempt);
				expect(client).toHaveBeenLastCalledWith(...args);
				expect(invalidateAll).not.toHaveBeenCalled();
				expect(fetchGuard).not.toHaveBeenCalled();
				expect(editor.saveError).toContain('The last loaded data has been restored');
				expect(editor.saveError).toContain(
					'Reload when the server is available to check which changes were saved.'
				);
				expect(console.error).toHaveBeenCalledWith(expect.any(String), writeError);
			}
		}
	);

	it('uses the latest replaceData baseline and keeps it detached from later input mutations', async () => {
		const refreshed = fixture();
		refreshed.concepts[0].properties = { status: 'newly loaded', keep: 'new baseline' };
		refreshed.concepts[0].tagConceptIds = [];
		refreshed.instances[0].x = 75;
		const expected = structuredClone(refreshed);
		editor.replaceData(refreshed);
		refreshed.concepts[0].properties.status = 'mutated after loading';
		refreshed.concepts[0].tagConceptIds.push('test-unsaved-tag');
		Object.assign(editor.instances[0], geometry);
		vi.mocked(updateConceptInstanceRecord).mockRejectedValueOnce(new Error('Offline write'));

		await expect(editor.updateInstance('test-instance-a', geometry)).resolves.toBe(false);

		expect(editor.concepts).toEqual(expected.concepts);
		expect(editor.instances).toEqual(expected.instances);
		expect(editor.concepts[0].properties).not.toBe(refreshed.concepts[0].properties);
		expect(editor.concepts[0].tagConceptIds).not.toBe(refreshed.concepts[0].tagConceptIds);
		expect(invalidateAll).not.toHaveBeenCalled();
	});

	it.each(saveCases)(
		'$name save restores the last-loaded baseline when the write succeeds but its refresh throws',
		async ({ client, args, save }) => {
			const refreshError = new Error('Refresh failed after write');
			editor.concepts[0].properties.status = 'optimistic change';
			editor.concepts[0].tagConceptIds.push('test-unsaved-tag');
			Object.assign(editor.instances[0], geometry);
			Object.assign(editor.instances[1], batchUpdates[1].updates);
			vi.mocked(invalidateAll).mockRejectedValue(refreshError);

			await expect(save(editor)).resolves.toBe(false);

			expect(client).toHaveBeenCalledExactlyOnceWith(...args);
			expect(invalidateAll).toHaveBeenCalledTimes(1);
			expect(editor.concepts).toEqual(fixture().concepts);
			expect(editor.instances).toEqual(fixture().instances);
			expect(editor.saveError).toContain('The last loaded data has been restored');
			expect(editor.saveError).toContain(
				'Reload when the server is available to check which changes were saved.'
			);
			expect(console.error).toHaveBeenCalledExactlyOnceWith(expect.any(String), refreshError);
		}
	);
});

describe('Camera saves and the rollback baseline', () => {
	it.each(saveCases)(
		'retains the successfully saved camera after an unrelated failed $name save',
		async ({ client, save }) => {
			const camera = { panX: 125, panY: -75, zoom: 1.75 };
			const savedInstance = {
				...fixture().instances[0],
				lastCameraPanX: 130,
				lastCameraPanY: -80,
				lastCameraZoom: 1.8
			};
			const expectedInstance = { ...savedInstance };
			editor.currentCanvasOwnerInstanceId = 'test-instance-a';
			editor.canvas.applyCamera(camera);
			vi.mocked(updateConceptInstanceRecord).mockResolvedValueOnce(savedInstance);

			await editor.canvas.saveCurrentCanvasCamera();

			expect(updateConceptInstanceRecord).toHaveBeenCalledExactlyOnceWith('test-instance-a', {
				lastCameraPanX: camera.panX,
				lastCameraPanY: camera.panY,
				lastCameraZoom: camera.zoom
			});
			expect(invalidateAll).not.toHaveBeenCalled();
			// The baseline must keep the returned record's values without sharing its reference.
			savedInstance.lastCameraPanX = -999;
			savedInstance.x = -100;
			editor.concepts[0].properties.status = 'unsaved metadata';
			Object.assign(editor.instances[0], geometry);
			Object.assign(editor.instances[1], batchUpdates[1].updates);
			client.mockRejectedValueOnce(new Error('Unrelated write failed'));

			await expect(save(editor)).resolves.toBe(false);

			expect(editor.concepts).toEqual(fixture().concepts);
			expect(editor.instances).toEqual([expectedInstance, fixture().instances[1]]);
			expect(editor.saveError).toContain('The last loaded data has been restored');
			expect(invalidateAll).not.toHaveBeenCalled();

			editor.currentCanvasOwnerInstanceId = null;
			editor.canvas.applyCamera({ panX: 0, panY: 0, zoom: 1 });
			const requestsBeforeReopening = vi.mocked(updateConceptInstanceRecord).mock.calls.length;

			await editor.openInstanceCanvas('test-instance-a');

			expect(editor.currentCanvasOwnerInstanceId).toBe('test-instance-a');
			expect(editor.canvas.getCurrentCamera()).toEqual({ panX: 130, panY: -80, zoom: 1.8 });
			expect(updateConceptInstanceRecord).toHaveBeenCalledTimes(requestsBeforeReopening);
			expect(invalidateAll).not.toHaveBeenCalled();
		}
	);

	it('does not advance the rollback baseline when the camera PATCH fails', async () => {
		const camera = { panX: 250, panY: -150, zoom: 2 };
		const failure = new Error('Camera PATCH failed');
		editor.currentCanvasOwnerInstanceId = 'test-instance-a';
		editor.canvas.applyCamera(camera);
		vi.mocked(updateConceptInstanceRecord).mockRejectedValueOnce(failure);

		await expect(editor.canvas.saveCurrentCanvasCamera()).rejects.toBe(failure);

		expect(updateConceptInstanceRecord).toHaveBeenCalledExactlyOnceWith('test-instance-a', {
			lastCameraPanX: camera.panX,
			lastCameraPanY: camera.panY,
			lastCameraZoom: camera.zoom
		});
		expect(invalidateAll).not.toHaveBeenCalled();
		vi.mocked(updateConceptRecord).mockRejectedValueOnce(new Error('Unrelated metadata failure'));

		await expect(
			editor.setProperties(
				{ concept: editor.concepts[0], instance: editor.instances[0] },
				{ status: 'unsaved' }
			)
		).resolves.toBe(false);

		expect(editor.instances).toEqual(fixture().instances);
		expect(editor.canvas.getSavedCameraForInstance(editor.instances[0])).toEqual({
			panX: 0,
			panY: 0,
			zoom: 1
		});
		expect(editor.concepts).toEqual(fixture().concepts);
		expect(invalidateAll).not.toHaveBeenCalled();
	});
});

function activeElement(matchingSelector: string | null) {
	const element = {
		closest: vi.fn((selectors: string) =>
			matchingSelector && selectors.split(', ').includes(matchingSelector) ? element : null
		)
	};
	vi.stubGlobal('document', { activeElement: element });
	return element;
}

function keydown(code: string) {
	return { code, preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as KeyboardEvent;
}

describe('CanvasController keyboard regression', () => {
	it.each(['input', '[contenteditable="true"]', 'button'])(
		'does not toggle Space panning or consume the key inside %s',
		async (selector) => {
			const element = activeElement(selector);
			const event = keydown('Space');

			await editor.canvas.handleWindowKeydown(event);
			expect(editor.canvas.panToggleOnSpace).toBe(false);
			editor.canvas.panToggleOnSpace = true;
			await editor.canvas.handleWindowKeydown(event);
			expect(editor.canvas.panToggleOnSpace).toBe(true);
			expect(element.closest).toHaveBeenCalledTimes(2);
			expect(event.preventDefault).not.toHaveBeenCalled();
			expect(event.stopPropagation).not.toHaveBeenCalled();
		}
	);

	it('toggles Space panning on and off outside interactive elements', async () => {
		activeElement(null);

		await editor.canvas.handleWindowKeydown(keydown('Space'));
		expect(editor.canvas.panToggleOnSpace).toBe(true);
		await editor.canvas.handleWindowKeydown(keydown('Space'));
		expect(editor.canvas.panToggleOnSpace).toBe(false);
	});

	it.each(['input', '[contenteditable="true"]', 'button', null])(
		'Escape still closes both menus with active element %s',
		async (selector) => {
			activeElement(selector);
			editor.contextMenu = {
				visible: true,
				x: 10,
				y: 20,
				targetType: 'card',
				instanceId: 'test-instance-a'
			};
			editor.openImportChildrenMenu();
			expect(editor.importChildrenMenu.visible).toBe(true);

			await editor.canvas.handleWindowKeydown(keydown('Escape'));

			expect(editor.contextMenu.visible).toBe(false);
			expect(editor.contextMenu.instanceId).toBeNull();
			expect(editor.importChildrenMenu.visible).toBe(false);
			expect(editor.importChildrenMenu.targetInstanceId).toBeNull();
		}
	);
});

describe('Editor creation parent selection', () => {
	it.each([
		{ title: 'omitted parent', options: {}, expected: 'test-instance-a' },
		{
			title: 'undefined parent',
			options: { parentInstanceId: undefined },
			expected: 'test-instance-a'
		},
		{ title: 'explicit root', options: { parentInstanceId: null }, expected: null },
		{
			title: 'explicit parent',
			options: { parentInstanceId: 'test-instance-b' },
			expected: 'test-instance-b'
		}
	])('uses the correct parent for: $name', async ({ options, expected }) => {
		editor.currentCanvasOwnerInstanceId = 'test-instance-a';
		vi.mocked(createConceptRecord).mockResolvedValueOnce({
			concept: loadedData.concepts[0],
			instance: loadedData.instances[0]
		});
		vi.mocked(invalidateAll).mockResolvedValueOnce(undefined);

		await editor.createConcept({ ...options, focusAfterCreate: false });

		expect(createConceptRecord).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ parentInstanceId: expected })
		);
	});
});

describe('Editor Context data', () => {
	it('loads and refreshes project metadata without replacing the Editor', () => {
		expect(editor.context.title).toBe('Test project');
		const refreshed = fixture();
		refreshed.context.title = 'Renamed project';
		refreshed.context.properties = { status: 'updated' };
		editor.replaceData(refreshed);
		expect(editor.context.title).toBe('Renamed project');
		expect(editor.context.properties).toEqual({ status: 'updated' });
		expect(editor.getRootCards()).toHaveLength(2);
	});
	it('refreshes loaded Context metadata after a successful save', async () => {
		const refreshed = fixture();
		refreshed.context.title = 'Saved project';
		vi.mocked(invalidateAll).mockImplementationOnce(async () => editor.replaceData(refreshed));
		await expect(editor.updateContext({ title: 'Saved project' })).resolves.toBe(true);
		expect(editor.context.title).toBe('Saved project');
	});
	it('restores detached Context metadata on failed saves without navigation', async () => {
		loadedData.context.title = 'Mutated input';
		editor.context.title = 'Unsaved name';
		editor.context.properties.status = 'Unsaved property';
		editor.context.notes.text = 'Unsaved notes';
		vi.mocked(updateContextRecord).mockRejectedValueOnce(new Error('Offline'));
		await expect(editor.updateContext({ title: 'Unsaved name' })).resolves.toBe(false);
		expect(editor.context).toEqual(fixture().context);
		expect(invalidateAll).not.toHaveBeenCalled();
	});
});

describe('Context sidebar commands', () => {
	it('saves Context properties without updating a Concept', async () => {
		vi.mocked(invalidateAll).mockResolvedValueOnce(undefined);
		await expect(editor.setContextProperties({ status: 'project' })).resolves.toBe(true);
		expect(editor.context.properties).toEqual({ status: 'project' });
		expect(updateContextRecord).toHaveBeenCalledExactlyOnceWith({
			properties: { status: 'project' }
		});
		expect(updateConceptRecord).not.toHaveBeenCalled();
	});
	it('restores saved Context properties after a failed property edit', async () => {
		vi.mocked(updateContextRecord).mockRejectedValueOnce(new Error('Offline'));
		await expect(editor.setContextProperties({ status: 'unsaved' })).resolves.toBe(false);
		expect(editor.context.properties).toEqual(fixture().context.properties);
		expect(invalidateAll).not.toHaveBeenCalled();
	});
	it('adds a tag Concept reference to the Context and removes duplicates', async () => {
		const tag = fixture().concepts[1];
		editor.context.tagConceptIds = [tag.id];
		vi.mocked(ensureConceptByTitle).mockResolvedValueOnce({ concept: tag, created: false });
		vi.mocked(invalidateAll).mockResolvedValueOnce(undefined);
		await expect(editor.addContextTag(tag.title)).resolves.toBe(true);
		expect(ensureConceptByTitle).toHaveBeenCalledExactlyOnceWith(tag.title);
		expect(updateContextRecord).toHaveBeenCalledExactlyOnceWith({ tagConceptIds: [tag.id] });
		expect(updateConceptRecord).not.toHaveBeenCalled();
	});
	it('makes a newly created tag available without modifying a Concept sidebar owner', async () => {
		const tag = { ...fixture().concepts[1], id: 'new-tag', title: 'New tag' };
		vi.mocked(ensureConceptByTitle).mockResolvedValueOnce({ concept: tag, created: true });
		vi.mocked(invalidateAll).mockResolvedValueOnce(undefined);
		await expect(editor.addContextTag(tag.title)).resolves.toBe(true);
		expect(editor.getConceptById(tag.id)).toEqual(tag);
		expect(editor.context.tagConceptIds).toEqual([tag.id]);
		expect(editor.concepts[0].tagConceptIds).toEqual(fixture().concepts[0].tagConceptIds);
	});
	it('removes only the selected Context tag reference', async () => {
		const tag = fixture().concepts[1];
		editor.context.tagConceptIds = [tag.id, 'other-tag'];
		vi.mocked(invalidateAll).mockResolvedValueOnce(undefined);
		await expect(editor.removeContextTag(tag)).resolves.toBe(true);
		expect(updateContextRecord).toHaveBeenCalledExactlyOnceWith({ tagConceptIds: ['other-tag'] });
		expect(editor.getConceptById(tag.id)).toEqual(tag);
		expect(updateConceptRecord).not.toHaveBeenCalled();
	});
	it('recovers when ensuring a Context tag fails before the metadata save', async () => {
		vi.mocked(ensureConceptByTitle).mockRejectedValueOnce(new Error('Offline'));
		await expect(editor.addContextTag('New tag')).resolves.toBe(false);
		expect(editor.context).toEqual(fixture().context);
		expect(updateContextRecord).not.toHaveBeenCalled();
		expect(invalidateAll).not.toHaveBeenCalled();
	});
});

describe('context-menu instance deletion', () => {
	function menu(instanceId: string) {
		editor.contextMenu = { visible: true, x: 10, y: 10, targetType: 'card', instanceId };
	}
	it('deletes the selected visible group in one request and clears stale selection/drag state', async () => {
		const ids = fixture().instances.map((instance) => instance.id);
		editor.selectedInstanceIds = new Set(ids);
		editor.activeInstanceId = ids[0];
		editor.pendingFocusInstanceId = ids[1];
		editor.canvas.pendingDragState = {
			...editor.canvas.pendingDragState,
			active: true,
			instanceId: ids[0]
		};
		menu(ids[0]);
		const refreshed = fixture();
		refreshed.instances = [];
		vi.mocked(deleteConceptInstancesBatch).mockResolvedValueOnce(2);
		vi.mocked(invalidateAll).mockImplementationOnce(async () => editor.replaceData(refreshed));
		await expect(editor.deleteInstanceFromMenu()).resolves.toBe(true);
		expect(deleteConceptInstancesBatch).toHaveBeenCalledExactlyOnceWith(ids);
		expect(deleteConceptInstanceRecord).not.toHaveBeenCalled();
		expect(invalidateAll).toHaveBeenCalledTimes(1);
		expect(editor.instances).toEqual([]);
		expect(editor.concepts).toEqual(fixture().concepts);
		expect(editor.selectedInstanceIds.size).toBe(0);
		expect(editor.activeInstanceId).toBeNull();
		expect(editor.pendingFocusInstanceId).toBeNull();
		expect(editor.canvas.pendingDragState.active).toBe(false);
		expect(editor.contextMenu.visible).toBe(false);
	});
	it('does not expand a single unselected menu target into another selection', async () => {
		editor.selectOnlyInstance('test-instance-a');
		menu('test-instance-b');
		vi.mocked(deleteConceptInstancesBatch).mockResolvedValueOnce(1);
		vi.mocked(invalidateAll).mockResolvedValueOnce(undefined);
		await expect(editor.deleteInstanceFromMenu()).resolves.toBe(true);
		expect(deleteConceptInstancesBatch).toHaveBeenCalledExactlyOnceWith(['test-instance-b']);
		expect(deleteConceptInstanceRecord).not.toHaveBeenCalled();
		expect([...editor.selectedInstanceIds]).toEqual(['test-instance-a']);
	});
	it('ignores selected IDs that are not visible on the current canvas', () => {
		editor.instances = [
			...editor.instances,
			{ ...fixture().instances[0], id: 'child', parentInstanceId: 'test-instance-a' }
		];
		editor.selectedInstanceIds = new Set(['test-instance-a', 'test-instance-b', 'child', 'stale']);
		menu('test-instance-a');
		expect(editor.getContextMenuDeleteInstanceIds()).toEqual([
			'test-instance-a',
			'test-instance-b'
		]);
	});
	it('deduplicates batch IDs', async () => {
		vi.mocked(deleteConceptInstancesBatch).mockResolvedValueOnce(2);
		vi.mocked(invalidateAll).mockResolvedValueOnce(undefined);
		await expect(
			editor.deleteInstances(['test-instance-a', 'test-instance-a', 'test-instance-b'])
		).resolves.toBe(true);
		expect(deleteConceptInstancesBatch).toHaveBeenCalledExactlyOnceWith([
			'test-instance-a',
			'test-instance-b'
		]);
	});
	it('does nothing without a card target or instances', async () => {
		await expect(editor.deleteInstanceFromMenu()).resolves.toBe(true);
		expect(deleteConceptInstancesBatch).not.toHaveBeenCalled();
		expect(deleteConceptInstanceRecord).not.toHaveBeenCalled();
		expect(invalidateAll).not.toHaveBeenCalled();
	});
	it('keeps loaded records and reports a failed group deletion without navigating', async () => {
		editor.selectedInstanceIds = new Set(['test-instance-a', 'test-instance-b']);
		menu('test-instance-a');
		vi.mocked(deleteConceptInstancesBatch).mockRejectedValueOnce(new Error('Offline'));
		await expect(editor.deleteInstanceFromMenu()).resolves.toBe(false);
		expect(editor.instances).toEqual(fixture().instances);
		expect(editor.selectedInstanceIds.size).toBe(2);
		expect(editor.saveError).toContain('Could not confirm that instances were deleted');
		expect(invalidateAll).not.toHaveBeenCalled();
	});
	it('keeps a selected group when right-clicking one of its cards', () => {
		editor.selectedInstanceIds = new Set(['test-instance-a', 'test-instance-b']);
		const event = {
			preventDefault: vi.fn(),
			stopPropagation: vi.fn(),
			clientX: 10,
			clientY: 10
		} as unknown as MouseEvent;
		editor.canvas.handleCardContextMenu(event, editor.getCard('test-instance-a')!);
		expect(editor.getContextMenuDeleteInstanceIds()).toEqual([
			'test-instance-a',
			'test-instance-b'
		]);
	});
	it('right-clicking an unselected card targets only that card', () => {
		editor.selectOnlyInstance('test-instance-a');
		const event = {
			preventDefault: vi.fn(),
			stopPropagation: vi.fn(),
			clientX: 10,
			clientY: 10
		} as unknown as MouseEvent;
		editor.canvas.handleCardContextMenu(event, editor.getCard('test-instance-b')!);
		expect(editor.getContextMenuDeleteInstanceIds()).toEqual(['test-instance-b']);
	});
});

describe('stale deletion targets', () => {
	function menu(instanceId: string) {
		editor.contextMenu = { visible: true, x: 0, y: 0, targetType: 'card', instanceId };
	}
	it('does not send an absent unselected menu target and clears stale active references', async () => {
		editor.activeInstanceId = 'missing';
		editor.pendingFocusInstanceId = 'missing';
		menu('missing');
		expect(editor.getContextMenuDeleteInstanceIds()).toEqual([]);
		await expect(editor.deleteInstanceFromMenu()).resolves.toBe(true);
		expect(deleteConceptInstancesBatch).not.toHaveBeenCalled();
		expect(deleteConceptInstanceRecord).not.toHaveBeenCalled();
		expect(editor.activeInstanceId).toBeNull();
		expect(editor.pendingFocusInstanceId).toBeNull();
	});
	it('keeps an unrelated valid selection when the unselected menu target is stale', async () => {
		editor.selectOnlyInstance('test-instance-a');
		menu('missing');
		await expect(editor.deleteInstanceFromMenu()).resolves.toBe(true);
		expect(deleteConceptInstancesBatch).not.toHaveBeenCalled();
		expect([...editor.selectedInstanceIds]).toEqual(['test-instance-a']);
	});
	it('uses surviving selected records after the menu target disappears on refresh', async () => {
		editor.selectedInstanceIds = new Set(['test-instance-a', 'test-instance-b']);
		menu('test-instance-a');
		const refreshed = fixture();
		refreshed.instances = [refreshed.instances[1]];
		editor.replaceData(refreshed);
		expect(editor.getContextMenuDeleteInstanceIds()).toEqual(['test-instance-b']);
		vi.mocked(deleteConceptInstancesBatch).mockResolvedValueOnce(1);
		vi.mocked(invalidateAll).mockResolvedValueOnce(undefined);
		await expect(editor.deleteInstanceFromMenu()).resolves.toBe(true);
		expect(deleteConceptInstancesBatch).toHaveBeenCalledExactlyOnceWith(['test-instance-b']);
		expect(editor.selectedInstanceIds.size).toBe(0);
	});
	it('does not use a menu target that has moved off the current canvas', async () => {
		editor.instances[0].parentInstanceId = 'test-instance-b';
		menu('test-instance-a');
		await expect(editor.deleteInstanceFromMenu()).resolves.toBe(true);
		expect(deleteConceptInstancesBatch).not.toHaveBeenCalled();
	});
	it('filters missing IDs from direct deletion requests and prunes stale selection', async () => {
		editor.selectedInstanceIds = new Set(['missing', 'test-instance-a']);
		vi.mocked(deleteConceptInstancesBatch).mockResolvedValueOnce(1);
		vi.mocked(invalidateAll).mockResolvedValueOnce(undefined);
		await expect(editor.deleteInstances(['missing', 'test-instance-a', 'missing'])).resolves.toBe(
			true
		);
		expect(deleteConceptInstancesBatch).toHaveBeenCalledExactlyOnceWith(['test-instance-a']);
		expect(deleteConceptInstanceRecord).not.toHaveBeenCalled();
		expect(editor.selectedInstanceIds.size).toBe(0);
	});
	it('refreshes rather than failing when the server already removed the single target', async () => {
		editor.selectOnlyInstance('test-instance-a');
		const refreshed = fixture();
		refreshed.instances = [refreshed.instances[1]];
		vi.mocked(deleteConceptInstancesBatch).mockResolvedValueOnce(0);
		vi.mocked(invalidateAll).mockImplementationOnce(async () => editor.replaceData(refreshed));
		await expect(editor.deleteInstance('test-instance-a')).resolves.toBe(true);
		expect(deleteConceptInstancesBatch).toHaveBeenCalledExactlyOnceWith(['test-instance-a']);
		expect(deleteConceptInstanceRecord).not.toHaveBeenCalled();
		expect(editor.getCard('test-instance-a')).toBeUndefined();
		expect(editor.saveError).toBeNull();
		expect(editor.activeInstanceId).toBeNull();
	});
});

describe('blank-canvas right-click hold', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal('window', { setTimeout: vi.fn(setTimeout), clearTimeout: vi.fn(clearTimeout) });
	});
	afterEach(() => vi.useRealTimers());
	function pointer(button: number) {
		return { button, clientX: 100, clientY: 200 } as PointerEvent;
	}
	it('schedules the TODO callback for 1500ms without changing selection or opening a menu', () => {
		editor.selectOnlyInstance('test-instance-a');
		editor.canvas.handleCanvasPointerDown(pointer(2));
		expect(window.setTimeout).toHaveBeenCalledExactlyOnceWith(expect.any(Function), 1500);
		expect(vi.getTimerCount()).toBe(1);
		vi.advanceTimersByTime(1499);
		expect(vi.getTimerCount()).toBe(1);
		vi.advanceTimersByTime(1);
		expect(vi.getTimerCount()).toBe(0);
		expect([...editor.selectedInstanceIds]).toEqual(['test-instance-a']);
		expect(editor.contextMenu.visible).toBe(false);
		expect(editor.canvas.selectionBoxState.active).toBe(false);
		expect(editor.canvas.isPanning).toBe(false);
		editor.canvas.cancelRightClickHold();
		expect(window.clearTimeout).not.toHaveBeenCalled();
	});
	it('opens the regular menu only on a short right-button release', async () => {
		vi.spyOn(editor.canvas, 'getWorldPointFromEvent').mockReturnValue({ x: 25, y: 50 });
		editor.canvas.handleCanvasPointerDown(pointer(2));
		vi.advanceTimersByTime(1499);
		expect(editor.contextMenu.visible).toBe(false);
		await editor.canvas.handleWindowPointerUp(pointer(2));
		expect(window.clearTimeout).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(0);
		expect(editor.contextMenu).toMatchObject({
			visible: true,
			targetType: 'canvas',
			x: 100,
			y: 200,
			worldX: 25,
			worldY: 50
		});
		vi.advanceTimersByTime(1500);
		expect(editor.contextMenu.visible).toBe(true);
	});
	it('replaces a pending hold rather than scheduling two callbacks', () => {
		editor.canvas.handleCanvasPointerDown(pointer(2));
		vi.advanceTimersByTime(1000);
		editor.canvas.handleCanvasPointerDown(pointer(2));
		expect(window.setTimeout).toHaveBeenCalledTimes(2);
		expect(window.clearTimeout).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(500);
		expect(vi.getTimerCount()).toBe(1);
		vi.advanceTimersByTime(1000);
		expect(vi.getTimerCount()).toBe(0);
	});
	it('cancels through interaction reset and tolerates repeated cancellation', () => {
		editor.canvas.handleCanvasPointerDown(pointer(2));
		editor.canvas.clearInteractiveState();
		editor.canvas.cancelRightClickHold();
		expect(window.clearTimeout).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(0);
	});
	it('does not cancel a held right button when another button is released', async () => {
		editor.canvas.handleCanvasPointerDown(pointer(2));
		await editor.canvas.handleWindowPointerUp(pointer(0));
		expect(vi.getTimerCount()).toBe(1);
		editor.canvas.cancelRightClickHold();
		expect(vi.getTimerCount()).toBe(0);
	});
	it('does not schedule a hold for an unrelated pointer button', () => {
		editor.canvas.handleCanvasPointerDown(pointer(3));
		expect(window.setTimeout).not.toHaveBeenCalled();
	});
	it('suppresses the regular menu on release after a long hold', async () => {
		editor.canvas.handleCanvasPointerDown(pointer(2));
		vi.advanceTimersByTime(1500);
		await editor.canvas.handleWindowPointerUp(pointer(2));
		expect(editor.contextMenu.visible).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
	});
	it('prevents the native context menu without opening or reopening ours', async () => {
		const event = { preventDefault: vi.fn() } as unknown as MouseEvent;
		const open = vi.spyOn(editor.canvas, 'openCanvasContextMenu');
		editor.canvas.handleCanvasPointerDown(pointer(2));
		editor.canvas.handleCanvasContextMenu(event);
		expect(event.preventDefault).toHaveBeenCalledTimes(1);
		expect(open).not.toHaveBeenCalled();
		await editor.canvas.handleWindowPointerUp(pointer(2));
		expect(open).toHaveBeenCalledTimes(1);
		editor.canvas.handleCanvasContextMenu(event);
		expect(open).toHaveBeenCalledTimes(1);
	});
	it('does not open a menu on release after cancellation', async () => {
		editor.canvas.handleCanvasPointerDown(pointer(2));
		editor.canvas.cancelRightClickHold();
		await editor.canvas.handleWindowPointerUp(pointer(2));
		expect(editor.contextMenu.visible).toBe(false);
	});
	it('leaves card context-menu handling unchanged', async () => {
		const event = {
			preventDefault: vi.fn(),
			stopPropagation: vi.fn(),
			clientX: 100,
			clientY: 200
		} as unknown as MouseEvent;
		editor.canvas.handleCardContextMenu(event, editor.getCard('test-instance-a')!);
		await editor.canvas.handleWindowPointerUp(pointer(2));
		expect(editor.contextMenu).toMatchObject({
			visible: true,
			targetType: 'card',
			instanceId: 'test-instance-a'
		});
	});
});

describe('middle-button panning defaults', () => {
	it.each(['canvas', 'card'])(
		'prevents native press and release actions when panning from a %s',
		async (surface) => {
			const down = {
				button: 1,
				clientX: 100,
				clientY: 200,
				preventDefault: vi.fn()
			} as unknown as PointerEvent;
			const up = { button: 1, preventDefault: vi.fn() } as unknown as PointerEvent;
			if (surface === 'canvas') {
				editor.canvas.handleCanvasPointerDown(down);
			} else {
				editor.canvas.handleCardPointerDown(down, editor.getCard('test-instance-a')!);
			}
			expect(down.preventDefault).toHaveBeenCalledTimes(1);
			expect(editor.canvas.isPanning).toBe(true);
			await editor.canvas.handleWindowPointerUp(up);
			expect(up.preventDefault).toHaveBeenCalledTimes(1);
			expect(editor.canvas.isPanning).toBe(false);
			expect(createConceptRecord).not.toHaveBeenCalled();
		}
	);
	it('does not suppress a middle release outside a panning interaction', async () => {
		const event = { button: 1, preventDefault: vi.fn() } as unknown as PointerEvent;
		await editor.canvas.handleWindowPointerUp(event);
		expect(event.preventDefault).not.toHaveBeenCalled();
	});
	it('keeps explicit paste import available', async () => {
		activeElement(null);
		const importItems = vi
			.spyOn(editor.canvas, 'createConceptsFromParsedItems')
			.mockResolvedValue(undefined);
		const event = {
			clipboardData: { getData: vi.fn(() => 'Explicit paste') },
			preventDefault: vi.fn(),
			stopPropagation: vi.fn()
		} as unknown as ClipboardEvent;
		await editor.canvas.handleCanvasPaste(event);
		expect(importItems).toHaveBeenCalledTimes(1);
		expect(event.preventDefault).toHaveBeenCalledTimes(1);
	});
});

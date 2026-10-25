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
	importChildrenFromConceptInstance,
	updateConceptInstanceRecord,
	updateConceptInstancesBatch
} from '$lib/client/conceptInstances';
import { Editor } from './Editor.svelte';
import type { EditorData } from './EditorTypes';

vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn() }));
vi.mock('$lib/client/concepts', () => ({
	createConceptRecord: vi.fn(),
	ensureConceptByTitle: vi.fn(),
	updateConceptRecord: vi.fn(),
	updateConceptTitleFromInstanceRecord: vi.fn()
}));
vi.mock('$lib/client/conceptInstances', () => ({
	deleteConceptInstanceRecord: vi.fn(),
	importChildrenFromConceptInstance: vi.fn(),
	updateConceptInstanceRecord: vi.fn(),
	updateConceptInstancesBatch: vi.fn()
}));

function fixture(): EditorData {
	return {
		concepts: [
			{
				id: 'test-concept',
				title: 'Test item',
				properties: { status: 'saved', keep: 'original' },
				tagConceptIds: ['test-tag']
			},
			{ id: 'test-tag', title: 'Test tag', properties: {}, tagConceptIds: [] }
		],
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
		],
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
		name: 'Concept',
		client: vi.mocked(updateConceptRecord),
		args: ['test-concept', conceptUpdates],
		save: (editor: Editor) => editor.updateConcept('test-concept', conceptUpdates)
	},
	{
		name: 'instance',
		client: vi.mocked(updateConceptInstanceRecord),
		args: ['test-instance-a', geometry],
		save: (editor: Editor) => editor.updateInstance('test-instance-a', geometry)
	},
	{
		name: 'batch',
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

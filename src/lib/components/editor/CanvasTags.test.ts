import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { normalizeConcept } from '$lib/model/normalizeConcept';
import { normalizeConceptInstance } from '$lib/model/normalizeConceptInstance';
import { normalizeContext } from '$lib/model/normalizeContext';
import { Editor } from './Editor.svelte';
import ConceptTagsPreview from './ConceptTagsPreview.svelte';

vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn() }));

vi.mock('$lib/client/concepts', () => ({
	createConceptRecord: vi.fn(),
	updateConceptRecord: vi.fn(),
	updateConceptTitleFromInstanceRecord: vi.fn()
}));

const fetchGuard = vi.fn(() => {
	throw new Error('Canvas Tag tests must not make real requests');
});

const tagMime = 'application/x-concept-editor-tag';
let editor: Editor;
vi.mock('./EditorContext', () => ({ getEditorContext: () => editor }));

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal('fetch', fetchGuard);
	vi.spyOn(console, 'error').mockImplementation(() => {});
	editor = new Editor({
		context: normalizeContext({ id: 'project' }),
		tags: [{ id: 'tag-id', title: 'Tag title' }],
		concepts: [normalizeConcept({ id: 'concept-id', title: 'Concept title' })],
		instances: [normalizeConceptInstance({ id: 'instance-id', conceptId: 'concept-id' })],
		relationships: [],
		relationshipDefinitions: []
	});
});

afterEach(() => {
	try {
		expect(fetchGuard).not.toHaveBeenCalled();
	} finally {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	}
});

function dragEvent(types = [tagMime], tagId = 'tag-id') {
	const dataTransfer = {
		types,
		getData: vi.fn((type: string) => (type === tagMime ? tagId : '')),
		dropEffect: 'none'
	};
	const canvas = {
		getBoundingClientRect: () => ({ left: 100, top: 50 }),
		closest: vi.fn(() => null)
	};
	return {
		dataTransfer,
		clientX: 350,
		clientY: 170,
		target: canvas,
		currentTarget: canvas,
		preventDefault: vi.fn(),
		stopPropagation: vi.fn()
	};
}

describe('native canvas Tag drag and drop', () => {
	it('allows custom Tag drags but does not consume unrelated native drags', () => {
		const tag = dragEvent();
		editor.canvas.handleCanvasTagDragOver(tag as unknown as DragEvent);
		expect(tag.preventDefault).toHaveBeenCalledTimes(1);
		const text = dragEvent(['text/plain']);
		editor.canvas.handleCanvasTagDragOver(text as unknown as DragEvent);
		expect(text.preventDefault).not.toHaveBeenCalled();
	});

	it('reads the Tag ID from the custom MIME type and converts screen placement using the camera', async () => {
		const event = dragEvent();
		editor.canvas.canvasElement = event.currentTarget as unknown as HTMLElement;
		editor.canvas.panX = 20;
		editor.canvas.panY = -10;
		editor.canvas.zoom = 2;
		const create = vi.spyOn(editor, 'createInstanceFromTag').mockResolvedValue(undefined);

		await editor.canvas.handleCanvasTagDrop(event as unknown as DragEvent);

		expect(event.dataTransfer.getData).toHaveBeenCalledWith(tagMime);
		expect(create).toHaveBeenCalledExactlyOnceWith('tag-id', { x: 115, y: 65 });
		expect(event.preventDefault).toHaveBeenCalledTimes(1);
	});

	it.each([
		{ types: ['text/plain'], tagId: 'not-a-tag', name: 'ordinary text' },
		{ types: [tagMime], tagId: '', name: 'an empty Tag payload' }
	])('does not create an instance for $name', async ({ types, tagId }) => {
		const event = dragEvent(types, tagId);
		editor.canvas.canvasElement = event.currentTarget as unknown as HTMLElement;
		const create = vi.spyOn(editor, 'createInstanceFromTag').mockResolvedValue(undefined);
		await editor.canvas.handleCanvasTagDrop(event as unknown as DragEvent);
		expect(create).not.toHaveBeenCalled();
	});
});

describe('Concept tag-area pointer drops', () => {
	it('preserves the dragged child Concept identity while creating a separate Tag reference', async () => {
		const source = editor.getCard('instance-id')!;
		const targetConcept = normalizeConcept({ id: 'target-concept', title: 'Target' });
		editor.concepts = [...editor.concepts, targetConcept];
		editor.instances = [
			...editor.instances,
			normalizeConceptInstance({ id: 'target-instance', conceptId: targetConcept.id })
		];
		const target = editor.getCard('target-instance')!;
		editor.canvas.childDragState = { active: true, childCard: source, mouseX: 0, mouseY: 0 };
		vi.spyOn(editor.canvas, 'getDropTargetAtPoint').mockReturnValue({
			targetTagInstanceId: 'target-instance',
			targetParentInstanceId: null
		});
		const add = vi.spyOn(editor, 'addTag').mockResolvedValue(undefined);
		await editor.canvas.finishChildDrag({ clientX: 10, clientY: 20 } as PointerEvent);
		expect(add).toHaveBeenCalledExactlyOnceWith(target, 'Concept title', 'concept-id');
	});

	it('preserves dragged card Concept identity while creating separate Tag references', async () => {
		const targetConcept = normalizeConcept({ id: 'target-concept', title: 'Target' });
		editor.concepts = [...editor.concepts, targetConcept];
		editor.instances = [
			...editor.instances,
			normalizeConceptInstance({ id: 'target-instance', conceptId: targetConcept.id })
		];
		const target = editor.getCard('target-instance')!;
		editor.canvas.dragState = {
			active: true,
			instanceId: 'instance-id',
			startMouseX: 0,
			startMouseY: 0,
			startInstanceX: 0,
			startInstanceY: 0,
			draggedCards: [{ instanceId: 'instance-id', startX: 0, startY: 0 }]
		};
		vi.spyOn(editor.canvas, 'getDropTargetAtPoint').mockReturnValue({
			targetTagInstanceId: 'target-instance',
			targetParentInstanceId: null
		});
		const add = vi.spyOn(editor, 'addTag').mockResolvedValue(undefined);
		await editor.canvas.finishCardDrag({ clientX: 10, clientY: 20 } as PointerEvent);
		expect(add).toHaveBeenCalledExactlyOnceWith(target, 'Concept title', 'concept-id');
	});
});

describe('Tag tile markup', () => {
	it('renders a draggable Tag tile and keeps the removal action', () => {
		const { body } = render(ConceptTagsPreview, {
			props: { tags: [{ id: 'tag-id', title: 'Tag title' }] }
		});
		expect(body).toMatch(
			/class="concept-tag-tile(?:\s[^"]*)?"[^>]*draggable="true"|draggable="true"[^>]*class="concept-tag-tile(?:\s[^"]*)?"/
		);
		expect(body).toContain('Tag title');
		expect(body).toContain('aria-label="Remove Tag title"');
	});
});

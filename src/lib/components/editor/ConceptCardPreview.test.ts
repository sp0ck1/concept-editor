import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { invalidateAll } from '$app/navigation';
import { ensureTag } from '$lib/client/tags';
import { updateConceptRecord } from '$lib/client/concepts';
import { Editor } from './Editor.svelte';
import { normalizeConcept } from '$lib/model/normalizeConcept';
import { defaultConceptWidth, defaultConceptHeight } from '$lib/model/normalizeConceptInstance';
import { normalizeContext } from '$lib/model/normalizeContext';
import ConceptCardPreview from './ConceptCardPreview.svelte';

vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn() }));
vi.mock('./EditorContext', () => ({ getEditorContext: () => editor }));
vi.mock('$lib/client/tags', () => ({ ensureTag: vi.fn(), createTagInstance: vi.fn() }));
vi.mock('$lib/client/concepts', () => ({
	createConceptRecord: vi.fn(),
	updateConceptRecord: vi.fn(),
	updateConceptTitleFromInstanceRecord: vi.fn()
}));

class PreviewNode {
	isConnected = true;
	children: PreviewNode[] = [];
	contains(node: PreviewNode): boolean {
		return node === this || this.children.some((child) => child.contains(node));
	}
}

function fixture() {
	return {
		context: normalizeContext({}),
		tags: [
			{ id: 'linked', title: 'Label', representedByConceptId: 'concept' },
			{ id: 'nested', title: 'Nested', representedByConceptId: 'other' },
			{ id: 'unlinked', title: 'Unlinked' },
			{ id: 'broken', title: 'Broken', representedByConceptId: 'missing' }
		],
		concepts: [
			normalizeConcept({
				id: 'concept',
				title: 'Shared Concept',
				properties: { status: 'Shared value' },
				tagIds: ['nested', 'unlinked'],
				notes: { format: 'plain', text: 'Shared notes' }
			}),
			normalizeConcept({ id: 'other', title: 'Other Concept' })
		],
		instances: [],
		relationships: [],
		relationshipDefinitions: []
	};
}

let editor: Editor;
let source: PreviewNode;
const fetchGuard = vi.fn(() => {
	throw new Error('Tests must not make real requests');
});

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
	vi.stubGlobal('Node', PreviewNode);
	vi.stubGlobal('fetch', fetchGuard);
	editor = new Editor(fixture());
	source = new PreviewNode();
});

afterEach(() => {
	editor.dismissTagPreview();
	expect(fetchGuard).not.toHaveBeenCalled();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

function begin(node = source) {
	editor.beginTagPreview('linked', node as unknown as HTMLElement, 100, 300);
}

function open() {
	begin();
	vi.advanceTimersByTime(2000);
	return editor.tagPreviews[0]!;
}

function registerRoot() {
	const preview = open();
	const element = new PreviewNode();
	const nestedTag = new PreviewNode();
	element.children.push(nestedTag);
	editor.registerTagPreviewElement(preview.id, element as unknown as HTMLElement);
	return { preview, element, nestedTag };
}

describe('actual-card Tag preview lifecycle', () => {
	it('waits two seconds, uses the latest pointer position, then remains stationary', () => {
		begin();
		vi.advanceTimersByTime(1999);
		expect(editor.tagPreviews).toHaveLength(0);
		editor.moveTagPreviewPointer(source as unknown as HTMLElement, 120, 310);
		vi.advanceTimersByTime(1);
		expect(editor.tagPreviews[0]).toMatchObject({
			conceptId: 'concept',
			x: 120,
			y: 310,
			opaque: false
		});
		editor.moveTagPreviewPointer(source as unknown as HTMLElement, 150, 350);
		expect(editor.tagPreviews[0]).toMatchObject({ x: 120, y: 310 });
	});

	it('cancels pending work on early departure, including a null relatedTarget', () => {
		begin();
		vi.advanceTimersByTime(1000);
		editor.leaveTagPreview(null);
		vi.advanceTimersByTime(2000);
		expect(editor.tagPreviews).toHaveLength(0);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('keeps the preview when entering its descendants and makes it opaque on entry', () => {
		const { preview, element, nestedTag } = registerRoot();
		editor.leaveTagPreview(nestedTag as unknown as EventTarget);
		editor.enterTagPreview(preview.id);
		expect(editor.tagPreviews).toHaveLength(1);
		expect(editor.tagPreviews[0]?.opaque).toBe(true);
		editor.leaveTagPreview(element as unknown as EventTarget);
		expect(editor.tagPreviews).toHaveLength(1);
	});

	it('keeps the same visible preview when moving back onto the source tag', () => {
		const preview = open();
		editor.enterTagPreview(preview.id);
		editor.leaveTagPreview(source as unknown as EventTarget);
		begin();
		expect(editor.tagPreviews[0]?.id).toBe(preview.id);
		expect(editor.tagPreviews[0]?.opaque).toBe(true);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('dismisses when leaving all cards, including a non-Node EventTarget', () => {
		registerRoot();
		editor.leaveTagPreview(new EventTarget());
		expect(editor.tagPreviews).toHaveLength(0);
	});

	it.each(['unlinked', 'broken'])('does not schedule a preview for %s Tags', (id) => {
		editor.beginTagPreview(id, source as unknown as HTMLElement, 100, 300);
		vi.advanceTimersByTime(3000);
		expect(editor.tagPreviews).toHaveLength(0);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('checks that the source and linked Concept still exist when the delay expires', () => {
		begin();
		source.isConnected = false;
		vi.advanceTimersByTime(2000);
		expect(editor.tagPreviews).toHaveLength(0);
		source.isConnected = true;
		begin();
		editor.tags = [];
		vi.advanceTimersByTime(2000);
		expect(editor.tagPreviews).toHaveLength(0);
	});

	it('replaces pending hovers and dismisses visible and pending previews', () => {
		begin();
		vi.advanceTimersByTime(1000);
		begin(new PreviewNode());
		vi.advanceTimersByTime(1000);
		expect(editor.tagPreviews).toHaveLength(0);
		expect(editor.dismissTagPreview()).toBe(true);
		vi.advanceTimersByTime(2000);
		expect(editor.tagPreviews).toHaveLength(0);
		open();
		expect(editor.dismissTagPreview()).toBe(true);
		expect(editor.dismissTagPreview()).toBe(false);
	});

	it('renders the actual ConceptCard with default geometry, read-only title, and editable tags', () => {
		const preview = open();
		const card = { concept: editor.concepts[0]!, instance: preview.instance };
		expect(preview.instance).toMatchObject({
			width: defaultConceptWidth,
			height: defaultConceptHeight,
			x: 0,
			y: 0
		});
		const { body } = render(ConceptCardPreview, { props: { card, preview } });
		expect(body).toContain('popover="manual"');
		expect(body).toContain('concept-card ');
		expect(body).toContain('is-preview');
		expect(body).toMatch(/<input[^>]*aria-label="Concept title"[^>]*readonly/);
		expect(body).toContain('aria-label="Add tag"');
		expect(body).toContain('aria-label="Remove Nested"');
		expect(body).not.toContain('aria-label="Resize concept"');
		expect(body).not.toContain('data-card-instance-id=');
		expect(editor.instances).toHaveLength(0);
	});

	it('opens nested previews without replacing their parents and retains the whole hover chain', () => {
		const { preview, element, nestedTag } = registerRoot();
		editor.beginTagPreview('nested', nestedTag as unknown as HTMLElement, 130, 220);
		vi.advanceTimersByTime(2000);
		expect(editor.tagPreviews.map((item) => item.conceptId)).toEqual(['concept', 'other']);
		const child = editor.tagPreviews[1]!;
		const childElement = new PreviewNode();
		editor.registerTagPreviewElement(child.id, childElement as unknown as HTMLElement);
		editor.leaveTagPreview(childElement as unknown as EventTarget);
		editor.enterTagPreview(child.id);
		expect(editor.tagPreviews[1]?.opaque).toBe(true);
		editor.leaveTagPreview(element as unknown as EventTarget);
		expect(editor.tagPreviews[0]?.id).toBe(preview.id);
		expect(editor.tagPreviews).toHaveLength(2);
		editor.leaveTagPreview(null);
		expect(editor.tagPreviews).toHaveLength(0);
		expect(editor.instances).toHaveLength(0);
	});

	it('cancels nested timers when leaving a tag but staying in its parent preview', () => {
		const { element, nestedTag } = registerRoot();
		editor.beginTagPreview('nested', nestedTag as unknown as HTMLElement, 130, 220);
		editor.leaveTagPreview(element as unknown as EventTarget);
		vi.advanceTimersByTime(2000);
		expect(editor.tagPreviews).toHaveLength(1);
	});

	it('replaces only descendant previews when choosing another source tag in a parent', () => {
		const { element, nestedTag, preview } = registerRoot();
		editor.beginTagPreview('nested', nestedTag as unknown as HTMLElement, 130, 220);
		vi.advanceTimersByTime(2000);
		const sibling = new PreviewNode();
		element.children.push(sibling);
		editor.beginTagPreview('linked', sibling as unknown as HTMLElement, 150, 250);
		vi.advanceTimersByTime(2000);
		expect(editor.tagPreviews).toHaveLength(2);
		expect(editor.tagPreviews[0]?.id).toBe(preview.id);
		expect(editor.tagPreviews[1]?.conceptId).toBe('concept');
	});

	it('saves shared tag edits through the normal command and retains previews after refresh', async () => {
		const preview = open();
		const newTag = { id: 'new-tag', title: 'New label' };
		const data = fixture();
		data.tags.push(newTag);
		data.concepts[0]!.tagIds.push(newTag.id);
		vi.mocked(ensureTag).mockResolvedValueOnce({ tag: newTag, created: true });
		vi.mocked(updateConceptRecord).mockResolvedValueOnce(data.concepts[0]!);
		vi.mocked(invalidateAll).mockImplementationOnce(async () => editor.replaceData(data));
		await editor.addTag({ concept: editor.concepts[0]!, instance: preview.instance }, newTag.title);
		expect(updateConceptRecord).toHaveBeenCalledExactlyOnceWith('concept', {
			tagIds: ['nested', 'unlinked', 'new-tag']
		});
		expect(editor.tagPreviews[0]?.id).toBe(preview.id);
		expect(editor.getConceptById('concept')?.tagIds).toContain('new-tag');
		expect(editor.instances).toHaveLength(0);
	});

	it('prunes previews if their Concept is removed on refresh', () => {
		open();
		const data = fixture();
		data.concepts = [];
		editor.replaceData(data);
		expect(editor.tagPreviews).toHaveLength(0);
	});
});

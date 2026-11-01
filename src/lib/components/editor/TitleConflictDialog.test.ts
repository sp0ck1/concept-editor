import { render } from 'svelte/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeConcept } from '$lib/model/normalizeConcept';
import { normalizeConceptInstance } from '$lib/model/normalizeConceptInstance';
import type { Editor } from './Editor.svelte';
import type { TitleConflictCandidate } from './EditorTypes';
import TitleConflictDialog from './TitleConflictDialog.svelte';

const { getEditorContext } = vi.hoisted(() => ({ getEditorContext: vi.fn() }));
vi.mock('./EditorContext', () => ({ getEditorContext }));

function occurrence(instanceId = 'source-instance'): TitleConflictCandidate {
	return {
		concept: normalizeConcept({
			id: 'existing-concept',
			title: 'Bicycle',
			properties: { brand: 'Shared brand', type: 'Shared type', color: 'Shared color' },
			tagIds: ['tag-id']
		}),
		instance: normalizeConceptInstance({
			id: instanceId,
			conceptId: 'existing-concept',
			properties: { condition: 'Used', location: 'Garage' }
		}),
		path: 'Project / Transport / Bicycle',
		propertiesCount: 5,
		childrenCount: 3
	};
}

function mockEditor(candidates = [occurrence()]) {
	return {
		titleConflict: {
			instanceId: 'edited-instance',
			originalConceptId: 'original-concept',
			previousTitle: 'Original title',
			title: 'Bicycle',
			matchingConcepts: candidates.map((candidate) => candidate.concept)
		},
		titleConflictSaving: false as boolean,
		titleConflictError: null as string | null,
		getTitleConflictCandidates: vi.fn(() => candidates),
		getCard: vi.fn<Editor['getCard']>(() => undefined),
		resolveTitleConflict: vi.fn<Editor['resolveTitleConflict']>().mockResolvedValue(false),
		cancelTitleConflict: vi.fn<Editor['cancelTitleConflict']>()
	} satisfies Pick<
		Editor,
		| 'titleConflict'
		| 'titleConflictSaving'
		| 'titleConflictError'
		| 'getTitleConflictCandidates'
		| 'getCard'
		| 'resolveTitleConflict'
		| 'cancelTitleConflict'
	>;
}

function text(html = '') {
	return html
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/<[^>]*>/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function candidateRows(html: string) {
	return html.match(/<button\b[^>]*class="candidate(?:\s[^"]*)?"[^>]*>[\s\S]*?<\/button>/g) ?? [];
}

let editor: ReturnType<typeof mockEditor>;

beforeEach(() => {
	vi.clearAllMocks();
	editor = mockEditor();
	getEditorContext.mockReturnValue(editor);
});

describe('TitleConflictDialog SSR', () => {
	it('renders the exact prompt and actions without opening a browser dialog or resolving a conflict', () => {
		const { body } = render(TitleConflictDialog);
		expect(body).toContain('<dialog');
		expect(body).toContain('aria-labelledby="title-conflict-heading"');
		const paragraphs = [...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((match) =>
			text(match[1])
		);
		expect(paragraphs).toEqual([
			'One or more Concepts titled “Bicycle” already exist.',
			'Create a new Concept, or use an existing Concept for this card.'
		]);
		const buttons = [...body.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map((match) =>
			text(match[1])
		);
		expect(buttons).toContain('Create new Concept');
		expect(buttons).toContain('Cancel');
		expect(editor.resolveTitleConflict).not.toHaveBeenCalled();
		expect(editor.cancelTitleConflict).not.toHaveBeenCalled();
	});

	it('shows the supplied combined property count and children count without extra metadata labels', () => {
		const { body } = render(TitleConflictDialog);
		const rows = candidateRows(body);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toContain('title="Project / Transport / Bicycle"');
		const rowText = text(rows[0]);
		expect(rowText).toContain('Project / Transport / Bicycle');
		expect(rowText).toContain('properties: 5');
		expect(rowText).toContain('children: 3');
		expect(rowText).not.toMatch(/tags|concept\s*properties|children\s+here/i);
		expect(editor.getTitleConflictCandidates).toHaveBeenCalled();
	});

	it('renders distinct occurrences even when their concept and readable path are identical', () => {
		editor.getTitleConflictCandidates.mockReturnValue([
			occurrence('first-occurrence'),
			{ ...occurrence('second-occurrence'), propertiesCount: 7, childrenCount: 4 }
		]);
		const rows = candidateRows(render(TitleConflictDialog).body);
		expect(rows).toHaveLength(2);
		for (const row of rows) {
			expect(row).toContain('title="Project / Transport / Bicycle"');
		}
		expect(text(rows[0])).toContain('properties: 5');
		expect(text(rows[1])).toContain('properties: 7');
		expect(text(rows[1])).toContain('children: 4');
	});

	it('renders a Not placed candidate with no source instance alongside placed occurrences', () => {
		const unplaced: TitleConflictCandidate = {
			concept: normalizeConcept({ id: 'unplaced-concept', title: 'Bicycle' }),
			instance: null,
			path: 'Not placed',
			propertiesCount: 0,
			childrenCount: 0
		};
		editor.getTitleConflictCandidates.mockReturnValue([occurrence(), unplaced]);
		const rows = candidateRows(render(TitleConflictDialog).body);
		expect(rows).toHaveLength(2);
		expect(rows[1]).toContain('title="Not placed"');
		expect(text(rows[1])).toBe('Not placed properties: 0 children: 0');
	});

	it('disables candidate and action buttons while saving and exposes the controller error', () => {
		editor.titleConflictSaving = true;
		editor.titleConflictError = 'Could not save. Try again.';
		const { body } = render(TitleConflictDialog);
		expect(body).toContain('aria-busy="true"');
		const buttons = [...body.matchAll(/<button\b[^>]*>/g)];
		expect(buttons).toHaveLength(3);
		for (const [button] of buttons) expect(button).toMatch(/\sdisabled(?:\s|>|=)/);
		expect(body).toMatch(/role="alert"[^>]*>Could not save\. Try again\.</);
	});
});

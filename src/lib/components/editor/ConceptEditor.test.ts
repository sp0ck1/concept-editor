import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import { normalizeContext } from '$lib/model/normalizeContext';
import { normalizeConcept } from '$lib/model/normalizeConcept';
import { normalizeConceptInstance } from '$lib/model/normalizeConceptInstance';
import ConceptEditor from './ConceptEditor.svelte';
import type { EditorData } from './EditorTypes';

vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn() }));

function fixture(title: string): EditorData {
	return {
		context: normalizeContext({ id: 'project', title }),
		concepts: [
			normalizeConcept({ id: 'first', title: 'First root' }),
			normalizeConcept({ id: 'second', title: 'Second root' })
		],
		instances: [
			normalizeConceptInstance({
				id: 'first-instance',
				conceptId: 'first',
				parentInstanceId: null
			}),
			normalizeConceptInstance({
				id: 'second-instance',
				conceptId: 'second',
				parentInstanceId: null
			})
		],
		relationships: [],
		relationshipDefinitions: []
	};
}

describe('Context title display', () => {
	it('renders the loaded title in the topbar and root sidebar without losing multiple roots', () => {
		const { body } = render(ConceptEditor, { props: { data: fixture('Concept Editor Project') } });
		expect(body).toContain('Concept Editor Project');
		expect(body).toContain('value="Concept Editor Project"');
		expect(body).not.toContain('Context Name (Placeholder)');
		expect(body).not.toContain('Context Name (Root)');
		expect(body).toContain('data-card-instance-id="first-instance"');
		expect(body).toContain('data-card-instance-id="second-instance"');
	});

	it('uses the supplied Context title rather than a hard-coded project title', () => {
		const { body } = render(ConceptEditor, { props: { data: fixture('Another project') } });
		expect(body).toContain('Another project');
		expect(body).not.toContain('Concept Editor Project');
	});
	it('renders an editable root title and Context property and tag controls', () => {
		const data = fixture('Root project');
		data.context.properties = { status: 'Project property' };
		data.context.tagConceptIds = ['first'];
		const { body } = render(ConceptEditor, { props: { data } });
		const title = body.match(/<input[^>]*aria-label="Context Title"[^>]*>/)?.[0];
		expect(title).toBeDefined();
		expect(title).not.toContain('readonly');
		expect(body).toContain('Project property');
		expect(body).toContain('Remove First root');
		expect(body).toContain('New property title');
		expect(body).not.toContain('Open a concept to inspect it.');
	});
});

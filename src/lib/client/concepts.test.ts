import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeConcept } from '$lib/model/normalizeConcept';
import { normalizeConceptInstance } from '$lib/model/normalizeConceptInstance';
import { updateConceptTitleFromInstanceRecord } from './concepts';
import type { TitleConflictResolution } from '$lib/model/TitleConflictMode';

afterEach(() => vi.unstubAllGlobals());

describe('title resolution client', () => {
	it('sends exact IDs and the chosen copy options', async () => {
		const concept = normalizeConcept({ id: 'selected', title: 'Updates Ideas' });
		const instance = normalizeConceptInstance({ id: 'target', conceptId: concept.id });
		const fetch = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify({ concept, instance }), { status: 200 }));
		vi.stubGlobal('fetch', fetch);
		const resolution: TitleConflictResolution = {
			targetConceptId: 'selected',
			sourceInstanceId: 'source',
			destination: 'current-instance',
			propertyKeys: ['selected'],
			copyNotes: false,
			copyChildren: true,
			retainChildMetadata: true
		};
		await expect(
			updateConceptTitleFromInstanceRecord(
				'old',
				'target',
				concept.title,
				'use-existing',
				resolution
			)
		).resolves.toMatchObject({ status: 'updated', concept, instance });
		expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/concepts', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				id: 'old',
				instanceId: 'target',
				title: concept.title,
				conflictMode: 'use-existing',
				resolution
			})
		});
	});

	it('returns candidate records for the initial conflict check', async () => {
		const concept = normalizeConcept({ id: 'existing', title: 'Updates Ideas' });
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(
					new Response(JSON.stringify({ code: 'TITLE_CONFLICT', matchingConcepts: [concept] }), {
						status: 409
					})
				)
		);
		await expect(
			updateConceptTitleFromInstanceRecord('old', 'target', concept.title)
		).resolves.toEqual({ status: 'title-conflict', matchingConcepts: [concept] });
	});

	it('reports stale or invalid selections as errors instead of another chooser response', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(
					new Response(JSON.stringify({ error: 'The selected instance changed.' }), { status: 409 })
				)
		);
		await expect(
			updateConceptTitleFromInstanceRecord('old', 'target', 'Updates Ideas', 'use-existing')
		).rejects.toThrow('The selected instance changed.');
	});
});

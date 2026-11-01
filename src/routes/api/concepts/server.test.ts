import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeConcept } from '$lib/model/normalizeConcept';
import { normalizeConceptInstance } from '$lib/model/normalizeConceptInstance';
import { updateConceptTitleFromInstance } from '$lib/server/conceptService';
import { updateConcept } from '$lib/server/repositories/conceptRepository';
import { PATCH } from './+server';

vi.mock('$lib/server/repositories/conceptRepository', () => ({ updateConcept: vi.fn() }));
vi.mock('$lib/server/conceptService', () => ({
	createConceptWithInstance: vi.fn(),
	updateConceptTitleFromInstance: vi.fn()
}));

type ConceptRequestEvent = Parameters<typeof PATCH>[0];

function event(body: unknown): ConceptRequestEvent {
	return {
		request: new Request('http://localhost/api/concepts', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as ConceptRequestEvent;
}

beforeEach(() => {
	vi.resetAllMocks();
	vi.mocked(updateConcept).mockResolvedValue(normalizeConcept({ id: 'concept', title: 'Test' }));
});

describe('title resolution PATCH', () => {
	const resolution = {
		targetConceptId: 'selected',
		sourceInstanceId: 'source',
		destination: 'current-instance',
		propertyKeys: ['local'],
		copyNotes: true,
		copyChildren: true,
		retainChildMetadata: false
	};
	const body = {
		id: 'concept',
		instanceId: 'instance',
		title: 'Selected',
		conflictMode: 'use-existing'
	};
	const success = {
		status: 'ok' as const,
		concept: normalizeConcept({ id: 'selected', title: 'Selected' }),
		instance: normalizeConceptInstance({ id: 'instance', conceptId: 'selected' })
	};
	it('forwards the validated resolution, stripping unknown fields and supplied values', async () => {
		vi.mocked(updateConceptTitleFromInstance).mockResolvedValue(success);
		const response = await PATCH(
			event({
				...body,
				resolution: {
					...resolution,
					properties: { local: 'untrusted' },
					notes: { format: 'plain', text: 'untrusted' },
					extra: true
				}
			})
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ concept: success.concept, instance: success.instance });
		expect(updateConceptTitleFromInstance).toHaveBeenCalledExactlyOnceWith(
			'concept',
			'instance',
			'Selected',
			'use-existing',
			resolution
		);
		expect(updateConcept).not.toHaveBeenCalled();
	});
	it('accepts an omitted source for an unplaced Concept', async () => {
		vi.mocked(updateConceptTitleFromInstance).mockResolvedValue(success);
		const withoutSource: Partial<typeof resolution> = { ...resolution };
		delete withoutSource.sourceInstanceId;
		await PATCH(event({ ...body, resolution: withoutSource }));
		expect(updateConceptTitleFromInstance).toHaveBeenCalledExactlyOnceWith(
			'concept',
			'instance',
			'Selected',
			'use-existing',
			withoutSource
		);
	});
	it('preserves requests without a resolution', async () => {
		vi.mocked(updateConceptTitleFromInstance).mockResolvedValue(success);
		expect((await PATCH(event(body))).status).toBe(200);
		expect(updateConceptTitleFromInstance).toHaveBeenCalledExactlyOnceWith(
			'concept',
			'instance',
			'Selected',
			'use-existing',
			undefined
		);
	});
	it.each([
		null,
		[],
		'invalid',
		{},
		{ ...resolution, targetConceptId: 1 },
		{ ...resolution, sourceInstanceId: null },
		{ ...resolution, destination: 'elsewhere' },
		{ ...resolution, propertyKeys: 'local' },
		{ ...resolution, propertyKeys: ['local', 1] },
		{ ...resolution, copyNotes: 1 },
		{ ...resolution, copyChildren: 'true' },
		{ ...resolution, retainChildMetadata: null },
		...Object.keys(resolution)
			.filter((key) => key !== 'sourceInstanceId')
			.map((missing) =>
				Object.fromEntries(Object.entries(resolution).filter(([key]) => key !== missing))
			)
	])('rejects malformed resolution without calling service: %j', async (invalid) => {
		const response = await PATCH(event({ ...body, resolution: invalid }));
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ message: expect.any(String) });
		expect(updateConceptTitleFromInstance).not.toHaveBeenCalled();
	});
	it.each([
		{ status: 'invalid-resolution' as const, code: 400 },
		{ status: 'stale-instance' as const, code: 409 }
	])('maps $status to $code with a message', async ({ status, code }) => {
		vi.mocked(updateConceptTitleFromInstance).mockResolvedValue({
			status,
			message: 'Resolution failed.'
		});
		const response = await PATCH(event({ ...body, resolution }));
		expect(response.status).toBe(code);
		expect(await response.json()).toMatchObject({
			message: 'Resolution failed.',
			error: 'Resolution failed.'
		});
	});
	it('preserves conflict response', async () => {
		vi.mocked(updateConceptTitleFromInstance).mockResolvedValue({
			status: 'title-conflict',
			matchingConcepts: [success.concept]
		});
		const response = await PATCH(event({ ...body, conflictMode: 'report-conflict' }));
		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({
			code: 'TITLE_CONFLICT',
			matchingConcepts: [success.concept]
		});
	});
});

describe('Concept metadata PATCH', () => {
	it('forwards supported notes, dates, and appearance', async () => {
		const updates = {
			notes: { format: 'plain', text: 'Shared' },
			dates: [{ date: '2026-10-26', dateLabel: 'Date' }],
			appearance: {
				backgroundColor: 'blue',
				backgroundLayers: [
					{ source: { type: 'gradient', value: 'radial-gradient(white, blue)' }, repeat: 'repeat' }
				]
			}
		};
		const response = await PATCH(event({ id: 'concept', ...updates }));
		expect(response.status).toBe(200);
		expect(updateConcept).toHaveBeenCalledExactlyOnceWith('concept', updates);
	});

	it('does not forward malformed new metadata', async () => {
		await PATCH(
			event({
				id: 'concept',
				notes: 'invalid',
				dates: [{ date: '2026-02-30', dateLabel: 'Date' }],
				appearance: { backgroundLayers: 'invalid' }
			})
		);
		expect(updateConcept).toHaveBeenCalledExactlyOnceWith('concept', {});
	});

	it('forwards empty metadata for clearing', async () => {
		const updates = { notes: { format: 'plain', text: '' }, dates: [], appearance: {} };
		await PATCH(event({ id: 'concept', ...updates }));
		expect(updateConcept).toHaveBeenCalledExactlyOnceWith('concept', updates);
	});
});

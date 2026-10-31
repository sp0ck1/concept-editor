import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeConcept } from '$lib/model/normalizeConcept';
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

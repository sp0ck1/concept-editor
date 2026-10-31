import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteConceptInstancesBatch } from '$lib/server/repositories/conceptInstanceRepository';
import { DELETE } from './+server';

vi.mock('$lib/server/repositories/conceptInstanceRepository', () => ({
	deleteConceptInstancesBatch: vi.fn(),
	updateConceptInstancesBatch: vi.fn()
}));

type BatchRequestEvent = Parameters<typeof DELETE>[0];

function event(body: string): BatchRequestEvent {
	return {
		request: new Request('http://localhost/api/concept-instances/batch', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body
		})
	} as BatchRequestEvent;
}

beforeEach(() => {
	vi.resetAllMocks();
	vi.mocked(deleteConceptInstancesBatch).mockResolvedValue(2);
});

describe('instance batch DELETE', () => {
	it('forwards the requested IDs and returns the deleted count', async () => {
		const response = await DELETE(event(JSON.stringify({ ids: ['first', 'second'] })));
		expect(deleteConceptInstancesBatch).toHaveBeenCalledExactlyOnceWith(['first', 'second']);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ deleted: 2 });
	});

	it('allows duplicate IDs and forwards them to the repository', async () => {
		vi.mocked(deleteConceptInstancesBatch).mockResolvedValue(1);
		const response = await DELETE(event(JSON.stringify({ ids: ['first', 'first'] })));
		expect(deleteConceptInstancesBatch).toHaveBeenCalledExactlyOnceWith(['first', 'first']);
		expect(await response.json()).toEqual({ deleted: 1 });
	});

	it('returns zero rather than 404 when no IDs match', async () => {
		vi.mocked(deleteConceptInstancesBatch).mockResolvedValue(0);
		const response = await DELETE(event(JSON.stringify({ ids: ['missing'] })));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ deleted: 0 });
	});

	it.each([
		'{',
		'',
		...[
			null,
			[],
			'text',
			1,
			true,
			{},
			{ ids: null },
			{ ids: 'first' },
			{ ids: {} },
			{ ids: [] },
			{ ids: [''] },
			{ ids: ['first', ''] },
			{ ids: ['first', 1] },
			{ ids: [null] },
			{ ids: [true] },
			{ ids: [{}] },
			{ ids: [[]] }
		].map((body) => JSON.stringify(body))
	])('rejects malformed JSON or invalid IDs: %s', async (body) => {
		const response = await DELETE(event(body));
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: 'Expected a JSON body with a nonempty ids array.'
		});
		expect(deleteConceptInstancesBatch).not.toHaveBeenCalled();
	});

	it('propagates repository write errors', async () => {
		const failure = new Error('Instances could not be saved');
		vi.mocked(deleteConceptInstancesBatch).mockRejectedValue(failure);
		await expect(DELETE(event(JSON.stringify({ ids: ['first'] })))).rejects.toBe(failure);
	});
});

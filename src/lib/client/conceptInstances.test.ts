import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteConceptInstancesBatch } from './conceptInstances';

afterEach(() => vi.unstubAllGlobals());

describe('batch instance deletion client', () => {
	it('sends one DELETE request containing the instance IDs', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify({ deleted: 2 }), { status: 200 }));
		vi.stubGlobal('fetch', fetch);
		await expect(deleteConceptInstancesBatch(['first', 'second'])).resolves.toBe(2);
		expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/concept-instances/batch', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ids: ['first', 'second'] })
		});
	});

	it('skips requests for an empty group', async () => {
		const fetch = vi.fn();
		vi.stubGlobal('fetch', fetch);
		await expect(deleteConceptInstancesBatch([])).resolves.toBe(0);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('propagates server errors', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(
					new Response(JSON.stringify({ error: 'Deletion failed' }), { status: 500 })
				)
		);
		await expect(deleteConceptInstancesBatch(['first', 'second'])).rejects.toThrow(
			'Deletion failed'
		);
	});
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Context } from '$lib/model/Context';
import { updateContext } from '$lib/server/repositories/contextRepository';
import { PATCH } from './+server';

vi.mock('$lib/server/repositories/contextRepository', () => ({ updateContext: vi.fn() }));

type ContextRequestEvent = Parameters<typeof PATCH>[0];

const context: Context = {
	id: 'context',
	title: 'Workspace',
	properties: {},
	tagConceptIds: [],
	notes: { format: 'plain', text: '' },
	dates: []
};

function event(body: string): ContextRequestEvent {
	return {
		request: new Request('http://localhost/api/context', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body
		})
	} as ContextRequestEvent;
}

beforeEach(() => {
	vi.resetAllMocks();
	vi.mocked(updateContext).mockResolvedValue(context);
});

describe('Context PATCH', () => {
	it('forwards object updates and returns the saved Context', async () => {
		const updates = {
			title: ' Updated ',
			properties: { status: 'active' },
			tagConceptIds: ['tag'],
			notes: { format: 'plain', text: 'Notes' },
			dates: [{ date: '2026-10-28', dateLabel: 'Started' }],
			appearance: { backgroundColor: 'blue' },
			id: 'ignored',
			concepts: []
		};
		const response = await PATCH(event(JSON.stringify(updates)));
		expect(updateContext).toHaveBeenCalledExactlyOnceWith(updates);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(context);
	});

	it('accepts an empty object', async () => {
		const response = await PATCH(event('{}'));
		expect(response.status).toBe(200);
		expect(updateContext).toHaveBeenCalledExactlyOnceWith({});
	});

	it.each(['{', '', 'null', '[]', '"text"', '1', 'true'])(
		'rejects invalid JSON or non-object input: %s',
		async (body) => {
			const response = await PATCH(event(body));
			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({
				error: 'Context updates must be a JSON object.'
			});
			expect(updateContext).not.toHaveBeenCalled();
		}
	);

	it('propagates repository failures instead of returning success', async () => {
		const failure = new Error('Context could not be saved');
		vi.mocked(updateContext).mockRejectedValue(failure);
		await expect(PATCH(event('{}'))).rejects.toBe(failure);
	});
});

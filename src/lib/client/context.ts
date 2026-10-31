import type { Context } from '$lib/model/Context';
import { getErrorMessage } from './http';

export async function updateContextRecord(
	updates: Partial<Omit<Context, 'id'>>
): Promise<Context> {
	const response = await fetch('/api/context', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(updates)
	});

	if (!response.ok) {
		throw new Error(await getErrorMessage(response));
	}

	return (await response.json()) as Context;
}

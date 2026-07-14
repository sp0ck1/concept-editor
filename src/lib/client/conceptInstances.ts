import type { ConceptInstance } from '$lib/types/ConceptInstance';

export type ConceptInstanceUpdates = Partial<
	Omit<ConceptInstance, 'id' | 'conceptId'>
>;

async function getErrorMessage(response: Response): Promise<string> {
	const body = (await response.json().catch(() => null)) as
		| { error?: string; message?: string }
		| null;

	return body?.error ?? body?.message ?? `Request failed with status ${response.status}.`;
}

export async function updateConceptInstanceRecord(
	id: string,
	updates: ConceptInstanceUpdates
): Promise<ConceptInstance> {
	const response = await fetch('/api/concept-instances', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ id, ...updates })
	});

	if (!response.ok) {
		throw new Error(await getErrorMessage(response));
	}

	return (await response.json()) as ConceptInstance;
}

export async function updateConceptInstancesBatch(
	updates: { id: string; updates: ConceptInstanceUpdates }[]
): Promise<number> {
	if (updates.length === 0) {
		return 0;
	}

	const response = await fetch('/api/concept-instances/batch', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ updates })
	});

	if (!response.ok) {
		throw new Error(await getErrorMessage(response));
	}

	const body = (await response.json()) as { updated: number };
	return body.updated;
}

export async function deleteConceptInstanceRecord(id: string): Promise<void> {
	const response = await fetch('/api/concept-instances', {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ id })
	});

	if (!response.ok) {
		throw new Error(await getErrorMessage(response));
	}
}

export async function importChildrenFromConceptInstance(
	sourceInstanceId: string,
	targetInstanceId: string
): Promise<{ importedCount: number; instances: ConceptInstance[] }> {
	const response = await fetch('/api/concept-instances/import-children', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ sourceInstanceId, targetInstanceId })
	});

	if (!response.ok) {
		throw new Error(await getErrorMessage(response));
	}

	return (await response.json()) as {
		importedCount: number;
		instances: ConceptInstance[];
	};
}

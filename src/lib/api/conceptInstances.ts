import type { ConceptInstance } from '$lib/types/ConceptInstance';

export async function updateConceptInstanceRecord(
	id: string,
	updates: Partial<Omit<ConceptInstance, 'id' | 'conceptId'>>
) {
	const response = await fetch('/api/concept-instances', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			id,
			...updates
		})
	});

	if (!response.ok) {
		throw new Error('Failed to update concept instance');
	}
}

export async function updateConceptInstancesBatch(
	updates: {
		id: string;
		updates: Partial<Omit<ConceptInstance, 'id' | 'conceptId'>>;
	}[]
) {
	if (updates.length === 0) {
		return;
	}

	const response = await fetch('/api/concept-instances/batch', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ updates })
	});

	if (!response.ok) {
		throw new Error('Failed to batch update concept instances');
	}
}

export async function deleteConceptInstanceRecord(id: string) {
	const response = await fetch('/api/concept-instances', {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ id })
	});

	if (!response.ok) {
		throw new Error('Failed to delete concept instance');
	}
}

export async function importChildrenFromConceptInstance(
	sourceInstanceId: string,
	targetInstanceId: string
) {
	const response = await fetch('/api/concept-instances/import-children', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			sourceInstanceId,
			targetInstanceId
		})
	});

	if (!response.ok) {
		throw new Error('Failed to import children');
	}
}
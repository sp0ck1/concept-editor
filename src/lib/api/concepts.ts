import type { Concept } from '$lib/types/Concept';
import type { ConceptInstance } from '$lib/types/ConceptInstance';

export type CreateConceptRequest = {
	title?: string;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	parentInstanceId?: string | null;
};

export async function createConceptRecord(body: CreateConceptRequest) {
	const response = await fetch('/api/concepts', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});

	if (!response.ok) {
		throw new Error('Failed to create concept');
	}

	return (await response.json()) as {
		concept: Concept;
		instance: ConceptInstance;
	};
}

export async function updateConceptRecord(id: string, updates: Partial<Omit<Concept, 'id'>>) {
	const response = await fetch('/api/concepts', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			id,
			...updates
		})
	});

	if (!response.ok) {
		throw new Error('Failed to update concept');
	}

	return (await response.json()) as Concept;
}

export async function updateConceptTitleFromInstanceRecord(
	conceptId: string,
	instanceId: string,
	title: string
) {
	const response = await fetch('/api/concepts', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			id: conceptId,
			instanceId,
			title
		})
	});

	if (!response.ok) {
		throw new Error('Failed to update concept title');
	}

	return (await response.json()) as {
		concept: Concept;
		instance: ConceptInstance;
	};
}

export async function ensureConceptByTitle(title: string) {
	const response = await fetch('/api/concepts/ensure', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ title })
	});

	if (!response.ok) {
		throw new Error('Failed to ensure concept');
	}

	return (await response.json()) as {
		concept: Concept;
		created: boolean;
	};
}
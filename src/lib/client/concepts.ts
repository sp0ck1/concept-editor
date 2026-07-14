import type { Concept } from '$lib/types/Concept';
import type { ConceptInstance } from '$lib/types/ConceptInstance';
import type { TitleConflictMode } from '$lib/types/TitleConflictMode';


export type CreateConceptRequest = {
	title?: string;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	parentInstanceId?: string | null;
};

export type UpdateConceptTitleResult =
	| {
			status: 'updated';
			concept: Concept;
			instance: ConceptInstance;
	  }
	| {
			status: 'title-conflict';
			matchingConcepts: Concept[];
	  };



	  
async function getErrorMessage(response: Response): Promise<string> {
	const body = (await response.json().catch(() => null)) as
		| { error?: string; message?: string }
		| null;

	return body?.error ?? body?.message ?? `Request failed with status ${response.status}.`;
}

export async function createConceptRecord(
	body: CreateConceptRequest
): Promise<{ concept: Concept; instance: ConceptInstance }> {
	const response = await fetch('/api/concepts', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});

	if (!response.ok) {
		throw new Error(await getErrorMessage(response));
	}

	return (await response.json()) as {
		concept: Concept;
		instance: ConceptInstance;
	};
}

export async function updateConceptRecord(
	id: string,
	updates: Partial<Omit<Concept, 'id' | 'title'>>
): Promise<Concept> {
	const response = await fetch('/api/concepts', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ id, ...updates })
	});

	if (!response.ok) {
		throw new Error(await getErrorMessage(response));
	}

	return (await response.json()) as Concept;
}

export async function updateConceptTitleFromInstanceRecord(
	conceptId: string,
	instanceId: string,
	title: string,
	conflictMode: TitleConflictMode = 'report-conflict'
): Promise<UpdateConceptTitleResult> {
	const response = await fetch('/api/concepts', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			id: conceptId,
			instanceId,
			title,
			conflictMode
		})
	});

	if (response.status === 409) {
		const body = (await response.json()) as {
			code?: string;
			matchingConcepts?: Concept[];
		};

		if (body.code === 'TITLE_CONFLICT') {
			return {
				status: 'title-conflict',
				matchingConcepts: body.matchingConcepts ?? []
			};
		}
	}

	if (!response.ok) {
		throw new Error(await getErrorMessage(response));
	}

	const body = (await response.json()) as {
		concept: Concept;
		instance: ConceptInstance;
	};

	return {
		status: 'updated',
		concept: body.concept,
		instance: body.instance
	};
}

export async function ensureConceptByTitle(
	title: string
): Promise<{ concept: Concept; created: boolean }> {
	const response = await fetch('/api/concepts/ensure', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ title })
	});

	if (!response.ok) {
		throw new Error(await getErrorMessage(response));
	}

	return (await response.json()) as {
		concept: Concept;
		created: boolean;
	};
}

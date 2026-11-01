import type { Tag } from '$lib/model/Tag';
import type { Concept } from '$lib/model/Concept';
import type { ConceptInstance } from '$lib/model/ConceptInstance';
import { getErrorMessage } from '$lib/client/http';

export async function ensureTag(
	title: string,
	representedByConceptId?: string
): Promise<{ tag: Tag; created: boolean }> {
	const response = await fetch('/api/tags', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			title,
			...(representedByConceptId !== undefined ? { representedByConceptId } : {})
		})
	});
	if (!response.ok) throw new Error(await getErrorMessage(response));
	return (await response.json()) as { tag: Tag; created: boolean };
}

export async function createTagInstance(
	tagId: string,
	input: { parentInstanceId: string | null; x: number; y: number }
): Promise<{ tag: Tag; concept: Concept; instance: ConceptInstance }> {
	const response = await fetch(`/api/tags/${encodeURIComponent(tagId)}/instances`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	if (!response.ok) throw new Error(await getErrorMessage(response));
	return (await response.json()) as { tag: Tag; concept: Concept; instance: ConceptInstance };
}

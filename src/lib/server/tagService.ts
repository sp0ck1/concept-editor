import type { Tag } from '$lib/model/Tag';
import type { Concept } from '$lib/model/Concept';
import type { ConceptInstance } from '$lib/model/ConceptInstance';
import {
	createConcept,
	getAllConcepts,
	getConceptById,
	saveAllConcepts
} from './repositories/conceptRepository';
import {
	createConceptInstance,
	getAllConceptInstances
} from './repositories/conceptInstanceRepository';
import {
	getAllTags,
	saveAllTags,
	TagCommandError,
	withTagWriteLock
} from './repositories/tagRepository';

export type CreateTagInstanceInput = {
	parentInstanceId: string | null;
	x: number;
	y: number;
};
export type TagInstanceResult = { tag: Tag; concept: Concept; instance: ConceptInstance };

// Retain the exact ID if rollback itself fails, so an in-process retry cannot duplicate it.
const pendingConcepts = new Map<string, string>();

export async function materializeTag(
	tagId: string,
	input: CreateTagInstanceInput
): Promise<TagInstanceResult> {
	if (
		!input ||
		(input.parentInstanceId !== null &&
			(typeof input.parentInstanceId !== 'string' || !input.parentInstanceId)) ||
		typeof input.x !== 'number' ||
		!Number.isFinite(input.x) ||
		typeof input.y !== 'number' ||
		!Number.isFinite(input.y)
	) {
		throw new TagCommandError(
			'A parent instance ID (or null for root) and finite x/y coordinates are required.',
			400
		);
	}
	return withTagWriteLock(async () => {
		const tags = await getAllTags();
		const tag = tags.find((item) => item.id === tagId);
		if (!tag) throw new TagCommandError('Tag not found. Refresh tags and try again.', 404);
		const instances = await getAllConceptInstances();
		if (
			input.parentInstanceId !== null &&
			!instances.some((item) => item.id === input.parentInstanceId)
		) {
			throw new TagCommandError(
				'Parent instance not found. Refresh the canvas and try again.',
				404
			);
		}
		let concept: Concept;
		if (tag.representedByConceptId !== undefined) {
			const linked = await getConceptById(tag.representedByConceptId);
			if (!linked) {
				throw new TagCommandError(
					'The tag references a missing Concept. Repair its representedByConceptId link before dropping it again.',
					409
				);
			}
			concept = linked;
		} else {
			const pendingId = pendingConcepts.get(tag.id);
			const recovered = pendingId ? await getConceptById(pendingId) : undefined;
			concept = recovered ?? (await createConcept(tag.title));
			pendingConcepts.set(tag.id, concept.id);
			tag.representedByConceptId = concept.id;
			try {
				await saveAllTags(tags);
				pendingConcepts.delete(tag.id);
			} catch (error) {
				try {
					const savedTags = await getAllTags();
					// A save may have completed before an error was reported. Never remove a linked Concept.
					if (savedTags.some((item) => item.representedByConceptId === concept.id)) {
						pendingConcepts.delete(tag.id);
					} else {
						const currentInstances = await getAllConceptInstances();
						const currentConcepts = await getAllConcepts();
						const current = currentConcepts.find((item) => item.id === concept.id);
						if (
							!recovered &&
							!currentInstances.some((item) => item.conceptId === concept.id) &&
							JSON.stringify(current) === JSON.stringify(concept)
						) {
							await saveAllConcepts(currentConcepts.filter((item) => item.id !== concept.id));
							pendingConcepts.delete(tag.id);
						}
					}
				} catch {
					throw new TagCommandError(
						'Tag linking and Concept rollback failed. Retry in this process to reuse the pending Concept; inspect storage before restarting.',
						500
					);
				}
				throw error;
			}
		}
		const instance = await createConceptInstance({
			conceptId: concept.id,
			parentInstanceId: input.parentInstanceId,
			x: input.x,
			y: input.y
		});
		return { tag, concept, instance };
	});
}

import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import type { Tag } from '$lib/model/Tag';
import { getAllConcepts } from './conceptRepository';

const tagsPath = path.resolve(process.cwd(), 'src/lib/data/tags.json');
let pending: Promise<unknown> = Promise.resolve();

// Ensure and materialization share a queue; a failed command must not poison it.
export function withTagWriteLock<T>(command: () => Promise<T>): Promise<T> {
	const result = pending.then(command);
	pending = result.catch(() => undefined);
	return result;
}

export async function getAllTags(): Promise<Tag[]> {
	const file = await readFile(tagsPath, 'utf8');
	return JSON.parse(file) as Tag[];
}

// Call under withTagWriteLock when coordinating a read/modify/write command.
export async function saveAllTags(tags: Tag[]): Promise<void> {
	const temporaryPath = `${tagsPath}.${crypto.randomUUID()}.tmp`;
	try {
		await writeFile(temporaryPath, `${JSON.stringify(tags, null, '\t')}\n`, 'utf8');
		await rename(temporaryPath, tagsPath);
	} finally {
		await rm(temporaryPath, { force: true });
	}
}

export class TagCommandError extends Error {
	constructor(
		message: string,
		public readonly status: 400 | 404 | 409 | 500
	) {
		super(message);
	}
}

export async function ensureTag(
	title: string,
	representedByConceptId?: string
): Promise<{ tag: Tag; created: boolean }> {
	if (typeof title !== 'string' || !title.trim()) {
		throw new TagCommandError('Tag title is required.', 400);
	}
	if (
		representedByConceptId !== undefined &&
		(typeof representedByConceptId !== 'string' || !representedByConceptId.trim())
	) {
		throw new TagCommandError('A valid source Concept ID is required.', 400);
	}
	return withTagWriteLock(async () => {
		const tags = await getAllTags();
		let nextTitle = title.trim();
		let existing: Tag | undefined;
		if (representedByConceptId !== undefined) {
			const concept = (await getAllConcepts()).find((item) => item.id === representedByConceptId);
			if (!concept)
				throw new TagCommandError('Source Concept not found. Refresh and try again.', 404);
			existing = tags.find((tag) => tag.representedByConceptId === concept.id);
			nextTitle = concept.title.trim();
			if (!existing && !nextTitle)
				throw new TagCommandError('Name the source Concept before using it as a tag.', 400);
		} else {
			const matches = tags.filter(
				(tag) => tag.title.trim().toLowerCase() === nextTitle.toLowerCase()
			);
			if (matches.length > 0) {
				const concepts = new Map((await getAllConcepts()).map((concept) => [concept.id, concept]));
				let mostProperties = -1;
				for (const tag of matches) {
					const concept = tag.representedByConceptId
						? concepts.get(tag.representedByConceptId)
						: undefined;
					const count = Object.keys(concept?.properties ?? {}).length;
					if (count > mostProperties) {
						existing = tag;
						mostProperties = count;
					}
				}
			}
		}
		if (existing) return { tag: existing, created: false };
		const tag: Tag = {
			id: `tag-${crypto.randomUUID()}`,
			title: nextTitle,
			...(representedByConceptId !== undefined ? { representedByConceptId } : {})
		};
		tags.push(tag);
		await saveAllTags(tags);
		return { tag, created: true };
	});
}

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Context } from '$lib/model/Context';
import {
	isStringRecord,
	isConceptNotes,
	isConceptDates,
	isConceptAppearance,
	normalizeConceptNotes,
	normalizeConceptDates,
	normalizeConceptAppearance
} from '$lib/model/metadata';
import { normalizeContext } from '$lib/model/normalizeContext';

const contextPath = path.resolve(process.cwd(), 'src/lib/data/context.json');

export async function getContext(): Promise<Context> {
	const file = await readFile(contextPath, 'utf8');
	return normalizeContext(JSON.parse(file) as Partial<Context>);
}

export async function saveContext(context: Context): Promise<void> {
	await writeFile(contextPath, `${JSON.stringify(normalizeContext(context), null, '\t')}\n`, 'utf8');
}

export async function updateContext(updates: Partial<Omit<Context, 'id'>>): Promise<Context> {
	const context = await getContext();

	if (typeof updates.title === 'string') context.title = updates.title.trim();
	if (isStringRecord(updates.properties)) context.properties = { ...updates.properties };
	if (
		Array.isArray(updates.tagConceptIds) &&
		updates.tagConceptIds.every((id) => typeof id === 'string')
	) {
		context.tagConceptIds = [...updates.tagConceptIds];
	}
	if (isConceptNotes(updates.notes)) context.notes = normalizeConceptNotes(updates.notes);
	if (isConceptDates(updates.dates)) context.dates = normalizeConceptDates(updates.dates);
	if (isConceptAppearance(updates.appearance))
		context.appearance = normalizeConceptAppearance(updates.appearance);

	await saveContext(context);
	return context;
}

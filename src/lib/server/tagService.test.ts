import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateTagInstanceInput } from './tagService';

let directory: string;
let tags: typeof import('./repositories/tagRepository');
let concepts: typeof import('./repositories/conceptRepository');
let instances: typeof import('./repositories/conceptInstanceRepository');
let service: typeof import('./tagService');
let ensureRoute: typeof import('../../routes/api/tags/+server');
let instanceRoute: typeof import('../../routes/api/tags/[id]/instances/+server');
const placement = { parentInstanceId: null, x: 0, y: -12.5 };

function file(name: string) {
	return path.join(directory, 'src/lib/data', name);
}
async function seed(name: string, value: unknown) {
	await writeFile(file(name), JSON.stringify(value));
}
async function saved(name: string) {
	return JSON.parse(await readFile(file(name), 'utf8'));
}
function request(body: unknown) {
	return new Request('http://localhost/api/tags', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}
async function ensureRequest(body: unknown) {
	return ensureRoute.POST({ request: request(body) } as Parameters<typeof ensureRoute.POST>[0]);
}
async function instanceRequest(id: string, body: unknown) {
	return instanceRoute.POST({
		request: request(body),
		params: { id }
	} as Parameters<typeof instanceRoute.POST>[0]);
}

beforeEach(async () => {
	directory = await mkdtemp(path.join(os.tmpdir(), 'concept-tags-'));
	await mkdir(path.join(directory, 'src/lib/data'), { recursive: true });
	for (const name of ['tags.json', 'concepts.json', 'concept_instances.json']) await seed(name, []);
	vi.resetModules();
	// Repositories capture cwd at import time. Import only after redirecting to disposable storage.
	vi.spyOn(process, 'cwd').mockReturnValue(directory);
	tags = await import('./repositories/tagRepository');
	concepts = await import('./repositories/conceptRepository');
	instances = await import('./repositories/conceptInstanceRepository');
	service = await import('./tagService');
	ensureRoute = await import('../../routes/api/tags/+server');
	instanceRoute = await import('../../routes/api/tags/[id]/instances/+server');
});
afterEach(async () => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.resetModules();
	if (directory) await rm(directory, { recursive: true, force: true });
});

describe('separate tags and materialization', () => {
	it('ensures one trimmed case-insensitive Tag without creating a Concept', async () => {
		const results = await Promise.all(
			[' Work ', 'work', 'WORK', ' work '].map((title) => tags.ensureTag(title))
		);
		expect(results.filter((result) => result.created)).toHaveLength(1);
		expect(new Set(results.map((result) => result.tag.id)).size).toBe(1);
		expect(await tags.getAllTags()).toEqual([{ id: results[0].tag.id, title: 'Work' }]);
		expect(await saved('concepts.json')).toEqual([]);
		expect(await saved('concept_instances.json')).toEqual([]);
		expect((await readdir(path.dirname(file('tags.json')))).sort()).toEqual(
			['tags.json', 'concepts.json', 'concept_instances.json'].sort()
		);
	});

	it('creates a new defaulted Concept rather than matching a Concept title', async () => {
		const unrelated = await concepts.createConcept('Work');
		const { tag } = await tags.ensureTag('Work');
		const result = await service.materializeTag(tag.id, placement);
		expect(result.concept.id).not.toBe(unrelated.id);
		expect(result.concept).toMatchObject({
			title: 'Work',
			properties: {},
			tagIds: [],
			notes: { format: 'plain', text: '' },
			dates: []
		});
		expect(result.instance).toMatchObject({
			...placement,
			conceptId: result.concept.id,
			width: 350,
			height: 250,
			lastCameraPanX: 0,
			lastCameraPanY: 0,
			lastCameraZoom: 1,
			notes: { format: 'plain', text: '' },
			properties: {},
			view: 'tree',
			isPinned: false
		});
		expect(result.tag.representedByConceptId).toBe(result.concept.id);
		expect(await saved('tags.json')).toEqual([result.tag]);
		expect(await saved('concept_instances.json')).toEqual([result.instance]);
	});

	it('serializes concurrent first drops and ensures without losing links or instances', async () => {
		const { tag } = await tags.ensureTag('Work');
		const [first, ensured, second, other] = await Promise.all([
			service.materializeTag(tag.id, placement),
			tags.ensureTag(' WORK '),
			service.materializeTag(tag.id, { ...placement, x: 50 }),
			tags.ensureTag('Other')
		]);
		expect(second.concept.id).toBe(first.concept.id);
		expect(second.instance.id).not.toBe(first.instance.id);
		expect(ensured).toEqual({ tag: first.tag, created: false });
		expect(await saved('concepts.json')).toHaveLength(1);
		expect(await saved('concept_instances.json')).toHaveLength(2);
		expect(await saved('tags.json')).toEqual([first.tag, other.tag]);
	});

	it('uses the exact linked Concept even after its title changes, and supports nested placement', async () => {
		const concept = await concepts.createConcept('Different title', {
			properties: { shared: 'kept' }
		});
		const parent = await instances.createConceptInstance({ conceptId: concept.id });
		await concepts.createConcept('Work');
		await seed('tags.json', [{ id: 'tag', title: 'Work', representedByConceptId: concept.id }]);
		const result = await service.materializeTag('tag', {
			...placement,
			parentInstanceId: parent.id
		});
		expect(result.concept).toEqual(concept);
		expect(result.instance.parentInstanceId).toBe(parent.id);
		expect(await saved('concepts.json')).toHaveLength(2);
	});

	it('rejects broken links with no title fallback and no writes', async () => {
		await concepts.createConcept('Work');
		await seed('tags.json', [{ id: 'tag', title: 'Work', representedByConceptId: 'missing' }]);
		const before = await readFile(file('concepts.json'), 'utf8');
		await expect(service.materializeTag('tag', placement)).rejects.toMatchObject({
			status: 409,
			message: expect.stringContaining('Repair')
		});
		expect(await readFile(file('concepts.json'), 'utf8')).toBe(before);
		expect(await saved('concept_instances.json')).toEqual([]);
	});

	it.each([
		{ ...placement, parentInstanceId: 'missing' },
		{ ...placement, parentInstanceId: undefined },
		{ ...placement, parentInstanceId: '' },
		{ ...placement, parentInstanceId: 1 },
		{ ...placement, x: NaN },
		{ ...placement, y: Infinity },
		{ ...placement, x: '0' },
		{ ...placement, y: undefined }
	])('rejects invalid placement before creating or linking: %j', async (input) => {
		const { tag } = await tags.ensureTag('Work');
		await expect(
			service.materializeTag(tag.id, input as CreateTagInstanceInput)
		).rejects.toBeInstanceOf(tags.TagCommandError);
		expect(await saved('tags.json')).toEqual([tag]);
		expect(await saved('concepts.json')).toEqual([]);
		expect(await saved('concept_instances.json')).toEqual([]);
	});

	it('rejects nonexistent tags before writing', async () => {
		await expect(service.materializeTag('missing', placement)).rejects.toMatchObject({
			status: 404
		});
		expect(await saved('concepts.json')).toEqual([]);
		expect(await saved('concept_instances.json')).toEqual([]);
	});

	it('rolls back only the newly created Concept if linking fails, then retries normally', async () => {
		const existing = await concepts.createConcept('Work');
		const { tag } = await tags.ensureTag('Work');
		vi.spyOn(tags, 'saveAllTags').mockRejectedValueOnce(new Error('Link save failed'));
		await expect(service.materializeTag(tag.id, placement)).rejects.toThrow('Link save failed');
		expect(await saved('concepts.json')).toEqual([existing]);
		expect(await saved('tags.json')).toEqual([tag]);
		expect(await saved('concept_instances.json')).toEqual([]);
		const result = await service.materializeTag(tag.id, placement);
		expect(result.concept.id).not.toBe(existing.id);
		expect(await saved('concepts.json')).toHaveLength(2);
	});

	it('retains the exact linked Concept if instance creation fails and reuses it on retry', async () => {
		const { tag } = await tags.ensureTag('Work');
		vi.spyOn(instances, 'createConceptInstance').mockRejectedValueOnce(
			new Error('Instance save failed')
		);
		await expect(service.materializeTag(tag.id, placement)).rejects.toThrow('Instance save failed');
		const [linked] = await tags.getAllTags();
		expect(linked.representedByConceptId).toBeTruthy();
		expect(await saved('concepts.json')).toHaveLength(1);
		expect(await saved('concept_instances.json')).toEqual([]);
		const result = await service.materializeTag(tag.id, placement);
		expect(result.concept.id).toBe(linked.representedByConceptId);
		expect(await saved('concepts.json')).toHaveLength(1);
	});

	it('reuses a pending Concept if both link save and rollback fail', async () => {
		const { tag } = await tags.ensureTag('Work');
		vi.spyOn(tags, 'saveAllTags').mockRejectedValueOnce(new Error('Link save failed'));
		vi.spyOn(concepts, 'saveAllConcepts').mockRejectedValueOnce(new Error('Rollback failed'));
		await expect(service.materializeTag(tag.id, placement)).rejects.toMatchObject({ status: 500 });
		const [pending] = await saved('concepts.json');
		expect(await saved('tags.json')).toEqual([tag]);
		const result = await service.materializeTag(tag.id, placement);
		expect(result.concept.id).toBe(pending.id);
		expect(await saved('concepts.json')).toHaveLength(1);
	});

	it('never rolls back a Concept if the link was saved before an error was reported', async () => {
		const { tag } = await tags.ensureTag('Work');
		const save = tags.saveAllTags;
		vi.spyOn(tags, 'saveAllTags').mockImplementationOnce(async (records) => {
			await save(records);
			throw new Error('Reported after save');
		});
		await expect(service.materializeTag(tag.id, placement)).rejects.toThrow('Reported after save');
		const [linked] = await tags.getAllTags();
		expect(await saved('concepts.json')).toHaveLength(1);
		const result = await service.materializeTag(tag.id, placement);
		expect(result.concept.id).toBe(linked.representedByConceptId);
		expect(await saved('concepts.json')).toHaveLength(1);
	});

	it('does not overwrite corrupt or missing tag storage', async () => {
		await writeFile(file('tags.json'), '{ corrupt');
		await expect(tags.ensureTag('Work')).rejects.toBeInstanceOf(SyntaxError);
		expect(await readFile(file('tags.json'), 'utf8')).toBe('{ corrupt');
		await rm(file('tags.json'));
		await expect(tags.ensureTag('Work')).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(readFile(file('tags.json'))).rejects.toMatchObject({ code: 'ENOENT' });
	});
});

describe('tag HTTP and client contracts', () => {
	it('returns 201 on ensure, 200 on reuse, and 201 with the materialized records', async () => {
		const created = await ensureRequest({ title: ' Work ' });
		expect(created.status).toBe(201);
		const body = await created.json();
		expect(body).toEqual({ tag: { id: expect.any(String), title: 'Work' }, created: true });
		const reused = await ensureRequest({ title: 'work' });
		expect(reused.status).toBe(200);
		expect(await reused.json()).toEqual({ tag: body.tag, created: false });
		const response = await instanceRequest(body.tag.id, {
			...placement,
			conceptId: 'untrusted',
			width: 999
		});
		expect(response.status).toBe(201);
		const result = await response.json();
		expect(result.tag.representedByConceptId).toBe(result.concept.id);
		expect(result.instance).toMatchObject({
			...placement,
			conceptId: result.concept.id,
			width: 350
		});
	});

	it.each([null, [], {}, { title: 1 }, { title: '' }, { title: '   ' }])(
		'rejects malformed or blank tag titles: %j',
		async (body) => {
			expect((await ensureRequest(body)).status).toBe(400);
			expect(await saved('tags.json')).toEqual([]);
		}
	);

	it('maps missing tags, missing parents, invalid placements and broken links to actionable errors', async () => {
		expect((await instanceRequest('missing', placement)).status).toBe(404);
		const { tag } = await tags.ensureTag('Work');
		expect(
			(await instanceRequest(tag.id, { ...placement, parentInstanceId: 'missing' })).status
		).toBe(404);
		for (const body of [null, [], {}, { ...placement, x: null }]) {
			expect((await instanceRequest(tag.id, body)).status).toBe(400);
		}
		await seed('tags.json', [{ ...tag, representedByConceptId: 'missing' }]);
		const broken = await instanceRequest(tag.id, placement);
		expect(broken.status).toBe(409);
		expect(await broken.json()).toMatchObject({ error: expect.stringContaining('Repair') });
	});

	it('rejects invalid JSON for both routes', async () => {
		const invalid = () => new Request('http://localhost/api/tags', { method: 'POST', body: '{' });
		expect(
			(await ensureRoute.POST({ request: invalid() } as Parameters<typeof ensureRoute.POST>[0]))
				.status
		).toBe(400);
		expect(
			(
				await instanceRoute.POST({ request: invalid(), params: { id: 'tag' } } as Parameters<
					typeof instanceRoute.POST
				>[0])
			).status
		).toBe(400);
	});

	it('exposes the agreed client signatures and sends only the supplied placement', async () => {
		const client = await import('../client/tags');
		const ensured = { tag: { id: 'tag', title: 'Work' }, created: true };
		const fetch = vi.fn().mockResolvedValueOnce(Response.json(ensured));
		vi.stubGlobal('fetch', fetch);
		expect(await client.ensureTag(' Work ')).toEqual(ensured);
		expect(fetch).toHaveBeenLastCalledWith(
			'/api/tags',
			expect.objectContaining({ method: 'POST', body: JSON.stringify({ title: ' Work ' }) })
		);
		const result = { tag: ensured.tag, concept: { id: 'concept' }, instance: { id: 'instance' } };
		fetch.mockResolvedValueOnce(Response.json(result));
		expect(await client.createTagInstance('tag/id', placement)).toEqual(result);
		expect(fetch).toHaveBeenLastCalledWith(
			'/api/tags/tag%2Fid/instances',
			expect.objectContaining({ method: 'POST', body: JSON.stringify(placement) })
		);
		fetch.mockResolvedValueOnce(
			Response.json({ error: 'Tag title is required.' }, { status: 400 })
		);
		await expect(client.ensureTag('')).rejects.toThrow('Tag title is required.');
		fetch.mockResolvedValueOnce(Response.json({ error: 'Repair the link.' }, { status: 409 }));
		await expect(client.createTagInstance('tag', placement)).rejects.toThrow('Repair the link.');
	});
});

describe('same-name Tag identity', () => {
	it('links explicit Concept drops separately despite equal names and reuses exact links', async () => {
		const first = await concepts.createConcept('B', { properties: { important: 'kept' } });
		const second = await concepts.createConcept('B', { properties: { another: 'value' } });
		const unlinked = await tags.ensureTag('B');
		const a = await tags.ensureTag('B', first.id);
		const b = await tags.ensureTag('B', second.id);
		expect(a.created).toBe(true);
		expect(b.created).toBe(true);
		expect(new Set([unlinked.tag.id, a.tag.id, b.tag.id]).size).toBe(3);
		expect(a.tag.representedByConceptId).toBe(first.id);
		expect(b.tag.representedByConceptId).toBe(second.id);
		expect(await tags.ensureTag('B', first.id)).toEqual({ tag: a.tag, created: false });
		expect(await saved('concepts.json')).toHaveLength(2);
		const result = await service.materializeTag(a.tag.id, placement);
		expect(result.concept).toEqual(first);
		expect(result.instance.conceptId).toBe(first.id);
		expect(await saved('concepts.json')).toHaveLength(2);
	});

	it('reuses exact links even when Tag and Concept titles differ', async () => {
		const concept = await concepts.createConcept('New Concept title');
		const tag = { id: 'tag', title: 'Old tag title', representedByConceptId: concept.id };
		await seed('tags.json', [tag]);
		expect(await tags.ensureTag(concept.title, concept.id)).toEqual({ tag, created: false });
	});

	it('ranks typed matches by shared Concept property count, keeping first on ties', async () => {
		const sparse = await concepts.createConcept('B', { properties: { one: '1' } });
		const rich = await concepts.createConcept('B', { properties: { one: '1', two: '2' } });
		const tied = await concepts.createConcept('B', { properties: { three: '3', four: '4' } });
		await instances.createConceptInstance({
			conceptId: sparse.id,
			properties: { a: 'a', b: 'b', c: 'c' }
		});
		const records = [
			{ id: 'unlinked', title: 'B' },
			{ id: 'broken', title: 'b', representedByConceptId: 'missing' },
			{ id: 'sparse', title: 'b', representedByConceptId: sparse.id },
			{ id: 'rich', title: 'B', representedByConceptId: rich.id },
			{ id: 'tied', title: 'B', representedByConceptId: tied.id }
		];
		await seed('tags.json', records);
		expect(await tags.ensureTag(' b ')).toEqual({ tag: records[3], created: false });
		expect(await saved('tags.json')).toEqual(records);
	});

	it('keeps first typed match when no match has shared properties', async () => {
		const concept = await concepts.createConcept('B');
		const records = [
			{ id: 'first', title: 'B' },
			{ id: 'second', title: 'B', representedByConceptId: concept.id }
		];
		await seed('tags.json', records);
		expect(await tags.ensureTag('B')).toEqual({ tag: records[0], created: false });
	});

	it('serializes concurrent exact-Concept drops without duplicate links', async () => {
		const a = await concepts.createConcept('B');
		const b = await concepts.createConcept('B');
		const results = await Promise.all([
			tags.ensureTag('B', a.id),
			tags.ensureTag('B', b.id),
			tags.ensureTag('B', a.id)
		]);
		expect(results[0].tag.id).toBe(results[2].tag.id);
		expect(results[1].tag.id).not.toBe(results[0].tag.id);
		expect(await saved('tags.json')).toHaveLength(2);
	});

	it('validates explicit source IDs and never falls back to title matching', async () => {
		const original = await tags.ensureTag('B');
		for (const id of ['', ' ', null, 1]) {
			expect((await ensureRequest({ title: 'B', representedByConceptId: id })).status).toBe(400);
		}
		expect((await ensureRequest({ title: 'B', representedByConceptId: 'missing' })).status).toBe(
			404
		);
		expect(await saved('tags.json')).toEqual([original.tag]);
	});

	it('carries the explicit source identity through HTTP and client contracts', async () => {
		const concept = await concepts.createConcept('B', { properties: { note: 'kept' } });
		await tags.ensureTag('B');
		const response = await ensureRequest({ title: 'B', representedByConceptId: concept.id });
		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.tag.representedByConceptId).toBe(concept.id);
		expect((await ensureRequest({ title: 'B', representedByConceptId: concept.id })).status).toBe(
			200
		);
		const client = await import('../client/tags');
		const fetch = vi.fn().mockResolvedValueOnce(Response.json(body));
		vi.stubGlobal('fetch', fetch);
		expect(await client.ensureTag('B', concept.id)).toEqual(body);
		expect(fetch).toHaveBeenCalledWith(
			'/api/tags',
			expect.objectContaining({
				body: JSON.stringify({ title: 'B', representedByConceptId: concept.id })
			})
		);
	});
});

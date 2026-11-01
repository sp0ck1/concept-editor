import { describe, expect, it } from 'vitest';
import { normalizeConcept } from './normalizeConcept';
import { normalizeConceptInstance } from './normalizeConceptInstance';
import {
	isConceptDates,
	normalizeConceptDates,
	normalizeConceptAppearance,
	normalizeConceptNotes
} from './metadata';

describe('model metadata normalization', () => {
	it('defaults legacy Concepts without adding appearance', () => {
		const concept = normalizeConcept({ id: 'c', title: 'Legacy' });
		expect(concept.notes).toEqual({ format: 'plain', text: '' });
		expect(concept.dates).toEqual([]);
		expect(concept).not.toHaveProperty('appearance');
	});

	it('defaults instance metadata without changing the legacy camera default', () => {
		const instance = normalizeConceptInstance({ id: 'i', conceptId: 'c' });
		expect(instance).toMatchObject({
			notes: { format: 'plain', text: '' },
			properties: {},
			view: 'tree',
			isPinned: false,
			lastCameraZoom: 0
		});
		expect(instance).not.toHaveProperty('tagIds');
	});

	it.each(['tree', 'notes', 'metadata'] as const)('retains the %s instance view', (view) => {
		expect(normalizeConceptInstance({ view, isPinned: true }).view).toBe(view);
		expect(normalizeConceptInstance({ view, isPinned: true }).isPinned).toBe(true);
	});

	it('repairs malformed instance metadata', () => {
		const raw = JSON.parse(
			'{"notes":{"format":"html","text":42},"properties":{"bad":2},"view":"invalid","isPinned":"false"}'
		);
		expect(normalizeConceptInstance(raw)).toMatchObject({
			notes: { format: 'plain', text: '' },
			properties: {},
			view: 'tree',
			isPinned: false
		});
	});

	it('accepts empty and real calendar dates, not invalid dates or timestamps', () => {
		expect(
			isConceptDates([
				{ date: '2024-02-29', dateLabel: 'Date' },
				{ date: '', dateLabel: '' }
			])
		).toBe(true);
		for (const date of ['2023-02-29', '2026-04-31', '10/26/2026', '2026-10-26T00:00:00Z']) {
			expect(isConceptDates([{ date, dateLabel: 'Date' }])).toBe(false);
		}
		expect(isConceptDates([])).toBe(true);
		expect(normalizeConceptDates([{ date: '2026-10-26' }, { date: 'invalid' }])).toEqual([
			{ date: '2026-10-26', dateLabel: 'Date' }
		]);
	});

	it('keeps optional appearance sparse and rejects malformed layers', () => {
		expect(normalizeConceptAppearance(undefined)).toBeUndefined();
		expect(normalizeConceptAppearance({ backgroundColor: 'blue' })).toEqual({
			backgroundColor: 'blue'
		});
		expect(
			normalizeConceptAppearance({
				backgroundLayers: [{ source: { type: 'asset', reference: 2 } }]
			})
		).toBeUndefined();
	});

	it('creates independent nested metadata for Concepts and instances', () => {
		const concept = normalizeConcept({
			notes: { format: 'plain', text: 'Shared' },
			dates: [{ date: '', dateLabel: 'Date' }],
			properties: { title: 'value' },
			tagIds: ['tag'],
			appearance: {
				backgroundLayers: [{ source: { type: 'asset', reference: 'paper' }, repeat: 'repeat' }]
			}
		});
		const copy = normalizeConcept(concept);
		copy.notes.text = 'Changed';
		copy.dates[0].dateLabel = 'Changed';
		copy.properties.title = 'Changed';
		copy.tagIds.push('another');
		copy.appearance!.backgroundLayers![0].repeat = 'no-repeat';
		expect(concept.notes.text).toBe('Shared');
		expect(concept.dates[0].dateLabel).toBe('Date');
		expect(concept.properties.title).toBe('value');
		expect(concept.tagIds).toEqual(['tag']);
		expect(concept.appearance!.backgroundLayers![0].repeat).toBe('repeat');
		const instance = normalizeConceptInstance({
			notes: { format: 'plain', text: 'Local' },
			properties: { mood: 'calm' }
		});
		const occurrence = normalizeConceptInstance(instance);
		occurrence.notes.text = 'Changed';
		occurrence.properties.mood = 'Changed';
		expect(instance.notes.text).toBe('Local');
		expect(instance.properties.mood).toBe('calm');
	});

	it('normalizes unsupported notes to empty plain text', () => {
		expect(normalizeConceptNotes({ format: 'html', text: '<b>unsupported</b>' })).toEqual({
			format: 'plain',
			text: ''
		});
	});
});

describe('optional instance sequence', () => {
	it.each([0, 1, 2.5])('preserves a finite sequence of %s', (sequence) => {
		expect(normalizeConceptInstance({ sequence }).sequence).toBe(sequence);
	});
	it.each([undefined, null, '1', NaN, Infinity, -Infinity])(
		'omits an unassigned or invalid sequence: %s',
		(sequence) => {
			const normalized = normalizeConceptInstance({ sequence: sequence as number });
			expect(normalized).not.toHaveProperty('sequence');
			expect(JSON.parse(JSON.stringify(normalized))).not.toHaveProperty('sequence');
		}
	);
});

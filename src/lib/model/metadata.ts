import type { ConceptAppearance, ConceptBackgroundLayer } from './ConceptAppearance';
import type { ConceptDate } from './ConceptDate';
import type { ConceptNotes } from './ConceptNotes';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isStringRecord(value: unknown): value is Record<string, string> {
	return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

export function isConceptNotes(value: unknown): value is ConceptNotes {
	return isRecord(value) && value.format === 'plain' && typeof value.text === 'string';
}

export function normalizeConceptNotes(value: unknown): ConceptNotes {
	return isConceptNotes(value)
		? { format: 'plain', text: value.text }
		: { format: 'plain', text: '' };
}

function isDateValue(value: unknown): value is string {
	if (value === '') return true;
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const date = new Date(`${value}T00:00:00.000Z`);
	return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isConceptDates(value: unknown): value is ConceptDate[] {
	return (
		Array.isArray(value) &&
		value.every(
			(entry) => isRecord(entry) && isDateValue(entry.date) && typeof entry.dateLabel === 'string'
		)
	);
}

export function normalizeConceptDates(value: unknown): ConceptDate[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((entry) => {
		if (!isRecord(entry) || !isDateValue(entry.date)) return [];
		return [
			{
				date: entry.date,
				dateLabel: typeof entry.dateLabel === 'string' ? entry.dateLabel : 'Date'
			}
		];
	});
}

const layerFields = [
	'position',
	'size',
	'repeat',
	'origin',
	'clip',
	'attachment',
	'blendMode'
] as const;

function isBackgroundLayer(value: unknown): value is ConceptBackgroundLayer {
	if (!isRecord(value) || !isRecord(value.source)) return false;
	const source = value.source;
	const validSource =
		(source.type === 'asset' && typeof source.reference === 'string') ||
		(source.type === 'gradient' && typeof source.value === 'string');
	return (
		validSource &&
		layerFields.every((field) => value[field] === undefined || typeof value[field] === 'string')
	);
}

export function isConceptAppearance(value: unknown): value is ConceptAppearance {
	return (
		isRecord(value) &&
		(value.backgroundColor === undefined || typeof value.backgroundColor === 'string') &&
		(value.backgroundLayers === undefined ||
			(Array.isArray(value.backgroundLayers) && value.backgroundLayers.every(isBackgroundLayer)))
	);
}

export function normalizeConceptAppearance(value: unknown): ConceptAppearance | undefined {
	if (!isConceptAppearance(value)) return undefined;
	const appearance: ConceptAppearance = {};
	if (value.backgroundColor !== undefined) appearance.backgroundColor = value.backgroundColor;
	if (value.backgroundLayers !== undefined) {
		appearance.backgroundLayers = value.backgroundLayers.map((layer) => {
			const copy: ConceptBackgroundLayer = {
				source:
					layer.source.type === 'asset'
						? { type: 'asset', reference: layer.source.reference }
						: { type: 'gradient', value: layer.source.value }
			};
			for (const field of layerFields) {
				if (layer[field] !== undefined) copy[field] = layer[field];
			}
			return copy;
		});
	}
	return appearance;
}

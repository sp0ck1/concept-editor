import type { ConceptParser } from '$lib/parsers/types';

export const lineParser: ConceptParser = {
	id: 'line-by-line',
	label: 'Line-by-line concepts',

	parse(input) {
		const seenTitles = new Set<string>();
		const warnings: string[] = [];

		const items = input
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean)
			.map((title) => ({
				title,
				sourceText: title
			}))
			.filter((item) => {
				const normalizedTitle = item.title.toLowerCase();

				if (seenTitles.has(normalizedTitle)) {
					warnings.push(`Skipped duplicate line: ${item.title}`);
					return false;
				}

				seenTitles.add(normalizedTitle);
				return true;
			});

		return {
			items,
			warnings
		};
	}
};
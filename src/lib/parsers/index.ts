import type { ConceptParser } from '$lib/parsers/types';
import { lineParser } from '$lib/parsers/lineParser';
// import { csvParser } from '$lib/parsers/csvParser';
// import { markdownOutlineParser } from '$lib/parsers/markdownOutlineParser';

// export const conceptParsers = [lineParser, csvParser, markdownOutlineParser];

export const conceptParsers: ConceptParser[] = [lineParser];

export { lineParser };
export type { ConceptParser, ConceptParserResult, ParsedConceptInput } from '$lib/parsers/types';
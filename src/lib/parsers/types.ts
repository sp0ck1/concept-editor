export type ParsedConceptInput = {
	title: string;
	sourceText: string;
};

export type ConceptParserResult = {
	items: ParsedConceptInput[];
	warnings: string[];
};

export type ConceptParser = {
	id: string;
	label: string;
	parse: (input: string) => ConceptParserResult;
};
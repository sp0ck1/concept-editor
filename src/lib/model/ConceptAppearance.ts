export type ConceptBackgroundSource =
	{ type: 'asset'; reference: string } | { type: 'gradient'; value: string };

export type ConceptBackgroundLayer = {
	source: ConceptBackgroundSource;
	position?: string;
	size?: string;
	repeat?: string;
	origin?: string;
	clip?: string;
	attachment?: string;
	blendMode?: string;
};

export type ConceptAppearance = {
	backgroundColor?: string;
	backgroundLayers?: ConceptBackgroundLayer[];
};

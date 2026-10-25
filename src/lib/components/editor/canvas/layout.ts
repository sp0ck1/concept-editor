import type { ConceptCardView } from '$lib/model/ConceptCardView';
import { defaultConceptWidth, defaultConceptHeight } from '$lib/model/normalizeConceptInstance';

export type PackedCardPlacement = {
	card: ConceptCardView;
	x: number;
	y: number;
	width: number;
	height: number;
};

export type PackedLayout = {
	placements: PackedCardPlacement[];
	width: number;
	height: number;
	columns: number;
};

export const conceptSizePresets = {
	small: { width: 180, height: 64 },
	medium: { width: defaultConceptWidth, height: defaultConceptHeight },
	large: { width: 520, height: 360 }
} as const;

export type ConceptSizePreset = keyof typeof conceptSizePresets;

export function packCardsIntoColumns(
	cardsToPack: ConceptCardView[],
	columns: number,
	columnUnitWidth: number,
	gap: number
): PackedLayout {
	const columnHeights = Array.from({ length: columns }, () => 0);

	const placements = cardsToPack.map((card) => {
		const cardWidth = card.instance.width;
		const cardHeight = card.instance.height;

		const columnSpan = Math.min(
			columns,
			Math.max(1, Math.ceil((cardWidth + gap) / (columnUnitWidth + gap)))
		);

		let bestColumn = 0;
		let bestY = Number.POSITIVE_INFINITY;

		for (let column = 0; column <= columns - columnSpan; column += 1) {
			const candidateY = Math.max(...columnHeights.slice(column, column + columnSpan));

			if (candidateY < bestY) {
				bestY = candidateY;
				bestColumn = column;
			}
		}

		const spanWidth = columnSpan * columnUnitWidth + (columnSpan - 1) * gap;

		const x = bestColumn * (columnUnitWidth + gap) + Math.max(0, (spanWidth - cardWidth) / 2);

		const y = bestY;

		const nextColumnHeight = y + cardHeight + gap;

		for (let column = bestColumn; column < bestColumn + columnSpan; column += 1) {
			columnHeights[column] = nextColumnHeight;
		}

		return {
			card,
			x,
			y,
			width: cardWidth,
			height: cardHeight
		};
	});

	const right = Math.max(...placements.map((placement) => placement.x + placement.width));
	const bottom = Math.max(...placements.map((placement) => placement.y + placement.height));

	return {
		placements,
		width: right,
		height: bottom,
		columns
	};
}

export function chooseBestPackedLayout(
	cardsToPack: ConceptCardView[],
	gap: number,
	viewportSize: { width: number; height: number }
): PackedLayout {
	const viewportRatio = viewportSize.width / Math.max(1, viewportSize.height);

	const columnUnitWidth = conceptSizePresets.small.width;
	const maxColumns = Math.max(1, Math.min(cardsToPack.length, 12));

	let bestLayout: PackedLayout | null = null;
	let bestScore = Number.POSITIVE_INFINITY;

	for (let columns = 1; columns <= maxColumns; columns += 1) {
		const layout = packCardsIntoColumns(cardsToPack, columns, columnUnitWidth, gap);

		const layoutRatio = layout.width / Math.max(1, layout.height);
		const ratioScore = Math.abs(Math.log(layoutRatio / viewportRatio));

		const areaScore = (layout.width * layout.height) / 1000000;

		const score = ratioScore * 10 + areaScore;

		if (score < bestScore) {
			bestScore = score;
			bestLayout = layout;
		}
	}

	if (!bestLayout) {
		return packCardsIntoColumns(cardsToPack, 1, columnUnitWidth, gap);
	}

	return bestLayout;
}

export function getTitleSizedConceptWidth(title: string) {
	const text = title.trim() || 'Untitled Concept';

	const approximateCharacterWidth = 9;
	const horizontalPadding = 32;
	const resizeHandleAllowance = 28;

	return Math.min(
		900,
		Math.max(
			conceptSizePresets.small.width,
			text.length * approximateCharacterWidth + horizontalPadding + resizeHandleAllowance
		)
	);
}

export function getImportedConceptSize(title: string) {
	return {
		width: getTitleSizedConceptWidth(title),
		height: conceptSizePresets.small.height
	};
}

export function getNearbyCardPosition(card: ConceptCardView) {
	const gap = 116;
	const verticalOffset = 40;
	const randomHoriOffset = Math.random() * (Math.random() >= 0.5 ? 1 : -1);
	const randomVertOffset = Math.random() * (Math.random() >= 0.5 ? 1 : -1);
	return {
		x: card.instance.x + gap * randomHoriOffset,
		y: card.instance.y + verticalOffset * randomVertOffset
	};
}

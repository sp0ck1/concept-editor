export type Rect = {
	left: number;
	top: number;
	right: number;
	bottom: number;
};

export function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

export function normalizeRect(rect: Rect): Rect {
	return {
		left: Math.min(rect.left, rect.right),
		top: Math.min(rect.top, rect.bottom),
		right: Math.max(rect.left, rect.right),
		bottom: Math.max(rect.top, rect.bottom)
	};
}

export function getRectWidth(rect: { left: number; right: number }) {
	return rect.right - rect.left;
}

export function getRectHeight(rect: { top: number; bottom: number }) {
	return rect.bottom - rect.top;
}

export function getRectOverlapRatio(targetRect: Rect, selectionRect: Rect) {
	const overlapLeft = Math.max(targetRect.left, selectionRect.left);
	const overlapTop = Math.max(targetRect.top, selectionRect.top);
	const overlapRight = Math.min(targetRect.right, selectionRect.right);
	const overlapBottom = Math.min(targetRect.bottom, selectionRect.bottom);

	const overlapWidth = Math.max(0, overlapRight - overlapLeft);
	const overlapHeight = Math.max(0, overlapBottom - overlapTop);
	const overlapArea = overlapWidth * overlapHeight;

	const targetWidth = Math.max(0, targetRect.right - targetRect.left);
	const targetHeight = Math.max(0, targetRect.bottom - targetRect.top);
	const targetArea = targetWidth * targetHeight;

	return targetArea === 0 ? 0 : overlapArea / targetArea;
}

export	function canvasPointToWorldPoint(point: { x: number; y: number }, panX: number, panY: number, zoom: number) {
		return {
			x: (point.x - panX) / zoom,
			y: (point.y - panY) / zoom
		};
	}

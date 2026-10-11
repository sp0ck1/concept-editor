import type { ConceptCardView } from '$lib/model/ConceptCardView';

export type DragState =
	| {
			active: false;
			instanceId: null;
			startMouseX: 0;
			startMouseY: 0;
			startInstanceX: 0;
			startInstanceY: 0;
			draggedCards: [];
	  }
	| {
			active: true;
			instanceId: string;
			startMouseX: number;
			startMouseY: number;
			startInstanceX: number;
			startInstanceY: number;
			draggedCards: DraggedCardStart[];
	  };

export type PendingDragState =
	| {
			active: false;
			instanceId: null;
			startMouseX: 0;
			startMouseY: 0;
			startInstanceX: 0;
			startInstanceY: 0;
			draggedCards: [];
	  }
	| {
			active: true;
			instanceId: string;
			startMouseX: number;
			startMouseY: number;
			startInstanceX: number;
			startInstanceY: number;
			draggedCards: DraggedCardStart[];
	  };

export type ResizeState =
	| {
			active: false;
			instanceId: null;
			startMouseX: 0;
			startMouseY: 0;
			startWidth: 0;
			startHeight: 0;
	  }
	| {
			active: true;
			instanceId: string;
			startMouseX: number;
			startMouseY: number;
			startWidth: number;
			startHeight: number;
	  };

export type ChildDragState =
	| {
			active: false;
			childCard: null;
			mouseX: 0;
			mouseY: 0;
	  }
	| {
			active: true;
			childCard: ConceptCardView;
			mouseX: number;
			mouseY: number;
	  };

export type SelectionBoxState =
	| {
			active: false;
			startCanvasX: 0;
			startCanvasY: 0;
			currentCanvasX: 0;
			currentCanvasY: 0;
			additive: false;
	  }
	| {
			active: true;
			startCanvasX: number;
			startCanvasY: number;
			currentCanvasX: number;
			currentCanvasY: number;
			additive: boolean;
	  };

export type DraggedCardStart = {
			instanceId: string;
			startX: number;
			startY: number;
};

export type CanvasCamera = {
	panX: number;
	panY: number;
	zoom: number;
};


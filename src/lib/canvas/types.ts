	import {
		defaultConceptWidth,
		defaultConceptHeight
	} from '$lib/concepts/normalizeConceptInstance';

export type Concept = {
  id: string;
  title: string;
  properties: Record<string, string>;
  tagConceptIds: string[];
};

export type ConceptInstance = {
  id: string;
  conceptId: string;
  parentInstanceId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ConceptCardView = {
  instance: ConceptInstance;
  concept: Concept;
};

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

export type ChildTileDragState =
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

export type ContextMenu =
	| {
			visible: false;
			x: 0;
			y: 0;
			targetType: null;
			instanceId: null;
	  }
	| {
			visible: true;
			x: number;
			y: number;
			worldX: number;
			worldY: number;
			targetType: 'canvas';
			instanceId: null;
	  }
	| {
			visible: true;
			x: number;
			y: number;
			targetType: 'card';
			instanceId: string;
	  };

export type CreateConceptOptions = {
	position?: {x: number; y: number };
	title?: string;
	width?: number;
	height?: number;
	parentInstanceId?: string | null;
	sizePreset?: ConceptSizePreset;
	focusAfterCreate?:boolean;
};



export type SidebarTab = 'concept' | 'tree';
export type MainView = 'canvas' | 'table';
export const conceptSizePresets = {
		small: { width: 180, height: 64 },
		medium: { width: defaultConceptWidth, height: defaultConceptHeight },
		large: { width: 520, height: 360 }
	} as const;

export type ConceptSizePreset = keyof typeof conceptSizePresets;

export function emptySelectionBoxState(): SelectionBoxState {
	return {
		active: false,
		startCanvasX: 0,
		startCanvasY: 0,
		currentCanvasX: 0,
		currentCanvasY: 0,
		additive: false
	};
}

export function emptyDragState(): DragState {
	return {
		active: false,
		instanceId: null,
		startMouseX: 0,
		startMouseY: 0,
		startInstanceX: 0,
		startInstanceY: 0,
		draggedCards: []
	};
}

export function emptyPendingDragState(): PendingDragState {
	return {
		active: false,
		instanceId: null,
		startMouseX: 0,
		startMouseY: 0,
		startInstanceX: 0,
		startInstanceY: 0,
		draggedCards: []
	};
}

export function emptyResizeState(): ResizeState {
	return {
		active: false,
		instanceId: null,
		startMouseX: 0,
		startMouseY: 0,
		startWidth: 0,
		startHeight: 0
	};
}

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
  lastCameraPanX: number;
  lastCameraPanY: number;
  lastCameraZoom: number;
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

type ContextMenuTarget =
	| {
			targetType: null;
			instanceId: null;
	  }
	| {
			targetType: 'canvas';
			worldX: number;
			worldY: number;
			instanceId: null;
	  }
	| {
			targetType: 'card';
			instanceId: string;
	  };

export type ContextMenu = {
	visible: boolean;
	x: number;
	y: number;
} & ContextMenuTarget;

export type CreateConceptOptions = {
			position?: {x: number; y: number };
			title?: string;
			width?: number;
			height?: number;
			parentInstanceId?: string | null;
			sizePreset?: ConceptSizePreset;
			focusAfterCreate?:boolean;
			lastCameraPanX?: number;
			lastCameraPanY?: number;
			lastCameraZoom?: number;
};

export type SidebarTab = 'concept' | 'tree';

export type MainView = 'canvas' | 'table';

export const conceptSizePresets = {
		small: { width: 180, height: 64 },
		medium: { width: defaultConceptWidth, height: defaultConceptHeight },
		large: { width: 520, height: 360 }
	} as const;

export type ConceptSizePreset = keyof typeof conceptSizePresets;


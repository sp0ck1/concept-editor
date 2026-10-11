import type { Concept } from '$lib/model/Concept';
import type { ConceptCardView } from '$lib/model/ConceptCardView';
import type { ConceptInstance } from '$lib/model/ConceptInstance';
import type { ConceptRelationship } from '$lib/model/ConceptRelationship';
import type { RelationshipDefinition } from '$lib/model/RelationshipDefinition';
import type { ConceptSizePreset } from '$lib/components/editor/canvas/layout';

export type EditorData = {
	concepts: Concept[];
	instances: ConceptInstance[];
	relationships: ConceptRelationship[];
	relationshipDefinitions: RelationshipDefinition[];
};

export type CreateConceptOptions = {
	position?: { x: number; y: number };
	title?: string;
	width?: number;
	height?: number;
	parentInstanceId?: string | null;
	sizePreset?: ConceptSizePreset;
	focusAfterCreate?: boolean;
	lastCameraPanX?: number;
	lastCameraPanY?: number;
	lastCameraZoom?: number;
};

export type MainView = 'canvas' | 'table';

export type SidebarTab = 'concept' | 'tree';

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

export type TitleConflictState = {
	card: ConceptCardView;
	title: string;
	matchingConcepts: Concept[];
};

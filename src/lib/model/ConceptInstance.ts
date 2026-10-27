import type { ConceptNotes } from './ConceptNotes';
import type { ConceptInstanceView } from './ConceptInstanceView';

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
	notes: ConceptNotes;
	properties: Record<string, string>;
	view: ConceptInstanceView;
	isPinned: boolean;
};

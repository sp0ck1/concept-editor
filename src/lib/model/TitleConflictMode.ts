export type TitleConflictMode = 'report-conflict' | 'use-existing' | 'create-duplicate';

export type TitleConflictResolution = {
	targetConceptId: string;
	sourceInstanceId?: string;
	destination: 'current-instance' | 'new-instance';
	propertyKeys: string[];
	copyNotes: boolean;
	copyChildren: boolean;
	retainChildMetadata: boolean;
};

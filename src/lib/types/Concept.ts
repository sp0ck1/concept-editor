export type Concept = {
  id: string;
  title: string;
  properties: Record<string, string>;
  tagConceptIds: string[];
};
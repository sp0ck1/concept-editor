export type ConceptInstance = {
  id: string;
  conceptId: string;
  parentInstanceId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
};
import type { Concept } from '$lib/types/Concept';
import type { ConceptInstance } from '$lib/types/ConceptInstance';

export type ConceptCardView = {
  instance: ConceptInstance;
  concept: Concept;
};
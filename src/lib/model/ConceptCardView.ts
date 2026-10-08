import type { Concept } from '$lib/model/Concept';
import type { ConceptInstance } from '$lib/model/ConceptInstance';

export type ConceptCardView = {
  instance: ConceptInstance;
  concept: Concept;
};
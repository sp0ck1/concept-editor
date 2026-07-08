import type { ConceptInstance } from '$lib/types/ConceptInstance';

export const defaultConceptWidth = 350;
export const defaultConceptHeight = 250;

export function normalizeConceptInstance(
  instance: Partial<ConceptInstance>,
  index = 0
): ConceptInstance {
  return {
    id: instance.id ?? `missing-instance-id-${index}`,
    conceptId: instance.conceptId ?? `missing-concept-id-${index}`,
    parentInstanceId: instance.parentInstanceId ?? null,
    x: instance.x ?? 32 + index * 248,
    y: instance.y ?? 32,
    width: instance.width ?? defaultConceptWidth,
    height: instance.height ?? defaultConceptHeight
  };
}
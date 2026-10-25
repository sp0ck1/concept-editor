# Application architecture: worked trace

[Chapter](../01-architecture.md)

## Instance loading path

| Step | Source                                                     | Operation and result                                                                                                        |
| ---- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1    | `src/lib/server/repositories/conceptInstanceRepository.ts` | `getAllConceptInstances()` reads `concept_instances.json`, parses it, and maps `normalizeConceptInstance()` over the values |
| 2    | `src/routes/+page.server.ts`                               | `load()` gathers the instance array along with Concepts, relationships, and definitions                                     |
| 3    | `src/routes/+page.svelte`                                  | Receives page `data` and passes it to `ConceptEditor`                                                                       |
| 4    | `src/lib/components/editor/ConceptEditor.svelte`           | Constructs one Editor initially and forwards refreshed records through `replaceData()`                                      |
| 5    | `src/lib/components/editor/Editor.svelte.ts`               | `cards` looks up each instance's Concept in `conceptsById`, producing a `ConceptCardView` when found                        |
| 6    | The same Editor                                            | `cardsInCurrentCanvas` retains pairs whose `parentInstanceId` matches the current owner                                     |
| 7    | `src/lib/components/editor/canvas/ConceptCanvas.svelte`    | Renders `<ConceptCard {card} />` for each pair, keyed by instance ID                                                        |
| 8    | `src/lib/components/editor/card/ConceptCard.svelte`        | Reads the Concept's information and the instance's geometry from its prop                                                   |

The matching Concept is attached in step 5. The current-context filter is step 6. Neither operation creates or persists a new record.

## Verification

Each step can be checked through its import, function call, prop, or derived field in source. No browser interaction or data mutation is necessary. `npm run check` verifies the unchanged application's static baseline, not the trace itself.

## Summary

An instance remains a placement record throughout loading. The Editor joins it with shared Concept data for display; the component renders that pair without becoming another persisted entity.

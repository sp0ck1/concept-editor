# Loading and derived cards: canvas summary

[Chapter](../05-loading-and-derived-cards.md#exercise-display-a-canvas-summary)

## Derived counts

In `src/lib/components/editor/canvas/CanvasTopbar.svelte`, after `const editor = getEditorContext();`, add:

```ts
let placementCount = $derived(editor.cardsInCurrentCanvas.length);
let distinctConceptCount = $derived(
	new Set(editor.cardsInCurrentCanvas.map((card) => card.concept.id)).size
);
```

Inside the existing `concept-topbar-title` element, after its owner-title conditional, add:

```svelte
<small>
	{placementCount}
	{placementCount === 1 ? 'placement' : 'placements'} /
	{distinctConceptCount}
	{distinctConceptCount === 1 ? 'concept' : 'concepts'}
</small>
```

## How the counts differ

The array length counts placements. The Set contains Concept IDs, so repeated occurrences of one Concept contribute only one distinct value.

| Current-canvas data                              | Placements | Distinct Concepts |
| ------------------------------------------------ | ---------- | ----------------- |
| Empty collection                                 | 0          | 0                 |
| One card                                         | 1          | 1                 |
| Two instances referencing the same Concept       | 2          | 1                 |
| Two Concepts with equal titles and different IDs | 2          | 2                 |

The Set is constructed as part of the calculation, not mutated later as persistent reactive state. This does not require changing the Editor's collections or adding an API.

## Update path

A record refresh or owner change can update `cardsInCurrentCanvas`. Both derived counts depend on that collection, so the markup follows it. The global count from the Concepts exercise uses `editor.cards` instead; the two labels intentionally answer different questions.

## Verification and removal

Run `npm run check`. For optional visual verification, observe the initially loaded canvas without changing records. Use the hypothetical cases above to check the expressions; do not edit live JSON or create placements to reproduce them.

Remove only these two declarations and their `<small>` element to undo the exercise. Keep other topbar commands if desired.

## Summary

Both counts come from the same current-canvas collection. Instance count uses its length; distinct Concept count collapses repeated Concept IDs. Neither result belongs in storage.

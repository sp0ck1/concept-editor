# Cards: identity labels

[Chapter](../06-cards.md#exercise-display-the-two-identities)

## Implementation

In `src/lib/components/editor/card/ConceptCard.svelte`, immediately after the existing title input and before `{#if !isCollapsed}`, insert:

```svelte
<small aria-label="Card identity">
	Concept ID: <code>{concept.id}</code>
	· Instance ID: <code>{instance.id}</code>
</small>
```

The component already derives `concept` and `instance` from the `card` prop. No script declaration, import, schema field, or API request is required.

The label is outside the conditional body. Small cards may still clip its contents under the existing layout; making the detail layout adaptive is a separate feature. Do not change geometry or CSS for this exercise.

## Meaning of the labels

Two occurrences of one Concept have the same Concept ID and different instance IDs. Two unrelated Concepts can have equal titles while retaining different Concept IDs. The labels expose that distinction without changing it.

Because the values come from the prop's current records, they follow replacement data and any later reassignment. A local copy would introduce state that could become stale.

## Verification and removal

Run `npm run check`. Optional visual inspection can use existing cards on the initial canvas. Inspect source to confirm all existing title, pointer, and resize handlers remain unchanged; performing those interactions is not necessary for this display-only test.

Actual dragging, resizing, title commits, and camera navigation can write records. Do not use live data to manufacture repeated occurrences or reassignment cases.

Remove only the added `<small>` element to undo the exercise. An occurrence-count label from the Concepts chapter can remain. No data rollback is needed for the markup addition itself.

## Summary

The visual card receives both identities through its `ConceptCardView` prop. Displaying them requires no new model or state; the component already has the underlying information.

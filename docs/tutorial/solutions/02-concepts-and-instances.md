# Concepts and instances: occurrence count

[Chapter](../02-concepts-and-instances.md#exercise-display-occurrence-counts)

## Implementation

In `src/lib/components/editor/card/ConceptCard.svelte`, add this declaration after `tagConcepts`:

```ts
let occurrenceCount = $derived(
	editor.cards.filter((candidate) => candidate.concept.id === concept.id).length
);
```

Inside the existing `card-sidebar` element, before `ConceptTagsPreview`, add:

```svelte
<small>
	{occurrenceCount}
	{occurrenceCount === 1 ? 'occurrence' : 'occurrences'}
</small>
```

No import is needed: the component already has `editor` and `concept`.

## How it works

`editor.cards` contains all joined card views, including those outside the currently open canvas. Filtering by Concept ID counts distinct placements of this Concept. Filtering by title would incorrectly combine different same-title Concepts.

The expression is derived from reactive data. When refreshed records change the card collection or the current card references another Concept, Svelte can recalculate the label. There is no separately saved count to synchronize.

This counts placements, not child instances. Children would instead be queried with this card's instance ID.

## Verification and removal

Run `npm run check`. On already visible expanded cards, the displayed value should match the number of loaded instances referring to that Concept. Different occurrences of the same Concept should agree. The body is hidden on size-collapsed cards.

Do not create, resize, drag, or navigate against live data to obtain test cases. Those actions can write records even though the label itself does not.

To remove the exercise, delete only `occurrenceCount` and its `<small>` element. Keep any other card additions, including the later ID display.

## Summary

The label derives a global occurrence count from shared Concept identity. It adds presentation information without changing the Concept, instance, or persisted shape.

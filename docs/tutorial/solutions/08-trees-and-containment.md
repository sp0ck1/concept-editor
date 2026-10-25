# Trees and containment: worked solution

[Trees and containment](../08-trees-and-containment.md) · [Navigation and cameras](../09-navigation-and-cameras.md)

## Scope

This optional display change adds immediate child counts to ordinary nodes and visible root rows. It requires no earlier exercise changes.

Only these source files would change:

- `src/lib/components/editor/tree/TreeViewNode.svelte`
- `src/lib/components/editor/tree/TreeView.svelte`

The Editor already answers containment queries. The components already hold the relevant arrays, so neither an extra query nor a stored count is needed.

## Ordinary node count

In `TreeViewNode.svelte`, keep the existing `children` derivation and add `childCount` immediately after it:

```ts
let children = $derived(editor.getChildCards(card.instance.id));
let childCount = $derived(children.length);
let hasChildren = $derived(children.length > 0);
```

Change only the text inside the existing node label:

```svelte
<span class="tree-node-label" title={displayTitle}>
	{displayTitle} ({childCount})
</span>
```

`children` is scoped to `card.instance.id`, not `card.concept.id`. Two occurrences of the same Concept can therefore show different counts. Leaves display `(0)` and retain their existing toggle spacer.

Keep `expanded`, the toggle handler, recursive instance keys, row pointer handlers, and `data-instance-id` / `data-concept-id` unchanged. Counts do not require a change to recursion or drag behavior.

## Visible root count

In `TreeView.svelte`, add a count after the complete existing root collection derivation:

```ts
let rootConceptInstances = $derived.by(() => {
	if (rootCard) {
		return editor.getChildCards(rootCard.instance.id);
	}

	return editor.getRootCards();
});

let rootChildCount = $derived(rootConceptInstances.length);
```

Change only the text inside its existing label:

```svelte
<span class="tree-root-label" title={rootLabel}>
	{rootLabel} ({rootChildCount})
</span>
```

Without `rootCard`, this counts root card views. With `rootCard`, it counts that particular occurrence's immediate children. It excludes grandchildren and does not depend on expansion.

An empty `ConceptDropArea` renders a placeholder instead of a tree, so this change does not create a new root row in an empty card. The sidebar root still exists and can display `(0)`.

## Resulting behavior

For a Garage instance containing one Bicycle instance, with a checklist beneath Bicycle:

```text
Garage (1)
└─ Bicycle (1)
   └─ Repair checklist (0)
```

Expanding Bicycle reveals the checklist but leaves Garage's count at `1`. A second Bicycle occurrence with no children displays `(0)` even if it references the same Concept.

The update path is `canonical records → Editor cards → immediate child array → derived length → label`. Existing loader refreshes after real containment mutations recalculate these values. No count field can become stale because none is persisted.

## Verification and safety

Run `npm run check` from the project root with native WSL Node/npm. Inspect existing hierarchy to verify:

- Global root and card-root rows show their immediate counts.
- Leaf rows show `(0)` and retain the spacer.
- Counts remain visible when rows are collapsed.
- Expanding grandchildren does not increase an ancestor's immediate count.
- Repeated occurrences can display different counts.

Expansion and count inspection do not require writes. Hold-to-drag and navigation can write live JSON. Before those browser checks, stop the app and make and verify an external backup of all four JSON files under `src/lib/data/`, or use an isolated disposable application copy. Do not manufacture test cases in personal data or run automated mutation tests against live storage.

On protected data, verify early release cancels the card's 300 ms hold and a full hold still starts child dragging. Card trees receive those callbacks; the sidebar's `<TreeView />` does not. Do not add sidebar dragging as part of a count change.

## Reversal

Remove `childCount`, `rootChildCount`, and their appended label text. Leave all existing arrays, callbacks, attributes, and keys intact, then rerun `npm run check`. If browser testing changed data, restore only with the app stopped and preserve desired post-backup changes; removing count code does not undo those writes.

## Summary

Immediate child counts are derived label information. Reusing the existing arrays preserves occurrence-specific containment, independent expansion state, and the current card-versus-sidebar drag boundary.

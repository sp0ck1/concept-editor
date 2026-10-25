# 11. Properties and tags — solution

## Derive and render the summary

Change only `src/lib/components/editor/sidebar/ConceptSidebar.svelte`. After the existing `currentCanvasOwnerCard` declaration, add:

```ts
let metadataSummary = $derived.by(() => {
	const concept = currentCanvasOwnerCard?.concept;

	if (!concept) {
		return '';
	}

	const propertyCount = Object.keys(concept.properties ?? {}).length;
	const tagCount = (concept.tagConceptIds ?? []).length;
	const propertyWord = propertyCount === 1 ? 'property' : 'properties';
	const tagWord = tagCount === 1 ? 'tag' : 'tags';

	return `${propertyCount} ${propertyWord} · ${tagCount} ${tagWord}`;
});
```

In the existing current-owner branch, immediately after the instance ID, add the summary line:

```svelte
<div class="sidebar-id">{sidebarCard.instance.id}</div>
<div aria-label="Metadata summary">{metadataSummary}</div>
```

No import, Editor command, model field, or CSS change is needed. Keep unrelated sidebar code, including the optional relationship count, unchanged.

## Why this value is derived here

`currentCanvasOwnerCard` already identifies the Concept being inspected. The count is a presentation of that Concept's existing data, so a component-local `$derived.by` is sufficient. Storing the summary would introduce another value that could disagree with the metadata.

`tagConceptIds.length` counts stored references. `editor.getTagConcepts(...)` would instead count references that resolve to loaded Concepts. The exercise explicitly asks for the former; a missing Concept may make the summary larger than the visible tag tile count.

When records are refreshed:

1. `ConceptEditor.svelte` calls `editor.replaceData`.
2. Editor card views and `currentCanvasOwnerCard` derive from the new records.
3. `metadataSummary` recalculates without a separate update command.

Changing the owner Concept also changes the summary. Different instances of the same Concept report the same counts because metadata is not stored on the instance.

## Verification

Run from the project root:

```sh
npm run check
npm run build
```

Use an isolated disposable project copy for browser checks. Navigation can save cameras even though the summary does not write metadata.

| Property keys | Tag IDs | Expected text           |
| ------------: | ------: | ----------------------- |
|             0 |       0 | `0 properties · 0 tags` |
|             1 |       0 | `1 property · 0 tags`   |
|             0 |       1 | `0 properties · 1 tag`  |
|             2 |       3 | `2 properties · 3 tags` |

Use existing examples or disposable fixtures rather than changing live metadata. Confirm root omits the summary, switching owner Concepts updates it, and the optional relationship heading remains independent.

## Cleanup

Remove the `metadataSummary` declaration and the added `aria-label="Metadata summary"` element. Do not remove the instance ID or another exercise's changes. No data rollback is required for this display change.

## Summary

The summary derives from shared Concept metadata and counts stored values rather than resolved display objects. It adds no persistence or dependency on an earlier exercise.

- [Properties and tags](../11-properties-and-tags.md)
- [HTTP and persistence](../12-http-and-persistence.md)

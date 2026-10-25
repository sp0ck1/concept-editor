# 03. Relationships — solution

## Change the heading

In `src/lib/components/editor/sidebar/ConceptSidebar.svelte`, replace:

```svelte
<div class="sidebar-label">Relationships</div>
```

with:

```svelte
<div class="sidebar-label">Relationships ({relationships.length})</div>
```

This is the entire change. It needs no imports, state, helpers, or CSS and does not require changes from another exercise.

## Use the existing selection

The component already declares:

```ts
let relationships = $derived(editor.currentConceptRelationships);
```

Its relationship list iterates the same value:

```svelte
{#each relationships as relationship (relationship.id)}
```

`Editor.currentConceptRelationships` selects records for the owner Concept through `getRelationshipsForConcept`. Counting `editor.relationships` would count the whole workspace. Calling the query again inside the component would duplicate selection logic unnecessarily.

The count includes a represented-only record even when `getRelationshipDisplayParts` returns an empty array for it. The exercise counts selected records and existing row elements, not complete sentences.

## Verification

Run from the project root:

```sh
npm run check
npm run build
```

For browser checks, use an isolated disposable project copy, not the live workspace. Opening canvases may persist cameras independently of this display change.

| Selected records | Expected heading    |
| ---------------: | ------------------- |
|                0 | `Relationships (0)` |
|                1 | `Relationships (1)` |
|                3 | `Relationships (3)` |

Use existing examples where available; do not edit live relationship records to produce every case. Also check:

- Root omits the Concept relationship section.
- Zero records retain `No relationships yet.`.
- The count matches `.sidebar-relationship-row` elements, including empty rows.
- Opening another owner Concept updates the count.
- The hash from `sha256sum src/lib/data/concept_relationships.json` is unchanged before and after the checks.

Adding the heading causes no HTTP request or persistence operation. That does not mean unrelated navigation is free of writes.

## Cleanup

Restore only the literal `Relationships` heading. Do not alter records or remove unrelated sidebar work.

## Summary

The heading and rows use one derived collection. No new query or stored count is needed, and the change leaves relationship selection and formatting limits unchanged.

- [Relationships](../03-relationships.md)
- [Editor and context](../04-editor-and-context.md)

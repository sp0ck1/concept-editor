# Navigation and cameras: worked solution

[Navigation and cameras](../09-navigation-and-cameras.md) · [Creation and title editing](../10-creation-and-title-editing.md)

## Scope

This optional change displays current canvas depth from the existing breadcrumb. It requires no Reset View or child-count implementation.

The only source file that would change is `src/lib/components/editor/canvas/CanvasTopbar.svelte`. The Editor already owns containment traversal; the controller already owns cameras. Neither needs another operation for this display.

## Derived depth

After obtaining the Editor from context, add a derived value:

```svelte
<script lang="ts">
	import { getEditorContext } from '$lib/components/editor/EditorContext';

	const editor = getEditorContext();
	let currentCanvasDepth = $derived(editor.currentBreadcrumb.length);
</script>
```

This is the complete script for the unmodified topbar plus the new declaration. If other exercises added imports or declarations, preserve them and insert only the new line.

At root, the breadcrumb is `[]`. For a valid instance-owned path, it contains the owner and each ancestor, in ancestor-to-owner order. A canvas owned by a root instance therefore has depth `1`.

The Editor's traversal stops on missing cards or repeated IDs. The display reports the resolved breadcrumb length; it does not validate or repair malformed ancestry.

## Title display

Append the depth text inside the current title block, after the existing conditional:

```svelte
<div class="concept-topbar-title">
	{#if editor.currentCanvasOwnerCard}
		{editor.currentCanvasOwnerCard.concept.title || editor.currentCanvasOwnerCard.concept.id}
	{:else}
		Context Name (Placeholder)
	{/if}
	· Canvas depth: {currentCanvasDepth}
</div>
```

Keep the root placeholder rather than changing unrelated naming. No CSS, model field, API call, or controller method is necessary. Breadcrumb buttons and navigation handlers remain untouched.

## Update path and ownership

```text
ConceptInstance.parentInstanceId
  → Editor.getInstanceBreadcrumb(ownerId)
  → Editor.currentBreadcrumb
  → currentCanvasDepth
  → topbar text
```

When navigation changes the owner, the breadcrumb and the local derived length recalculate. The number describes how far the owner is below root, not how many cards it contains. An empty child canvas can have depth greater than zero.

The camera sequence remains unchanged:

1. Save the outgoing nested owner's camera.
2. Await `prepareCanvasNavigation`, which clears interaction/selection/menu state, changes the owner, and awaits `tick()`.
3. Apply the target instance's saved camera, or follow root framing behavior when opening root.

`openRootCanvas()` also awaits preparation. Camera saves call `updateConceptInstanceRecord` directly without `invalidateAll()`; this display must not introduce a reload or replace that exception.

The existing zoom-default discrepancy also remains: normalization uses `0` for missing saved zoom, creation uses `1`, and `lastCameraZoom ?? 1` preserves zero. Adding depth is not authorization to alter defaults or persisted data.

## Verification and safety

Run `npm run check` from the project root with native WSL Node/npm. This checks the Svelte/TypeScript addition, not browser navigation.

Navigation away from a nested canvas persists camera fields in `src/lib/data/concept_instances.json`. Before browser checks, stop the app and make and verify an external backup of all four JSON files in `src/lib/data/`, or use an isolated disposable application copy with independent storage. Do not run automated mutation tests against live data.

On protected data:

- Root displays `Canvas depth: 0`.
- A root instance's child canvas displays `1`.
- Each deeper owner adds one; upward breadcrumb navigation reduces the value.
- Titles and breadcrumb controls remain visible and functional.
- Opening the current owner is still a no-op.
- Selection clears on context changes, nested camera restoration remains intact, and root still frames root content.

Use existing structure rather than creating test records. Avoid Grid and dragging unless their mutations are intentional. Report unperformed browser checks as unverified rather than inferring success from the checker.

## Reversal

Remove `currentCanvasDepth` and the appended `Canvas depth` text, then rerun `npm run check`. No model or API cleanup is needed. Removing the feature does not undo completed camera writes. If restoring data, stop the app, restore related files together, and do not overwrite desired post-backup edits.

## Summary

Canvas depth is a derived presentation of the existing containment breadcrumb. The topbar can display it without changing navigation sequencing, camera persistence, refresh policy, or model defaults.

# 10. Creation and title editing — exercise solution

[Chapter](../10-creation-and-title-editing.md) · [Integration](../13-integration.md)

The optional exercise adds an Editor composition command and one topbar button. It reuses the existing coordinate helper and `Editor.createConcept`; it does not modify title editing.

## Files changed by the exercise

- `src/lib/components/editor/Editor.svelte.ts`: add `createConceptAtViewportCenter`.
- `src/lib/components/editor/canvas/CanvasTopbar.svelte`: add one New Card button.

Do not change the client, route, service, repositories, model, loader, or title handlers.

## Add the Editor command

In `src/lib/components/editor/Editor.svelte.ts`, insert this method immediately above the existing `async createConcept(options: CreateConceptOptions = {})` method. Leave that existing method unchanged.

```ts
async createConceptAtViewportCenter() {
	const position = this.canvas.getViewportCenterWorldPoint();
	return this.createConcept({ position });
}
```

The method returns the existing creation promise and result. It does not import browser HTTP functions or reproduce camera arithmetic.

`Editor.createConcept` still supplies medium dimensions, current-canvas parentage, pending/active instance focus, and `invalidateAll()`. At root the default parent is `null`; inside a canvas it is the owner instance ID.

## Add one New Card button

In `src/lib/components/editor/canvas/CanvasTopbar.svelte`, add this inside `concept-topbar-actions`, before the grouped controls:

```svelte
<button type="button" onclick={() => editor.createConceptAtViewportCenter()}> New Card </button>
```

The component already obtains `editor` using `getEditorContext()`. Keep that code and all existing controls. The arrow callback preserves the method receiver. Do not add a second context lookup, component prop, button style, or direct HTTP call.

This is the chapter 10 implementation. Do not call `editor.canvas.createConceptAtViewportCenter()` yet: that method is introduced by the integration exercise.

## Execution path

1. The button calls `Editor.createConceptAtViewportCenter()`.
2. `CanvasController.getViewportCenterWorldPoint()` uses the canvas rectangle, pan, and zoom to return a world point.
3. `Editor.createConcept({ position })` applies defaults and calls `createConceptRecord`.
4. `POST /api/concepts` delegates to `createConceptWithInstance`.
5. The service creates separate Concept and instance IDs, links them, and saves Concepts followed by instances. This is not transactional storage.
6. The Editor records the returned instance ID for focus, then invalidates.
7. The loader reloads canonical records; `ConceptEditor.svelte` passes them into the stable Editor with `replaceData()` and `untrack()`.
8. Derived cards render the new occurrence. Its component focuses/selects the title input and clears pending focus.

The position is the card's top-left anchor. For a 1000 × 600 viewport, pan `(100, -50)`, and zoom `2`, the anchor is `(200, 175)`, not the world origin and not the card's geometric center.

## Title behavior remains unchanged

This solution adds no title-editing code. Keep these boundaries intact:

- `commitTitleEdit` trims and skips an exactly unchanged title.
- The default title request reports matching Concepts without writing data; conflict state exists, but no complete resolving chooser is rendered.
- `use-existing` reconnects the instance to the first matching Concept and its shared metadata.
- A nonempty title can name a blank Concept in place only when exactly one instance uses it and no earlier conflict/reuse branch returned.
- Otherwise a new Concept copies the previous properties/tags and the instance is reassigned; its ID, parentage, children, geometry, and camera remain stable.
- `create-duplicate` bypasses matching reuse/reporting, but does not bypass the blank-Concept exception.
- Title-input double Enter commits, then creates nearby even if the commit returned after reporting a conflict. Canvas double Enter remains a separate viewport-center path.

Do not add an editable ID, instance-local title, global rename, or uniqueness constraint.

## Verification and data safety

Run `npm run check`. Inspect the diff to confirm that only the command and button were added, with no title handler or persistence changes.

Before any manual creation, follow the chapter's exact [external backup and paired restore procedure](../10-creation-and-title-editing.md#safe-backup-and-restore-for-manual-checks). Stop all writers before copying or restoring, verify both files, and never restore over desired later edits. Creation writes both Concepts and instances; deleting the instance alone leaves its Concept behind. Keep the protected project archive unchanged.

With disposable data or that verified backup:

- Check root and nested creation, including the exact parent instance ID.
- Pan/zoom and check the visible-center anchor.
- Confirm title focus, browser request success, and persistence after reload.

No title mutation is needed to validate the button. Use isolated disposable records for title behavior checks; do not run mutation tests against live JSON. These instructions describe checks to perform, not checks already executed by writing the documentation.

## Continue or remove the exercise

Keep this implementation for [integration](../13-integration.md), where it is a required starting point. That exercise moves the method to `CanvasController`, updates this same button, removes the Editor wrapper, and shares the controller command with canvas double Enter. It does not add another button or change title-input creation.

To remove this exercise instead, delete only the new Editor method and New Card button, then rerun `npm run check`. Data rollback is independent: use the paired restore procedure only if no desired changes followed the backup. Do not revert unrelated edits or manually remove arbitrary IDs.

## Summary

The button delegates through context to a small Editor command. Existing APIs retain coordinate conversion, creation policy, persistence, refresh, and focus responsibilities. Title identity rules and both keyboard paths remain unchanged until the deliberate command-ownership revision in integration.

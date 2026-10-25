# Canvas: worked solution

[Canvas](../07-canvas.md) · [Trees and containment](../08-trees-and-containment.md)

## Scope

This optional implementation adds Reset View; it is not a description of an existing application control. It requires no other exercise changes.

Only these source files would change:

- `src/lib/components/editor/canvas/CanvasController.svelte.ts`
- `src/lib/components/editor/canvas/CanvasTopbar.svelte`

The controller owns the camera command. The topbar exposes it through the existing Editor context. Models, routes, clients, repositories, data, and canvas rendering need no edits.

## Controller command

Add this method to `CanvasController`, for example after its constructor:

```ts
resetView() {
	this.applyCamera({ panX: 0, panY: 0, zoom: 1 });
}
```

`applyCamera` already copies a complete camera into reactive fields. Reusing it keeps the command focused on its desired camera rather than repeating field assignments in the UI.

Do not call `saveCurrentCanvasCamera` or an Editor mutation here. The command changes only the live view; it must not change instance `x`, `y`, `width`, or `height`.

## Topbar control

`CanvasTopbar.svelte` already contains:

```ts
const editor = getEditorContext();
```

Add the new button inside the existing group labeled `Canvas navigation`, before Focus Selected. The group then contains:

```svelte
<div class="topbar-button-group" aria-label="Canvas navigation">
	<button type="button" onclick={() => editor.canvas.resetView()}>Reset View</button>
	<button type="button" onclick={() => editor.canvas.focusSelectionOrNearestCard()}>
		Focus Selected
	</button>
	<button type="button" onclick={() => editor.canvas.frameCardsInCurrentCanvas()}>
		Frame All
	</button>
	<button type="button" onclick={() => editor.canvas.arrangeCardsInCurrentCanvasInGrid()}>
		Grid
	</button>
</div>
```

No new import or prop is required. The arrow callback invokes the method on its controller, preserving `this`. Keep any unrelated controls already added to this group rather than replacing the entire group blindly.

## Resulting action path

1. The button calls `editor.canvas.resetView()`.
2. `resetView` delegates to `applyCamera`.
3. The reactive fields become `panX = 0`, `panY = 0`, and `zoom = 1`.
4. `ConceptCanvas.svelte` renders `translate(0px, 0px) scale(1)`.
5. The zoom indicator becomes `100%`.

The renderer already reads controller state, so it needs no edit. World coordinates are scaled before pan is added. Reset restores that mapping to its identity form; it does not center cards or pack them near the origin.

## Persistence and data safety

Reset itself performs no request. At root, camera saving returns without writing because there is no owner instance. In a nested canvas, navigating away after reset can persist `(0, 0, 1)` on that owner through the existing camera save. That save calls the instance client without `invalidateAll()`; do not replace it as part of this exercise.

Before navigation or drag tests, stop the app and make and verify an external backup of all four JSON files in `src/lib/data/`, or use an isolated disposable copy with independent data. Reaching root from a nested canvas may already save a camera. Do not run automated mutation tests against live storage.

## Verification

Run `npm run check` from the project root with native WSL Node/npm. On protected data:

1. Start at root; pan with the middle button and wheel-zoom away from `100%`.
2. Click Reset View and confirm origin pan and `100%`.
3. Confirm card world geometry did not change; cards may be offscreen if far from origin.
4. Confirm Frame All, Focus Selected, wheel zoom, and panning still operate.
5. Do not invoke Grid as a read-only check: it persists positions.

The proposed addition contains no mutation test. Browser verification and successful persistence must be reported separately from static checking.

## Reversal

Remove only `resetView()` and the new button, then rerun `npm run check`. Reloading discards unsaved camera state, not completed writes. If data restoration is necessary, stop the app first, restore related files together, and preserve desired changes made after the backup.

## Summary

Reset View is a controller camera command exposed by a context-consuming button. It reuses rendering and camera application, leaves instance geometry alone, and does not add a persistence path.

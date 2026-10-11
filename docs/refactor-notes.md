# Refactor notes

## Scope and execution order

This log records the structural refactor defined by `refactor-checklist.md`. Preserve behavior, persisted record shapes, IDs, API URLs, JSON filenames, and actual user data. Do not mix roadmap features into this pass.

Execution order:

1. Complete `refactor-checklist.md`.
2. Resume product work from `Updates-Ideas.md` using its owner-assigned priorities.

## Phase 0 baseline — 2026-10-08

### Git and data protection

- Refactor branch: `refactor/editor-architecture`.
- Starting commit: `e8d91f1` (`Make final edits before refactor.`).
- The branch was created without resetting the existing working tree.
- External data backup: `/home/cory/development/concept-editor-data-backup-2026-10-08`.
- The backup was created with `cp -a src/lib/data ...` and verified against `src/lib/data/` with `diff -qr`.
- Leave `src/lib/data-backup-do-not-delete-project-level-data.zip` untouched.
- Pre-existing working-tree items outside the refactor include `src.zip`, `src/app.css`, `.idea/`, `example_for_import.xlsx`, `screenshot.png`, and `website-screenshot.js`. Do not discard or absorb them incidentally.

### Automated baseline

`npm run check`:

```text
svelte-check found 0 errors and 19 warnings in 8 files
```

The warnings are the existing accessibility and unused-CSS warnings. They are not refactor regressions.

Before this branch, the first documented check reported two errors: an invalid `TitleConflictMode` import in `src/routes/api/concepts/+server.ts` and a missing required `onRelationshipConceptOpen` prop at the `ConceptSidebar` invocation. The owner authorized those focused fixes, and the follow-up baseline was 0 errors and 19 warnings. An unused `RelationshipDefinition` import in `src/routes/+page.server.ts` was separately recorded by editor diagnostics as a cleanup target.

`npm run build`:

```text
vite v8.1.3
196 modules transformed
client and server bundles built successfully
adapter-node completed successfully
```

The production build reports the same class of existing Svelte accessibility and unused-CSS warnings. This is the first recorded successful production build for this refactor baseline.

Zed's Windows-side language-server process separately reported a missing optional Windows Rollup package. The authoritative WSL/npm check and build both succeed; do not treat that host-environment diagnostic as a source failure.

### Source-inspected existing behavior

These behaviors are recorded from the live source and prior owner verification. They have not all been exercised manually during this phase.

- Double-clicking the canvas creates a Concept and ConceptInstance at the pointer position.
- Double Enter creates a Concept, including the title-input focus flow.
- Card title editing uses `updateConceptTitleFromInstance` and can report a title conflict, reconnect the instance to an existing Concept, or create a distinct Concept. It must not rename an already named shared Concept as an incidental instance-title edit.
- Cards support placement, resizing, single selection, additive/toggle selection, group dragging, and marquee selection.
- Child rows use an approximately 300 ms hold before starting a drag. Pointer-up/cancel clears the hold timer.
- Child drag/drop can reparent an instance. Drop detection depends on existing CSS classes plus `data-instance-id` and `data-concept-id` attributes.
- The card child area renders a recursive tree. Double-clicking blank child-area space can open the parent card; the handler ignores actual tree rows and toggles.
- The sidebar and card each render tree views, but only the card tree receives child-drag callbacks.
- Navigation saves the outgoing instance camera, clears interaction and selection state, waits for the destination view update, and restores a remembered incoming camera or frames content when no saved camera applies.
- Root navigation currently calls `prepareCanvasNavigation(null)` without awaiting it. Phase 9 intentionally restores the required sequencing.
- Camera persistence deliberately writes through the instance client without calling `invalidateAll()`.
- Successful Concept, instance, batch, deletion, and child-import mutations generally call `invalidateAll()` so the page loader supplies canonical replacement records.
- Concept properties and tags are shared by all instances referencing that Concept; geometry and camera state remain instance-specific.
- Manual tag entry ensures a tag Concept by title and then adds its Concept ID to the tagged Concept.
- Line-by-line paste import removes blank lines, skips case-insensitive duplicate titles within the pasted batch, and requires confirmation for more than 25 entries.
- Child import selects another occurrence of the same Concept and creates new immediate child instances at the destination. It skips Concept IDs already directly present there and does not recursively clone or synchronize subtrees.
- Sidebar resizing, frame-all, focus, and grid arrangement are implemented.

### Known unfinished features and recorded limitations

Keep these separate from refactor regressions:

- Table view is a placeholder.
- `openTagCanvas` is a logging stub.
- Tree rows do not yet provide the complete intended double-click/keyboard opening behavior.
- Title-conflict state and HTTP responses exist, but the confirmation dialog is not implemented.
- Interactive ConceptCard previews remain a major future feature, but the retired child-tile measurement/preview implementation is unused and can be removed.
- Relationship functionality is complete enough for the current phase; preserve it without adding deferred relationship features.
- Parent-instance deletion has no approved descendant policy. Do not introduce cascade deletion or reparenting during cleanup.
- Same-title Concept disambiguation and the complete title-choice UI remain product questions; do not impose identity by title.
- `ensureConceptByTitle` still selects the first case-insensitive title match and is not a complete duplicate-title chooser.
- Missing camera zoom defaults differ between normalization paths. Preserve and document the discrepancy rather than silently changing data semantics.

### Phase commit policy

The checklist asks for a commit after each phase. The branch began with pre-existing uncommitted and untracked owner files. Commit only refactor-owned paths when a phase has a safe, reviewable boundary; never stage unrelated working-tree changes merely to make the tree appear clean.

## Phase 1 — retired placeholders and implementation notes

The following empty or unused files represented intended features, not completed implementations. Their product intent remains in `Updates-Ideas.md` or this log after deleting the placeholders:

- `CanvasBreadcrumb.svelte`: navigation/breadcrumb presentation. Current navigation and breadcrumb behavior remain in the workspace implementation.
- `ImportChildrenMenu.svelte`: a dedicated child-import menu component. The working import menu remains implemented through `CanvasContextMenu.svelte`.
- `PropertyTable.svelte`, `TableRow.svelte`, and `TableView.svelte`: future tabular representation of Concept properties and tags. Table view remains a roadmap feature and current placeholder behavior must not be mistaken for implementation.
- `DuplicateConceptConfirmation.svelte`: the unfinished title-conflict chooser. Conflict state and HTTP responses remain; the intended confirmation UI is still unfinished.
- `conceptSearchQueries.ts`: future search/typeahead and Concept discovery. Search remains a meaningful product gap, not an abandoned idea.
- `relationshipDisplayQueries.ts`: a proposed display-query extraction. Existing relationship display behavior remains elsewhere and is complete enough for the current phase.
- `relationship-definitions/+server.ts`: an empty endpoint placeholder. Relationship definitions continue to load through the server-side page loader and repository.
- `src/stores/concepts.ts`: an abandoned empty global-store placeholder. The refactor uses one editor object scoped through Svelte context instead of creating a global Concept store.

The retired child-tile measurement, wrapping, overflow, and old preview implementation is removed. This does **not** retire interactive ConceptCard previews. The intended future feature is to hover a ConceptInstance representation, including a tree row, and inspect an interactive ConceptCard preview with its child tree and notes when available.

Ideas moved from `src/lib/user-settings/later.js` before deleting it:

- Allow a card-side image or watermark.
- Allow configurable background images.
- Allow Concept/card imagery.

These are retained as customization/media ideas only; they do not authorize schema or storage changes during this refactor.

Phase 1 automated validation:

```text
svelte-check found 0 errors and 19 warnings in 8 files
```

The warning count matches the Phase 0 baseline after deleting styles used only by the retired property-preview markup. Source inspection confirms the title-focus effect, 300 ms child-hold timer and cancellation, `.concept-drop-area`, `data-instance-id`, and active tree rendering remain. Interactive browser verification is deferred to the final regression pass; no mutation tests were run against live JSON data.

## Phase 2 — canonical models

Core model definitions now live only in `src/lib/model/`. The persisted shapes of Concept, ConceptInstance, ConceptCardView, ConceptRelationship, RelationshipDefinition, and TitleConflictMode are unchanged.

The pre-existing missing-camera-zoom defaults intentionally remain different:

- `normalizeConceptInstance()` defaults a missing `lastCameraZoom` to `0`.
- instance creation and editor-local normalization paths default a missing `lastCameraZoom` to `1`.

This discrepancy is recorded rather than resolved because changing it during file consolidation could change behavior or the interpretation of older records.

Phase 2 automated validation:

```text
svelte-check found 0 errors and 19 warnings in 8 files
```

Search confirms that `Concept`, `ConceptInstance`, and `ConceptCardView` each have one declaration and source imports no longer reference `$lib/types`, `$lib/concepts`, or the old relationship-query path. The production build succeeds and loads all four JSON collections. SHA-256 hashes for all four live JSON files were identical before and after the build, confirming that validation did not mutate them. Runtime mutation-based save verification remains deferred to protect the live JSON data.

## Phase 3 — editor component grouping

The workspace-sized `ConceptCanvas.svelte` is now named `ConceptEditor.svelte`, and editor-only canvas, card, tree, sidebar, and support components are grouped under `src/lib/components/editor/`. No state or behavior was extracted in this phase, and the future rendering-only `canvas/ConceptCanvas.svelte` has not been created yet.

The post-move audit caught that `TreeViewNode.svelte` had not arrived at its destination even though an earlier delegated check reported success. The exact committed file was restored under `components/editor/tree/`, the obsolete copy was removed, and the authoritative WSL check was rerun.

Phase 3 automated validation:

```text
svelte-check found 0 errors and 19 warnings in 8 files
```

Search confirms no source imports reference `$lib/components/ConceptCanvas`, the old component subdirectories, or `$lib/canvas`. Manual browser behavior verification remains deferred to the final regression pass.

## Phase 4 — explicit server boundary

Repositories now live under `src/lib/server/repositories/`, and coordinated Concept/instance rules live in `src/lib/server/conceptService.ts`. This uses SvelteKit's enforced server-only boundary without changing repository behavior, title-conflict rules, API URLs, or JSON destinations.

`src/routes/+page.server.ts` now loads Concepts and ConceptInstances through their repositories instead of duplicating file reads and normalization. It continues to return `concepts`, `instances`, `cards`, `relationships`, and `relationshipDefinitions` until card derivation moves to the editor in Phase 7.

Phase 4 automated validation:

```text
svelte-check found 0 errors and 19 warnings in 8 files
npm run build completed successfully
```

All four live JSON hashes were unchanged before and after validation. Repository path inspection confirms writes still target the original files under `src/lib/data/`. Creation, title editing, deletion, and child-import mutation flows were not executed against live data and remain part of the final manual regression pass.

## Phase 5 — consolidated browser requests

`ConceptEditor.svelte` no longer contains endpoint URLs or direct API `fetch()` calls. Its operations call the typed modules in `src/lib/client/`, while each operation still decides whether and when to call `invalidateAll()`.

The camera-save exception remains explicit: `saveCurrentCanvasCamera()` calls `updateConceptInstanceRecord()` directly and does not invalidate page data. Converted operations catch throwing client errors, retain their existing log/return behavior, and do not continue into success-only refresh or menu-closing steps after failure. Title-conflict responses remain a typed special result rather than a generic failed save.

The three clients now share only the small `getErrorMessage()` parser in `src/lib/client/http.ts`; no generic request-management layer was introduced.

Phase 5 automated validation:

```text
svelte-check found 0 errors and 19 warnings in 8 files
npm run build completed successfully
```

Search confirms there are no direct `fetch('/api/...')` calls or `requestJson` references under `src/lib/components/editor/`. Runtime mutation/refresh verification remains deferred to the final protected-data regression pass.

## Phase 6 — pure calculations and editor types

Card rectangle/center/bounds calculations now live in `canvas/geometry.ts`. Packing, size presets, imported-card sizing, and nearby-position calculations now live in `canvas/layout.ts`. The layout module receives viewport dimensions explicitly and has no DOM, rune, component, or editor-state dependencies.

Workspace/menu types now live in `EditorTypes.ts`, while camera and pointer-interaction types remain in `CanvasTypes.ts`. All scoring formulas, gaps, presets, random offsets, and positioning calculations were preserved during extraction.

Phase 6 automated validation:

```text
svelte-check found 0 errors and 19 warnings in 8 files
npm run build completed successfully
```

Manual verification of frame-all, focus, grid arrangement, imported-card sizing, and new-card positioning remains part of the final browser regression pass.

## Phase 7 — canonical records and derived cards

The page loader now returns only Concepts, ConceptInstances, relationships, and relationship definitions. `ConceptEditor.svelte` stores those four canonical collections and derives card views by joining each instance to its Concept by ID. The derived cards reuse the canonical objects and continue to omit instances whose Concept is missing.

The four collections initialize synchronously from page data so server rendering includes the loaded cards. A narrowly scoped effect then replaces only those collections when `invalidateAll()` supplies new page data. Selection, navigation, camera, context-menu, and import-menu state are not reset by that bridge.

Loaded records now use the shared model normalizers. As recorded in Phase 2, a missing instance zoom therefore receives the shared normalizer's existing `0` default; no persisted record shape changed.

Phase 7 automated validation:

```text
svelte-check found 0 errors and 19 warnings in 8 files
npm run build completed successfully
```

An audit confirms keyed rendering still uses `card.instance.id`, multiple instances share one canonical Concept object, and each instance retains its own canonical geometry/camera object. Browser verification of shared metadata updates, independent instance geometry, and refresh preservation remains deferred to the final regression pass.

## Phase 8 — editor object and context

A single rune-backed `Editor` instance now owns the four loaded record collections, editor selection/navigation/sidebar/menu state, derived card views, record queries, mutation commands, and menu operations. `ConceptEditor.svelte` creates that instance once, provides it through Svelte's typed `createContext<Editor>()` API, and retains only interaction and component-local state scheduled for later phases.

The incoming-data effect reads only the four page-data collections as dependencies and invokes `editor.replaceData()` inside `untrack`. Replacement normalizes and updates only canonical records; it does not reconstruct the editor or reset selection, navigation, camera, or menus. Class methods passed as callbacks remain wrapped so they retain their `this` receiver.

Review restored the existing collection semantics after the initial extraction: selection remains an ordinary `Set` replaced on updates, and the derived lookup tables remain ordinary `Map` values. Reactive Svelte collection types were not introduced where replacement/derivation already provides reactivity.

Phase 8 automated validation:

```text
svelte-check found 0 errors and 19 warnings in 8 files
npm run build completed successfully
```

Static audit confirms all listed state, derived values, queries, commands, and menu operations moved exactly once, `openTagCanvas` remains a stub, constructors contain no DOM/listener/timer setup, and existing child-component props remain until Phase 10. Browser mutation verification of creation, editing, tags, properties, deletion, menus, and refresh behavior remains deferred to the final protected-data regression pass.

## Phase 9 — canvas controller and navigation ownership

Canvas camera, pointer, drag, resize, marquee, clipboard, keyboard, layout-animation, and short-lived interaction state now live in one rune-backed `CanvasController`. `Editor` constructs the controller once and owns selection and navigation commands. Both constructors remain free of DOM access, listener registration, and timer startup.

`ConceptEditor.svelte` now contains only workspace composition, incoming-data replacement, sidebar resizing, and the browser event bindings required to connect the component to the controller. It retains one `<svelte:window>` and binds the canvas element directly to `editor.canvas.canvasElement`. The controller continues to use the established `.concept-tags-preview`, `.concept-card`, `.concept-drop-area`, `data-card-instance-id`, and `data-instance-id` drop interfaces.

Navigation still saves the outgoing camera without invalidating page data, clears interaction and selection state, waits for the destination render, and applies the incoming camera. Root navigation now awaits `prepareCanvasNavigation(null)` before inspecting and framing root cards, correcting the sequencing issue recorded in the baseline.

During review, the first extraction introduced one new Svelte warning by reading initial `data` outside `untrack`; initialization was restored to `untrack(() => new Editor(data))`, returning validation to the baseline warning count. A stale editor-tool snapshot briefly restored the old component during that correction; the Phase 9 integration was reapplied and fully revalidated before commit.

Phase 9 automated validation:

```text
svelte-check found 0 errors and 19 warnings in 8 files
npm run build completed successfully
```

Source audit confirms controller state and methods are not duplicated in `ConceptEditor.svelte`, selection still uses replacement semantics, camera writes still bypass `invalidateAll()`, and root navigation awaits its state transition. Browser verification of zoom, pan, dragging, resizing, marquee, drops, navigation, title editing, double-Enter, and paste confirmation remains deferred to the final regression pass.

## Phase 10 — context-based component operations

Editor descendants now retrieve the scoped editor through `getEditorContext()` instead of receiving shared queries, state, and operation callbacks through multiple component layers. `ConceptEditor.svelte` now invokes the topbar, sidebar, context menu, and each card without forwarding editor operations.

`ConceptCard` retains only its card identity prop. Card title focus, the title input element, and the 300 ms child-hold timer remain local; timer cancellation now also runs when the component is destroyed. `ConceptDropArea` and both tree components query hierarchy through context while preserving explicit optional child-pointer callbacks. The card tree still receives drag callbacks, and the sidebar tree still does not.

The sidebar now owns its tag draft and submission helper alongside its existing property drafts. Relationship display receives a bound lookup wrapper that converts the editor query's `null` result to the query helper's expected `undefined`. Topbar and context-menu operations call the editor/controller directly while retaining existing event propagation and menu-close sequencing. Straightforward presentation components continue to use props.

Phase 10 automated validation:

```text
svelte-check found 0 errors and 19 warnings in 8 files
npm run build completed successfully
```

Static review confirms the removed shared-operation props have no remaining callers, `openCardCanvas` is deleted, tree expansion remains component-local, and the unfinished tree-row opening behavior was not enabled. Browser verification of independent component drafts/expansion and separate card/sidebar tree behavior remains deferred to the final regression pass.

## Phase 11 — spatial rendering component

`canvas/ConceptCanvas.svelte` now renders the child-drag ghost, canvas background, marquee selection box, transformed canvas world, keyed card loop, and zoom indicator. It retrieves the scoped editor directly and preserves the existing classes, event handlers, transform expression, and card instance keys.

`ConceptEditor.svelte` remains the workspace composer. It still owns sidebar resizing and retains the measured viewport element with `bind:this={editor.canvas.canvasElement}`, plus the topbar, sidebar shell, table placeholder, paste confirmation, and context menu. This keeps coordinate measurement on the same DOM element as before extraction.

Scoped styles moved with the spatial markup they target. Workspace, sidebar shell/resize handle, viewport, and table-placeholder styles remain in the parent component.

Phase 11 automated validation:

```text
svelte-check found 0 errors and 19 warnings in 9 files
npm run build completed successfully
```

The warning total matches the baseline; the warning file count increased because moved canvas accessibility/CSS diagnostics are now attributed to `ConceptCanvas.svelte` while a workspace-only unused selector remains in `ConceptEditor.svelte`. Browser verification of viewport sizing, positions, transforms, drag ghosts, selection placement, sidebar resizing, and view switching remains deferred to the final regression pass.

## Phase 12 — naming cleanup

The checklist's limited naming pass is complete. Editor queries now use `getChildCards`, `getRootCards`, and `getCard`; editor commands use `addTag`, `removeTag`, `setProperties`, and `openParentCanvas`. The layout helper is now `getNearbyCardPosition`, and its caller uses `nextPosition`.

Child interaction symbols now describe child dragging rather than the retired tile implementation: `ChildDragState`, `childDragState`, `startChildDrag`, `emptyChildDragState`, `handleChildDragPointerMove`, and `finishChildDrag`. Existing `child-tile-*` CSS classes and DOM interaction selectors remain unchanged because they are behavioral/styling interfaces, not part of this symbol cleanup.

Phase 12 automated validation:

```text
svelte-check found 0 errors and 19 warnings in 9 files
npm run build completed successfully
```

A source-wide search found no remaining references to any renamed symbol. No unlisted naming cleanup was performed.

## Phase 13 — final audit

### Ownership map

| Area | Authoritative location |
| --- | --- |
| Loaded records, derived cards, hierarchy queries, selection, navigation, editor commands, and menus | `src/lib/components/editor/Editor.svelte.ts` |
| Camera, pointer/drag/resize/marquee interaction, canvas keyboard behavior, paste placement, framing, and arrangement | `src/lib/components/editor/canvas/CanvasController.svelte.ts` |
| Workspace composition, incoming-data bridge, viewport binding, and sidebar resizing | `src/lib/components/editor/ConceptEditor.svelte` |
| Spatial canvas markup and its scoped styles | `src/lib/components/editor/canvas/ConceptCanvas.svelte` |
| Card-local title focus and child-hold timer | `src/lib/components/editor/card/ConceptCard.svelte` |
| Tree expansion and sidebar property/tag drafts | Tree/sidebar components under `src/lib/components/editor/` |
| Canonical persisted model types and normalizers | `src/lib/model/` |
| Browser endpoint calls and response parsing | `src/lib/client/` |
| Persistence repositories and coordinated server rules | `src/lib/server/` |
| HTTP handlers and page loading | `src/routes/` |

### Audit results

- No imports remain from the old type, concept, canvas, query, repository, service, or workspace-component paths.
- No editor component directly calls an `/api` endpoint.
- `Concept`, `ConceptInstance`, and `ConceptCardView` each have one canonical declaration.
- Cards and the current card are derived rather than maintained as writable synchronized copies.
- Class methods passed as callbacks are wrapped, and neither controller is a module-global singleton.
- Constructors perform no DOM access, listener registration, or timer startup. Browser globals occur only inside runtime interaction methods.
- Endpoint URLs remain in `src/lib/client/`; JSON paths remain in `src/lib/server/repositories/` and still target the four original files.
- Camera persistence still calls the instance client without `invalidateAll()`; record mutations retain the existing reload path.
- The four live JSON files exactly match the external backup at `/home/cory/development/concept-editor-data-backup-2026-10-08`.
- Obsolete empty directories left by file moves were removed.

### Remaining bugs and unfinished product work

These are not refactoring leftovers:

- Interactive ConceptCard previews remain a major future feature. The intended behavior is to hover a ConceptInstance representation, including a tree row, and inspect an interactive card preview with its tree and notes when available.
- Table view, search/discovery, complete title-conflict choice UI, complete tree-row opening, and tag-canvas navigation remain unfinished roadmap work.
- Parent deletion semantics, same-title disambiguation details, and the missing-camera-zoom default discrepancy remain unresolved as previously recorded.
- Relationship behavior is complete enough for this phase; deferred relationship features remain roadmap work.
- The existing 19 accessibility/CSS warnings remain. Their distribution is now 9 files because canvas markup moved into its own component.

### Final verification status

The final static type check and production build succeeded. No mutation tests were run against live JSON data. The checklist's browser interaction checkpoints remain open for manual verification: creation, title conflicts, shared metadata, drag/drop, navigation/camera restoration, arrangement, paste/child import, sidebar/tree behavior, persistence after reload, and browser-console/request errors.

This structural refactoring pass stops here. Further subdivisions, behavior changes, data-model changes, and roadmap features should wait until the refactored editor has been used and the pending browser checks have been completed.

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

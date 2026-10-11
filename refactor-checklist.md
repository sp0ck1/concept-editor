This checklist is the current highest-priority execution plan. Complete it before resuming product work from `Updates-Ideas.md`. Completing the refactor does not reorder or authorize that product backlog.

Work through these phases in order. Complete each checkpoint before starting the next phase. Keep existing function names during extraction; apply the naming cleanup near the end.

All paths below are relative to the project root. This plan was source-reviewed against the live checkout on 2026-09-19. The initial `npm run check` reported 2 errors and 19 warnings in 9 files; after two owner-authorized focused fixes, it reported 0 errors and 19 warnings in 8 files. On 2026-10-08, the refactor baseline again reported 0 errors and 19 warnings in 8 files, and the production build completed successfully. Runtime behavior still requires manual verification.

## 0. Establish a baseline

* [x] Create a refactoring branch.
* [x] Back up `src/lib/data/` outside the project.
* [x] Leave `src/lib/data-backup-do-not-delete-project-level-data.zip` untouched.
* [x] Run the project’s existing type-check and build commands. Record existing errors before making changes.
* [x] Record the current `npm run check` baseline before fixing it: the invalid `TitleConflictMode` import in `src/routes/api/concepts/+server.ts`, the missing required `onRelationshipConceptOpen` prop at the `ConceptSidebar` invocation, and 19 warnings in 9 files.
* [x] Record the additional editor diagnostic for the unused `RelationshipDefinition` import in `src/routes/+page.server.ts`.
* [x] Create `docs/refactor-notes.md`.
* [x] Record existing behavior for creating, renaming, dragging, resizing, reparenting, selecting, navigating, editing properties, adding tags, and importing children.
* [x] Record unfinished features separately: the table placeholder, tag navigation stub, missing tree-row opening behavior, and missing title-conflict dialog.
* [x] Keep API URLs, stored IDs, JSON filenames, and JSON record shapes unchanged throughout this refactor.
* [ ] Commit after each completed phase.

## 1. Remove inactive code

### Delete empty files

* [x] Delete the following files after confirming that they are still empty and have no required references in your working copy:

```text
src/stores/concepts.ts

src/lib/components/canvas/CanvasBreadcrumb.svelte
src/lib/components/canvas/ImportChildrenMenu.svelte
src/lib/components/canvas/PropertyTable.svelte

src/lib/components/dialogs/DuplicateConceptConfirmation.svelte

src/lib/components/table/TableRow.svelte
src/lib/components/table/TableView.svelte

src/lib/queries/conceptSearchQueries.ts
src/lib/queries/relationshipDisplayQueries.ts

src/routes/api/relationship-definitions/+server.ts
```

* [x] Record the intended features from those placeholders in `docs/refactor-notes.md`.
* [x] Delete directories left empty by these deletions.
* [x] Move the comments from `src/lib/user-settings/later.js` into `docs/refactor-notes.md`, then delete that file.

### Remove the retired child-tile layout

The old tile measurement and preview implementation is retired, but interactive ConceptCard previews remain a major future feature. Delete only the unused implementation; preserve the requirement that hovering a ConceptInstance representation can eventually reveal an interactive card preview with its tree and notes.

* [x] Delete `src/lib/components/card/ConceptChildTile.svelte` after confirming that nothing imports it.

* [x] Delete `src/lib/components/ConceptPropertiesPreview.svelte` after confirming that nothing imports it.

* [x] Delete these functions from `src/lib/components/card/ConceptCard.svelte`:

```text
buildChildTileLayout
makeRowAwareChildTiles
buildOverflowChildTileLayout
makeChildTile
makeOverflowTile
getChildTileTitle
getChildTileSymbol
getPreferredChildTileWidth
getRowAwareChildTileWidth
getOverflowTileWidth
measureTextWidth
doesTileLayoutFit
getWrappedTileHeight
showChildPreview
hideChildPreview
getRenderedCardWidth
```

* [x] Delete the declarations used exclusively by that retired code:

```text
childTileFontFamily
childTileModes

ChildTileModeName
ChildTileModeConfig
ChildTileLayoutTile
ChildTileLayout

dropAreaWidth
dropAreaHeight
textMeasureCanvas
textWidthCache
childTileLayout

previewChildCard
previewX
previewY
previewPlacement

currentCardLayout
```

* [x] Delete the `ResizeObserver` effect that measures the drop area.
* [x] Delete the `{#if previewChildCard}` markup and its component-local preview styles.
* [x] Remove the `conceptChildren`, `onChildOpen`, `onOverflowOpen`, and `onPropertiesChange` props from `ConceptCard.svelte`.
* [x] Remove those four attributes from the `<ConceptCard>` invocation in `src/lib/components/ConceptCanvas.svelte`.
* [x] Remove `dropAreaElement` and `bind:dropAreaElement` from `ConceptCard.svelte`.
* [x] Remove the corresponding `$bindable` prop and `bind:this={dropAreaElement}` from `ConceptDropArea.svelte`, after confirming that nothing else uses that element reference.

**Keep the active child-drag implementation:**

* [x] Keep `handleChildTilePointerDown`, `cancelChildTileHold`, `childTileHoldDelayMs`, `childTileHoldTimer`, and `pendingChildDragCard`.
* [x] Keep the title-input focus effect.
* [x] Keep the `.concept-drop-area` class and its `data-instance-id` attribute.

### Remove other leftovers

* [x] Delete `nextZIndex` from `src/lib/components/ConceptCanvas.svelte`.
* [x] Delete the unused `TreeView` import from `src/lib/components/tree/TreeViewNode.svelte`.
* [x] Remove the unused `onRelationshipConceptOpen` prop from `src/lib/components/sidebar/ConceptSidebar.svelte`.
* [x] Delete the unused `RelationshipDefinition` type import from `src/routes/+page.server.ts`.
* [x] Make the sidebar’s root-only `"Untitled Context"` input read-only.
* [x] Remove that root-only input’s `onTitleKeydown` and `onTitleBlur` calls, which currently lack a card argument.

**Checkpoint**

* [ ] Verify card rendering, child-tree expansion, title focusing, and the 300 ms child-drag hold.
* [ ] Verify that the cleanup did not remove any working interaction.

## 2. Establish one definition of each model

* [x] Rename `src/lib/types/` to `src/lib/model/`.
* [x] Keep these model files separate:

```text
src/lib/model/Concept.ts
src/lib/model/ConceptInstance.ts
src/lib/model/ConceptCardView.ts
src/lib/model/ConceptRelationship.ts
src/lib/model/RelationshipDefinition.ts
src/lib/model/TitleConflictMode.ts
```

* [x] Move `src/lib/concepts/normalizeConcept.ts` to `src/lib/model/normalizeConcept.ts`.

* [x] Move `src/lib/concepts/normalizeConceptInstance.ts` to `src/lib/model/normalizeConceptInstance.ts`.

* [x] Move and rename `src/lib/queries/conceptRelationshipQueries.ts` to `src/lib/model/relationshipQueries.ts`.

* [x] Delete the duplicate `Concept`, `ConceptInstance`, and `ConceptCardView` definitions from `src/lib/canvas/types.ts`.

* [x] Import the canonical model types into `src/lib/canvas/types.ts` where its remaining declarations require them.

* [x] Change consumers that import model types from `$lib/canvas/types` to import them directly from `$lib/model/Concept`, `$lib/model/ConceptInstance`, or `$lib/model/ConceptCardView`.

* [x] Update all remaining `$lib/types`, `$lib/concepts`, and relationship-query imports.

* [x] Change `src/routes/api/concepts/+server.ts` to import `TitleConflictMode` directly from `$lib/model/TitleConflictMode`, rather than from `conceptService`.

* [x] Delete the old `concepts/` and `queries/` directories once empty.

* [x] Keep the existing model shapes unchanged.

* [x] Record the differing missing-camera-zoom defaults in `docs/refactor-notes.md`. Do not silently change normalization defaults while moving files.

**Checkpoint**

* [x] Search for `type Concept`, `type ConceptInstance`, and `type ConceptCardView`.
* [x] Verify that each core model has one definition.
* [ ] Verify loading and saving without changing the stored data format.

## 3. Put the editor implementation together

* [x] Create `src/lib/components/editor/`.

* [x] Move and rename `src/lib/components/ConceptCanvas.svelte` to `src/lib/components/editor/ConceptEditor.svelte`.

* [x] Update `src/routes/+page.svelte` to import and render `ConceptEditor`.

* [x] Move these directories:

| From                          | To                                   |
| ----------------------------- | ------------------------------------ |
| `src/lib/components/canvas/`  | `src/lib/components/editor/canvas/`  |
| `src/lib/components/card/`    | `src/lib/components/editor/card/`    |
| `src/lib/components/sidebar/` | `src/lib/components/editor/sidebar/` |
| `src/lib/components/tree/`    | `src/lib/components/editor/tree/`    |

* [x] Move `src/lib/components/ConceptTagsPreview.svelte` to `src/lib/components/editor/ConceptTagsPreview.svelte`.

* [x] Move `src/lib/canvas/geometry.ts` to `src/lib/components/editor/canvas/geometry.ts`.

* [x] Move and rename `src/lib/canvas/types.ts` to `src/lib/components/editor/canvas/CanvasTypes.ts`.

* [x] Update imports and delete the old `src/lib/canvas/` directory.

* [x] Keep all existing workspace markup and behavior in `ConceptEditor.svelte` for now.

* [x] Do not create the replacement `ConceptCanvas.svelte` yet.

**Checkpoint**

* [ ] Verify that the application behaves exactly as it did before these moves.
* [x] Resolve broken imports before extracting any state or behavior.

## 4. Make the server boundary explicit

* [x] Create `src/lib/server/`.
* [x] Move `src/lib/repositories/` to `src/lib/server/repositories/`.
* [x] Move `src/lib/services/conceptService.ts` to `src/lib/server/conceptService.ts`.
* [x] Update repository and service imports in the API routes and page loader.
* [x] Delete the old `src/lib/services/` directory once empty.

SvelteKit enforces `$lib/server` as a server-only boundary. Keep browser components and client request modules from importing its runtime code. ([Svelte][1])

* [x] Keep the repository data paths pointing to the existing `src/lib/data/*.json` files.
* [x] Keep the existing title-conflict rules in `conceptService.ts`.

### Remove duplicate loading logic

* [x] Import `getAllConcepts` and `getAllConceptInstances` into `src/routes/+page.server.ts`.
* [x] Replace its direct concept and instance file reads with those repository functions.
* [x] Delete the loader’s now-unused `readFile`, `path`, and normalization imports.
* [x] Keep its current returned fields, including `cards`, until Phase 7.

**Checkpoint**

* [x] Verify page loading.
* [ ] Verify concept creation, title editing, instance deletion, and child importing.
* [x] Confirm that writes still reach the original JSON files.

## 5. Finish consolidating HTTP requests

Use `src/lib/client/` for endpoint URLs and HTTP request details. Keep refresh decisions in the calling operation.

The existing editor depends on successful mutations triggering a reload and its incoming-data effect receiving the replacement records. Preserve that connection during this phase.  

* [x] Replace the HTTP implementations inside `src/lib/components/editor/ConceptEditor.svelte` as follows:

| Existing function          | Call this existing client function  |
| -------------------------- | ----------------------------------- |
| `updateConcept`            | `updateConceptRecord`               |
| `updateInstance`           | `updateConceptInstanceRecord`       |
| `updateInstancesBatch`     | `updateConceptInstancesBatch`       |
| `deleteInstance`           | `deleteConceptInstanceRecord`       |
| `handleManualTagAdd`       | `ensureConceptByTitle`              |
| `importChildrenFromSource` | `importChildrenFromConceptInstance` |

* [x] Keep `invalidateAll()` after successful concept updates, instance updates, batch updates, and deletion.

* [x] Keep the empty-batch early return in `updateInstancesBatch`.

* [x] Keep the existing tag-concept insertion and tagging steps after `ensureConceptByTitle`.

* [x] Keep menu closing and refreshing after successful child importing.

* [x] Keep title changes routed through `updateConceptTitleFromInstanceRecord`.

* [x] Keep the special `title-conflict` result handling rather than treating HTTP 409 as an ordinary failed save.

* [x] Narrow `updateConcept`’s update type to exclude `title`, matching `updateConceptRecord`.

* [x] Add `try/catch` where replacing an old `!response.ok` branch with a throwing client helper would otherwise introduce an unhandled rejection.

* [x] Preserve the operation’s existing failure return and logging.

* [x] Do not add a new generic request-management layer.

**Preserve the camera exception:**

* [x] Keep `saveCurrentCanvasCamera` calling `updateConceptInstanceRecord` without invalidating the page.
* [x] Do not replace that call with the editor’s refresh-producing `updateInstance` wrapper.

### Consolidate the repeated error parser

* [x] Create `src/lib/client/http.ts`.
* [x] Move one existing `getErrorMessage` implementation into it and export it.
* [x] Import it into `concepts.ts`, `conceptInstances.ts`, and `conceptRelationships.ts`.
* [x] Delete the three local duplicate implementations.
* [x] Delete `requestJson` from `ConceptEditor.svelte` once all its callers have been replaced.

**Checkpoint**

* [ ] Verify each mutation and its refresh behavior.
* [x] Verify that camera saving does not reload the page.
* [x] Verify that failed requests do not continue into success-only refresh steps.

## 6. Extract calculations and organize editor-specific types

### Extract geometry

* [x] Move these functions from `src/lib/components/editor/ConceptEditor.svelte` to `src/lib/components/editor/canvas/geometry.ts` and export them:

```text
getCardCenter
getCardsWorldBounds
getCardWorldRect
```

* [x] Replace the local `WorldBounds` type with the existing `Rectangle` type from `geometry.ts`.
* [x] Delete the local `WorldBounds` declaration.

### Extract layout calculations

* [x] Create `src/lib/components/editor/canvas/layout.ts`.
* [x] Move these functions from `ConceptEditor.svelte` into it:

```text
packCardsIntoColumns
chooseBestPackedLayout
getTitleSizedConceptWidth
getImportedConceptSize
getNextConceptPositionAfterCard
```

* [x] Move `PackedCardPlacement` and `PackedLayout` into `layout.ts`.
* [x] Move `conceptSizePresets` and `ConceptSizePreset` from `CanvasTypes.ts` into `layout.ts`.
* [x] Add a `viewportSize: { width: number; height: number }` argument to `chooseBestPackedLayout`.
* [x] Replace its internal `getViewportWorldSize()` call with that argument.
* [x] Pass `getViewportWorldSize()` from the existing caller.
* [x] Keep the layout scoring, gaps, size presets, and positioning calculations unchanged.

### Separate editor types from canvas interaction types

* [x] Create `src/lib/components/editor/EditorTypes.ts`.
* [x] Move these declarations from `canvas/CanvasTypes.ts` into it:

```text
CreateConceptOptions
MainView
SidebarTab
ContextMenuTarget
ContextMenu
```

* [x] Import `ConceptSizePreset` from `canvas/layout.ts` where `CreateConceptOptions` requires it.
* [x] Move `TitleConflictState` from `ConceptEditor.svelte` into `EditorTypes.ts`.
* [x] Move `CanvasCamera` from `ConceptEditor.svelte` into `canvas/CanvasTypes.ts`.
* [x] Keep drag, pending-drag, resize, child-drag, and selection-box types in `CanvasTypes.ts`.

**Checkpoint**

* [ ] Verify frame-all, focus, grid arrangement, imported-card sizing, and new-card positioning.
* [x] Confirm that the extracted layout module does not read component-local state or DOM elements.

## 7. Store concepts and instances once

Complete this phase before moving the data into a class.

### Simplify the page-to-editor interface

* [x] Add an `EditorData` type to `src/lib/components/editor/EditorTypes.ts` with these fields:

```ts
concepts: Concept[];
instances: ConceptInstance[];
relationships: ConceptRelationship[];
relationshipDefinitions: RelationshipDefinition[];
```

* [x] Remove the `cards` construction from `src/routes/+page.server.ts`.
* [x] Return the four collections above.
* [x] Replace the handwritten page-data type in `src/routes/+page.svelte` with the generated `PageData` type from `./$types`.
* [x] Replace the four `initial...` props with:

```svelte
<ConceptEditor {data} />
```

* [x] Change `ConceptEditor.svelte` to accept `data: EditorData`.

### Make cards derived views

* [x] Add reactive `instances` and `relationshipDefinitions` collections to `ConceptEditor.svelte`.
* [x] Keep `concepts`, `instances`, `relationships`, and `relationshipDefinitions` as the loaded record collections.
* [x] Replace writable `cards` state with a `$derived` collection joining instances to concepts by `conceptId`.
* [x] Reuse the canonical concept and instance objects inside each card.
* [x] Do not spread or clone each concept while constructing cards.
* [x] Preserve the loader’s existing behavior of omitting cards whose concept cannot be found.
* [x] Keep the keyed card rendering based on `card.instance.id`.

Keep the join derived rather than synchronizing another writable collection through an effect. `$derived` can track the reactive records read while constructing the view. ([Svelte][2])

### Consolidate incoming-data handling

* [x] Replace references to `initialCards`, `initialConcepts`, `initialRelationships`, and `initialRelationshipDefinitions`.
* [x] Update all four record collections when replacement page data arrives.
* [x] Use the normalizers in `src/lib/model/`.
* [x] Delete local `normalizeConcept`, `normalizeInstance`, and `normalizeCard` from `ConceptEditor.svelte`.
* [x] Keep selection, navigation, camera, and open menus out of the incoming-data reset.

**Checkpoint**

* [ ] Verify editing a concept that has multiple instances.
* [ ] Verify that all its visible instances show the same properties and tags.
* [ ] Verify that moving or resizing one instance does not move or resize its siblings.
* [ ] Verify that an API refresh replaces records without resetting the current location.

## 8. Create the editor object and context

### Create the data owner

* [x] Create `src/lib/components/editor/Editor.svelte.ts`.
* [x] Export an `Editor` class.
* [x] Move the following state from `ConceptEditor.svelte` into the class:

```text
concepts
instances
relationships
relationshipDefinitions

activeInstanceId
pendingFocusInstanceId
currentCanvasOwnerInstanceId
selectedInstanceIds

sidebarVisible
sidebarTab
mainView

titleConflict
contextMenu
importChildrenMenu
```

* [x] Preserve `$state` on fields that the UI observes.
* [x] Keep the existing set-replacement behavior for selection. Do not replace it with in-place mutation of an ordinary `Set`.

Svelte supports rune-backed class fields; a plain class instance does not automatically make all its properties reactive. ([Svelte][3])

* [x] Move these derived values into `Editor.svelte.ts`:

```text
cards
cardsByInstanceId
conceptsById
cardsInCurrentCanvas
currentBreadcrumb
currentCanvasOwnerCard
currentConceptRelationships
importChildrenOptions
```

* [x] Add `replaceData(data: EditorData)` to replace and normalize only the loaded record collections.
* [x] Initialize the editor from the incoming data.
* [x] Keep `replaceData` free of selection resets, camera resets, network calls, and DOM access.

### Move queries

* [x] Move these functions from `ConceptEditor.svelte` to `Editor.svelte.ts` as methods:

```text
getConceptChildren
getRootConceptInstances
getConceptById
getTagConcepts
getCardByInstanceId
getInstanceBreadcrumb
getImportChildrenOptions
getBreadcrumbLabel
isDescendantInstance
```

### Move commands and menu operations

* [x] Move these functions from `ConceptEditor.svelte` to `Editor.svelte.ts`:

```text
createConcept
updateConcept
updateInstance
updateInstancesBatch
deleteInstance

commitTitleEdit
updateConceptTitleFromInstance
handlePropertiesChange

setConceptTagConceptIds
tagConceptWithConcept
handleManualTagAdd
handleTagRemove
openTagCanvas

setMainView
createConceptFromMenu
deleteInstanceFromMenu
openImportChildrenMenu
closeImportChildrenMenu
closeContextMenu
importChildrenFromSource
```

* [x] Keep their existing parameter signatures for now.
* [x] Keep `openTagCanvas` as its current stub. Do not substitute a concept ID for an instance ID.
* [x] Replace references to moved fields and methods with `this.<name>` inside the class.
* [x] Replace references in `ConceptEditor.svelte` with `editor.<name>`.
* [x] Do not retain duplicate local `$state` variables as bridges.

### Provide the instance through context

* [x] Create `src/lib/components/editor/EditorContext.ts`.
* [x] Import `createContext` from `svelte` and the `Editor` type.
* [x] Export a typed getter/setter pair with `createContext<Editor>()`:

```ts
export const [getEditorContext, setEditorContext] = createContext<Editor>();
```

* [x] Do not add a manual context key or hand-written getter/setter wrapper.
* [x] Create one `Editor` instance in the instance script of `ConceptEditor.svelte`.
* [x] Call `setEditorContext(editor)` during component initialization.
* [x] Export the class, not a module-global editor singleton.
* [x] Keep the same editor object for the component’s lifetime.

Context provides that instance to descendants without forwarding it through props. Call context setup and retrieval during component initialization, not inside event handlers. ([Svelte][4])

### Preserve incoming-data updates

* [x] Keep an effect in `ConceptEditor.svelte` that reads the four incoming `data` collections.
* [x] Call `editor.replaceData(...)` from that effect.
* [x] Wrap the `replaceData` invocation in `untrack` so reads of editor-owned state do not become reload dependencies.
* [x] Keep the incoming-data reads outside `untrack`.
* [x] Do not reconstruct the editor when page data refreshes.

Effects track synchronous reactive reads, including reads inside called functions. Keep this existing reload bridge narrowly dependent on incoming page data. ([Svelte][5])

### Preserve method binding

* [x] Wrap class methods when passing them as callbacks:

```svelte
onGoToCanvas={(id) => editor.openInstanceCanvas(id)}
```

* [x] Apply the same rule to callbacks passed into ordinary functions, not just Svelte events.

Passing a method without its owning object can lose its `this` binding. ([Svelte][3])

**Checkpoint**

* [ ] Verify queries, creation, editing, tags, properties, deletion, and menu operations.
* [x] Verify that refreshing records does not replace the editor instance.
* [x] Keep the existing component props until their replacements are completed in Phase 10.

## 9. Extract canvas interaction and finish navigation ownership

Complete this phase as one connected extraction. The canvas controller and editor navigation methods refer to each other.

### Create the controller

* [x] Create `src/lib/components/editor/canvas/CanvasController.svelte.ts`.
* [x] Export a `CanvasController` class.
* [x] Give its constructor an `Editor` reference.
* [x] Import `Editor` with `import type` in this file.
* [x] Add a `canvas` property to `Editor`.
* [x] Construct it once with `new CanvasController(this)` inside the editor constructor.
* [x] Keep DOM access, event-listener registration, and timer startup out of both constructors.

### Move canvas state

* [x] Move these fields from `ConceptEditor.svelte` to `CanvasController.svelte.ts`:

```text
canvasElement

panX
panY
zoom
isPanning
panStartMouseX
panStartMouseY
panStartX
panStartY
panToggleOnSpace

dragState
pendingDragState
resizeState
selectionBoxState
childTileDragState
marqueePreviewInstanceIds

arrangingCards
arrangingCamera
pasteConfirmation
lastEnterPress
```

* [x] Move the associated zoom limits, drag thresholds, selection threshold, double-Enter window, and animation duration into the same module.
* [x] Preserve their existing values.

### Move camera, framing, and arrangement functions

* [x] Move these functions from `ConceptEditor.svelte` to `CanvasController.svelte.ts`:

```text
getCurrentCamera
applyCamera
getSavedCameraForInstance
getCameraForBounds
saveCurrentCanvasCamera

getViewportCenterWorldPoint
getViewportWorldSize
canvasPointToWorldPoint
getCanvasPointFromPointerEvent
getWorldPointFromEvent

getBoundsForInstanceUpdates
nextAnimationFrame
animateLayoutUpdates
arrangeCardsInCurrentCanvasInGrid
frameCardsInCurrentCanvas

panToWorldPoint
focusCard
focusSelectionOrNearestCard
```

### Move pointer and drag functions

* [x] Move these functions into `CanvasController.svelte.ts`:

```text
handleChildTileDragStart

handleCanvasWheel
handleCanvasPointerDown
handleCanvasDoubleClick
handleCanvasContextMenu

handleCardPointerDown
handleCardContextMenu
handleResizePointerDown

handleChildTilePointerMove
promotePendingDragIfValid
handleCardResizingPointerMove
handleCardDraggingPointerMove
handlePanningPointerMove

getCardsForDragStart
getDropTargetAtPoint

handleWindowPointerMove
handleWindowPointerUp

finishChildTileDrag
finishResize
finishCardDrag
```

### Move marquee-selection functions

* [x] Move these functions into `CanvasController.svelte.ts`:

```text
getCardsInsideSelectionBox
updateMarqueePreviewSelection
clearMarqueePreviewSelection
applyMarqueeSelection

getSelectionBoxCanvasRect
getSelectionBoxWorldRect

isSelectionModifierEvent
handleCardSelectionPointerDown
handleSelectionBoxPointerMove
finishSelectionBox
```

### Move interaction reset functions

* [x] Move these functions into `CanvasController.svelte.ts`:

```text
emptyDragState
emptyPendingDragState
emptyResizeState
emptySelectionBoxState
emptyChildTileDragState

resetDragState
resetResizeState
clearInteractiveState
```

### Move clipboard and keyboard interaction

* [x] Move these functions into `CanvasController.svelte.ts`:

```text
handleCanvasPaste
confirmPasteImport
cancelPasteImport
createConceptsFromParsedItems

isInteractiveElement
consumeDoubleEnter
handleWindowKeydown
handleConceptTitleKeydown
handleConceptTitleBlur
```

### Move selection commands and navigation into the editor

* [x] Move these functions from `ConceptEditor.svelte` to `Editor.svelte.ts`:

```text
selectOnlyInstance
toggleInstanceSelection
clearSelection

prepareCanvasNavigation
openCardCanvas
openRootCanvas
openInstanceCanvas
openInstanceParentCanvas
```

* [x] Make editor navigation methods call `this.canvas` for camera saving, camera application, framing, and interaction resets.
* [x] Make `clearSelection` clear the canvas’s marquee preview as well as the editor’s selected IDs.
* [x] Preserve the outgoing-camera save, interaction reset, selection reset, DOM-update wait, and incoming-camera restoration.
* [x] Change `openRootCanvas` to `await prepareCanvasNavigation(null)` before reading `cardsInCurrentCanvas` and framing or resetting the root camera.
* [x] Preserve the root canvas’s current frame-all behavior.

### Resolve ownership references

* [x] Use `this.<name>` for controller-owned state and methods.
* [x] Use `this.editor.<name>` for editor records, queries, selection, menu state, and persistence commands.
* [x] Keep extracted geometry and layout helpers as imported functions.
* [x] Keep the no-refresh camera write unchanged.
* [x] Do not import live state from `ConceptEditor.svelte`.
* [x] Do not duplicate record arrays inside the canvas controller.

### Keep browser bindings in components

* [x] Keep one `<svelte:window>` in `ConceptEditor.svelte`.
* [x] Point its keyboard and pointer callbacks to `editor.canvas`.
* [x] Point its click callback to `editor.closeContextMenu`.
* [x] Change the viewport binding to `bind:this={editor.canvas.canvasElement}`.
* [x] Leave sidebar resizing state and its three handlers in `ConceptEditor.svelte`.

**Checkpoint**

* [ ] Verify zooming around the pointer, middle-button panning, and the Space toggle.
* [ ] Verify single-card dragging, group dragging, resizing, marquee selection, and child dragging.
* [ ] Verify dropping onto child areas and tag areas.
* [ ] Verify navigation and camera restoration.
* [ ] Verify double-Enter creation and title editing.
* [ ] Verify clipboard import and its confirmation.
* [x] Preserve existing DOM classes and data attributes used by `getDropTargetAtPoint`.

## 10. Replace shared-operation props with context

### Simplify `ConceptCard.svelte`

* [x] Retrieve the editor with `getEditorContext()` during component initialization.
* [x] Keep `card` as a prop.
* [x] Derive active, selected, dragging, marquee-preview, arranging, title-focus, and tag values from the editor and canvas state.
* [x] Replace pointer, resize, title, tag, and context-menu callback props with direct calls to `editor` or `editor.canvas`.
* [x] Replace `onChildDragStart` with a call to the canvas controller from the existing hold-timer callback.
* [x] Replace `onTitleFocused` with clearing `editor.pendingFocusInstanceId` when it matches this card.
* [x] Remove the replaced props and their attributes from the parent invocation.
* [x] Keep the title-input element and focus effect local.
* [x] Keep the child-hold timer local.
* [x] Call `cancelChildTileHold` when the card is destroyed.

### Simplify `ConceptDropArea.svelte`

* [x] Retrieve the editor from context.
* [x] Replace the `getConceptChildren` prop with the editor query.
* [x] Replace the `onCardOpen` prop with `editor.openInstanceCanvas(card.instance.id)`.
* [x] Keep `openCardFromDropArea` and its existing guard against opening the parent when a tree row is double-clicked.
* [x] Keep `card`, `onChildPointerDown`, and `onChildPointerUp` as props.

### Simplify `TreeView.svelte` and `TreeViewNode.svelte`

* [x] Retrieve the editor from context.
* [x] Replace `getConceptChildren` and `getRootConceptInstances` props with editor queries.
* [x] Remove those query props from recursive calls and all parent invocations.
* [x] Keep `rootCard` on `TreeView`.
* [x] Keep `card` and `level` on `TreeViewNode`.
* [x] Keep `rootExpanded` and `expanded` local.
* [x] Keep `onChildPointerDown` and `onChildPointerUp` as explicit props.

**Preserve the existing difference between the two tree usages:** the card tree receives drag callbacks; the sidebar tree does not.

* [x] Do not enable sidebar dragging as a side effect of introducing context.
* [x] Do not implement the missing tree-row opening behavior during this refactor.

### Simplify `ConceptSidebar.svelte`

* [x] Retrieve the editor from context.

* [x] Read the current card, sidebar tab, relationships, relationship definitions, and concept queries from the editor.

* [x] Replace shared navigation, title-editing, tag-removal, and property-update callback props with direct calls.

* [x] Pass a bound wrapper when supplying `editor.getConceptById` to `getRelationshipDisplayParts`.

* [x] Move `sidebarNewTag` from `ConceptEditor.svelte` into `ConceptSidebar.svelte`.

* [x] Move `addSidebarTag` from `ConceptEditor.svelte` into `ConceptSidebar.svelte`.

* [x] Change its final call to `editor.handleManualTagAdd(card, title)`.

* [x] Bind the tag input to the local draft.

* [x] Preserve submission on Enter and blur.

* [x] Remove `sidebarNewTag`, `onSidebarNewTagChange`, and `onSidebarTagAdd` from the sidebar interface.

* [x] Keep the existing property draft fields and property-input helpers local.

* [x] Keep the existing property-draft reset effect.

### Simplify the topbar and context menu

* [x] Retrieve the editor from context in `CanvasTopbar.svelte`.
* [x] Replace editor-state and editor-operation props with editor access.
* [x] Call `editor.canvas` for focus, frame-all, and grid arrangement.
* [x] Retrieve the editor from context in `CanvasContextMenu.svelte`.
* [x] Replace its shared menu-state and operation props with editor access.
* [x] Preserve existing event propagation and menu-closing behavior.

### Keep straightforward components straightforward

* [x] Keep `CanvasSelectionBox` receiving its rectangle through props.
* [x] Keep `PasteImportConfirmation` receiving its count, target label, and confirm/cancel callbacks.
* [x] Keep `ConceptTagsPreview` receiving its tags and presentation-specific callbacks.
* [x] Delete `openCardCanvas` from `Editor.svelte.ts` once every caller uses `openInstanceCanvas(card.instance.id)` directly.

**Checkpoint**

* [x] Verify that adding an editor method no longer requires forwarding it through intermediate components.
* [ ] Verify that tree expansion and input drafts remain independent between component instances.
* [ ] Verify both card-tree and sidebar-tree behavior separately.

## 11. Separate canvas rendering from the workspace

* [ ] Create `src/lib/components/editor/canvas/ConceptCanvas.svelte`.
* [ ] Retrieve the editor from context in that component.
* [ ] Move these canvas-only markup sections from `ConceptEditor.svelte` into it:

```text
Child-drag ghost
Canvas background
Marquee selection box
Transformed canvas-world element
ConceptCard loop
Zoom indicator
```

* [ ] Render `<ConceptCanvas />` in the existing `mainView === 'canvas'` branch.
* [ ] Keep the table placeholder in the alternate branch in `ConceptEditor.svelte`.
* [ ] Keep the surrounding main viewport element and its `canvasElement` binding in `ConceptEditor.svelte`.
* [ ] Keep the topbar, sidebar shell, sidebar resize handle, confirmation, and context menu in `ConceptEditor.svelte`.

Keeping the existing viewport element avoids changing the coordinate-measurement container during the rendering extraction.

* [ ] Move the styles for the extracted canvas markup into `ConceptCanvas.svelte`.
* [ ] Keep workspace, viewport-container, sidebar-shell, and sidebar-resize styles in `ConceptEditor.svelte`.
* [ ] Preserve the existing class names and data attributes.

Move component-scoped CSS with the markup it styles; parent-component styles do not automatically become styles for extracted child markup. ([Svelte][6])

**Checkpoint**

* [ ] Verify viewport sizing, card positions, zoom transforms, drag ghosts, and selection-box placement.
* [ ] Verify sidebar resizing.
* [ ] Verify switching between the canvas and existing table placeholder.

## 12. Apply the naming cleanup

* [ ] Apply these renames in `src/lib/components/editor/Editor.svelte.ts` and update every reference:

| Existing name              | New name           |
| -------------------------- | ------------------ |
| `getConceptChildren`       | `getChildCards`    |
| `getRootConceptInstances`  | `getRootCards`     |
| `getCardByInstanceId`      | `getCard`          |
| `handleManualTagAdd`       | `addTag`           |
| `handleTagRemove`          | `removeTag`        |
| `handlePropertiesChange`   | `setProperties`    |
| `openInstanceParentCanvas` | `openParentCanvas` |

* [ ] Rename `getNextConceptPositionAfterCard` in `canvas/layout.ts` to `getNearbyCardPosition`.

* [ ] Rename its caller’s `nextconceptPositionAfterCard` variable to `nextPosition`.

* [ ] Apply these child-drag renames across the canvas controller and its types:

| Existing name                | New name                     |
| ---------------------------- | ---------------------------- |
| `ChildTileDragState`         | `ChildDragState`             |
| `childTileDragState`         | `childDragState`             |
| `handleChildTileDragStart`   | `startChildDrag`             |
| `emptyChildTileDragState`    | `emptyChildDragState`        |
| `handleChildTilePointerMove` | `handleChildDragPointerMove` |
| `finishChildTileDrag`        | `finishChildDrag`            |

* [ ] Leave CSS class names unchanged during these symbol renames.
* [ ] Keep the remaining names stable until you have used the refactored editor.

## 13. Audit the result

### Check ownership

* [ ] Keep loaded records, hierarchy queries, selection, navigation, and editor commands in `Editor.svelte.ts`.
* [ ] Keep camera, pointer interaction, marquee interaction, clipboard placement, and canvas keyboard behavior in `CanvasController.svelte.ts`.
* [ ] Keep workspace composition and sidebar resizing in `ConceptEditor.svelte`.
* [ ] Keep spatial markup in `canvas/ConceptCanvas.svelte`.
* [ ] Keep component-specific drafts, expansion, focus elements, and hold timers in their components.
* [ ] Keep endpoint URLs in `src/lib/client/`.
* [ ] Keep file persistence and server coordination in `src/lib/server/`.

### Check for leftovers

* [ ] Search for imports using the old paths:

```text
$lib/types
$lib/concepts
$lib/canvas
$lib/queries
$lib/repositories
$lib/services
$lib/components/ConceptCanvas
```

* [ ] Remove obsolete imports, unused declarations, abandoned comments, and empty directories.
* [ ] Search editor components for remaining direct `fetch('/api/...')` calls.
* [ ] Search for duplicate model definitions.
* [ ] Search for writable copies of derived cards or current-card state.
* [ ] Search callback assignments for unbound class methods.
* [ ] Confirm that neither controller is exported as a global singleton.
* [ ] Confirm that neither constructor accesses `window` or `document`.

### Run the regression checks

* [ ] Run the type checker and production build.

* [ ] Create a concept by double-clicking the canvas.

* [ ] Create a concept with double Enter.

* [ ] Rename a concept and verify existing conflict reporting.

* [ ] Edit properties and tags on a concept with multiple instances.

* [ ] Drag, resize, select, and group-drag cards.

* [ ] Drag a child out of a card and into another card.

* [ ] Drop a concept onto a tag area.

* [ ] Navigate into a card, return to its parent, and return to root.

* [ ] Verify saved camera restoration.

* [ ] Run frame-all, focus, and grid arrangement.

* [ ] Import pasted lines and test the large-import confirmation.

* [ ] Import children from another instance of the same concept.

* [ ] Resize the sidebar and expand both tree usages.

* [ ] Refresh the browser and verify persisted changes.

* [ ] Check for new browser-console errors and unhandled request failures.

* [ ] Add a short ownership map to `docs/refactor-notes.md`.

* [ ] Record remaining bugs and unfinished features separately from refactoring leftovers.

* [ ] Stop this refactoring pass and use the editor before introducing more subdivisions or changing the data model.

[1]: https://svelte.dev/docs/kit/server-only-modules "Server-only modules • SvelteKit Docs"
[2]: https://svelte.dev/docs/svelte/%24derived "$derived • Svelte Docs"
[3]: https://svelte.dev/docs/svelte/%24state "$state • Svelte Docs"
[4]: https://svelte.dev/docs/svelte/context "Context • Svelte Docs"
[5]: https://svelte.dev/docs/svelte/%24effect "$effect • Svelte Docs"
[6]: https://svelte.dev/docs/svelte/scoped-styles "Scoped styles • Svelte Docs"

# 10. Creation and title editing

Creation adds a Concept and an occurrence. Title editing starts from an existing occurrence and can change which Concept it represents. Both operations cross the browser/server boundary, but they have different identity rules.

This chapter follows the commands first, then their input handlers, HTTP calls, and persistence helpers. The optional exercise adds a New Card button; it does not change title behavior.

## Responsibilities and main functions

| File                                                                                  | Responsibility and main functions                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/components/editor/Editor.svelte.ts`                                          | `createConcept` supplies defaults and refresh. `commitTitleEdit` joins pending edits; `updateConceptTitleFromInstance` reports conflicts; `getTitleConflictCandidates`, `resolveTitleConflict`, and `cancelTitleConflict` drive the wizard. |
| `src/lib/components/editor/canvas/CanvasController.svelte.ts`                         | Handles canvas and title-input events. Chooses placement using `getViewportCenterWorldPoint`, pointer conversion, or `getNearbyCardPosition` from `layout.ts`.                                                                              |
| `src/lib/components/editor/card/ConceptCard.svelte`                                   | Displays one card's title input and focuses it when `pendingFocusInstanceId` matches.                                                                                                                                                       |
| `src/lib/client/concepts.ts`                                                          | `createConceptRecord` and `updateConceptTitleFromInstanceRecord` send HTTP requests and interpret responses.                                                                                                                                |
| `src/routes/api/concepts/+server.ts`                                                  | `POST` delegates creation; `PATCH` requires both IDs for title edits and translates service results into HTTP responses.                                                                                                                    |
| `src/lib/server/conceptService.ts`                                                    | `createConceptWithInstance` constructs linked records. `updateConceptTitleFromInstance` applies reassignment and conflict rules.                                                                                                            |
| `src/lib/server/repositories/conceptRepository.ts` and `conceptInstanceRepository.ts` | Read collections, generate IDs, and write the two JSON files.                                                                                                                                                                               |
| `src/lib/components/editor/TitleConflictDialog.svelte` and `ConceptEditor.svelte`     | The dialog presents source, destination, and copy choices; the workspace mounts it while `editor.titleConflict` exists.                                                                                                                     |
| `src/lib/model/TitleConflictMode.ts`                                                  | Defines conflict modes and the optional `TitleConflictResolution` request.                                                                                                                                                                  |

The [loading and derived cards chapter](05-loading-and-derived-cards.md) explains the return path from persistence to rendering. [Cards](06-cards.md) covers the component itself; [HTTP and persistence](12-http-and-persistence.md) covers the transport and storage boundaries in more detail.

## Creating a Concept and its first instance

`Editor.createConcept` is the existing editor-level entry point:

```ts
async createConcept(options: CreateConceptOptions = {}) {
	const sizePreset = options.sizePreset ?? 'medium';
	const presetSize = conceptSizePresets[sizePreset];

	const result = await createConceptRecord({
		...(options.position ?? {}),
		...(options.title !== undefined ? { title: options.title } : {}),
		width: options.width ?? presetSize.width,
		height: options.height ?? presetSize.height,
		parentInstanceId: options.parentInstanceId ?? this.currentCanvasOwnerInstanceId
	});

	if (options.focusAfterCreate ?? true) {
		this.pendingFocusInstanceId = result.instance.id;
		this.activeInstanceId = result.instance.id;
	}

	await invalidateAll();

	return result;
}
```

The command keeps several policies out of components:

- Dimensions default to the medium preset unless overridden.
- Parentage defaults to the open canvas owner instance. At root this is `null`; inside an occurrence it is that occurrence's ID.
- Focus intent uses the returned **instance ID**, because several cards may represent the same Concept.
- Successful creation calls `invalidateAll()` rather than inserting a component-local card.

The parent expression uses `??`: an explicit `null` also falls back to the current owner. It is not an override for root creation while inside another canvas.

`createConceptRecord` sends `POST /api/concepts`. The route passes the parsed input to `createConceptWithInstance`. That service creates:

1. A Concept with a new ID, a trimmed title (blank by default), empty properties, and no tags.
2. An instance with its own new ID and `conceptId` referring to that Concept.

The instance stores parentage, geometry, and camera defaults. If no position was supplied, the service defaults `x` to `32 + instances.length * 248` and `y` to `32`. Creation does not search for a same-title Concept or enforce title uniqueness.

Supporting helpers `createConceptId` and `createConceptInstanceId` generate separate UUID-based IDs. `saveAllConcepts` then `saveAllConceptInstances` write the complete collections. These sequential writes are **not a transaction**; a successful first write does not guarantee the second will succeed.

## Refresh and title focus

After the response, `Editor.createConcept` records focus intent and awaits invalidation:

```mermaid
sequenceDiagram
    participant Command as Editor.createConcept
    participant Client as Browser client
    participant Server as Route and service
    participant Files as JSON repositories
    participant Refresh as Loader and ConceptEditor
    participant Card as ConceptCard
    Command->>Client: createConceptRecord(input)
    Client->>Server: POST /api/concepts
    Server->>Files: Save Concept, then instance
    Files-->>Server: Writes complete
    Server-->>Command: Concept and instance via client
    Command->>Command: Set pendingFocusInstanceId
    Command->>Refresh: invalidateAll()
    Refresh->>Files: Reload canonical records
    Refresh->>Refresh: editor.replaceData(...)
    Refresh-->>Card: Derived card renders
    Card->>Card: Focus and select title input
```

`ConceptEditor.svelte` passes refreshed data into the **existing** Editor through `replaceData()` inside `untrack()`. `Editor.cards` joins instances to Concepts, and `cardsInCurrentCanvas` filters by parent instance ID. No Card record is written.

In `ConceptCard.svelte`, an effect waits for both a matching `pendingFocusInstanceId` and a mounted title input. It focuses/selects the input and clears that pending ID. The DOM work belongs to the component, not the service.

## Title editing changes the represented Concept

A card displays `card.concept.title`, but edits begin from `card.instance`. `Editor.commitTitleEdit` trims input and skips an exactly unchanged title. Enter and blur for the same in-flight edit join one pending promise rather than sending duplicate requests.

`updateConceptTitleFromInstanceRecord` sends the Concept ID, instance ID, requested title, and conflict mode to `PATCH /api/concepts`. A reported conflict returns `409`/`TITLE_CONFLICT` without writes. The Editor stores the original title and matching Concepts, and keeps the commit pending while `ConceptEditor.svelte` mounts `TitleConflictDialog.svelte`.

### The implemented conflict wizard

The native modal uses cream fills, square edges, and compact rows. It asks whether to Create new Concept or use an existing Concept. `getTitleConflictCandidates` builds one row per occurrence/path, plus Not placed entries for Concepts without instances. Selecting a row supplies exact Concept and optional source-instance IDs, not identity inferred from its title/path.

Rows show properties and immediate children. Properties count is `Object.keys(concept.properties).length + Object.keys(instance.properties).length`, counting overlapping keys twice. Not placed counts only shared properties and has no instance-copy options. Ancestors shorten with ellipses; the final title remains visible and the full path is available on hover.

Existing selection offers two destinations:

| Destination                                  | Behavior                                                                                                                                                                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Use it for this card                         | Reassign the edited instance, preserving ID, parentage, geometry, camera, view, pin, sequence, and existing children. Merge selected source-instance property keys: selected values overwrite matching keys, while unselected destination keys remain. |
| Keep this card and create another occurrence | Leave the original unchanged. Create a fresh sibling beside it with default instance size, camera, tree view, unpinned state, no sequence, and empty metadata except selected copies.                                                                  |

All source-instance property keys start selected, with Select All, Select None, and individual controls. Notes default checked when a source instance exists; children default checked when it has children. Notes copying warns about replacement and explicitly warns when empty source notes would clear current notes. Declining notes copying preserves current notes or leaves a new sibling at its default.

Copy children appends the entire source descendant tree beneath the destination. Every copied instance gets a fresh ID and retains its Concept reference; there is no title/Concept-ID deduplication and no immediate-only option. Existing destination children remain. One Retain child metadata checkbox governs the whole subtree, retaining instance metadata or initializing defaults.

Shared Concept properties, tags, notes, dates, and appearance apply by reference. They are not optional instance copies; there are no instance date/appearance controls. The separate legacy immediate-child import action remains unchanged: it copies only immediate children and skips Concept IDs already directly present.

`resolveTitleConflict` sends the chosen mode and optional `TitleConflictResolution` through the client, route, and service, then invalidates so records return through the stable Editor bridge. A new sibling is selected after refresh when visible on the current canvas. Cancel/Escape before saving resolves the pending edit as cancelled, restores the original input title, and writes nothing. Busy saving blocks repeated confirmation and cancellation. A failed resolution stays open with an error; a successful write followed by failed refresh closes the wizard to prevent another copy.

The route requires both IDs for title editing and validates resolution fields; the service rejects invalid/stale source or target selections. `use-existing` resolutions carry `targetConceptId`, optional `sourceInstanceId`, `destination`, `propertyKeys`, `copyNotes`, `copyChildren`, and `retainChildMetadata`. Unknown conflict modes retain the `report-conflict` fallback.

### Service decision order

`src/lib/server/conceptService.ts:updateConceptTitleFromInstance` loads the supplied Concept and instance, trims the requested title, and finds **other** Concepts with the same trimmed, case-insensitive title. An empty requested title has no matches.

The order matters:

| Condition                                                                                                 | Result                                                                                                                                    | Files written |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Matches exist; `report-conflict`                                                                          | Return matching Concepts without changing records.                                                                                        | Neither       |
| Valid `use-existing` resolution                                                                           | Use the exact selected Concept and apply current-instance or new-sibling destination/copy options.                                        | Instances     |
| Matches exist; `use-existing` without a resolution                                                        | Legacy fallback: reconnect this instance to the first matching Concept.                                                                   | Instances     |
| No earlier return; original title is blank, exactly one instance uses it, and requested title is nonempty | Name the original blank Concept in place.                                                                                                 | Concepts      |
| Otherwise                                                                                                 | Create a new Concept, deep-copy properties, tags, notes, dates, and appearance, and reconnect this instance. Retain the original Concept. | Both          |

`create-duplicate` bypasses reuse/conflict reporting; it still reaches the blank-Concept special case before the new-Concept branch. It does not force a new ID when naming a singly used blank Concept. Legacy `use-existing` without a resolution and with no match also proceeds to those later branches; an exact-ID resolution must select a matching Concept.

Naming a blank, singly used Concept is the narrow in-place exception. Editing an already named occurrence is not a global rename of the shared Concept. Clearing a named title reaches the new-Concept branch with an empty title. Different Concept IDs may legitimately have equal titles.

Only legacy `use-existing` calls without a resolution choose `matchingConcepts[0]`. The wizard always supplies an exact-ID resolution. Reusing a Concept takes its shared metadata; it does not merge the previous shared metadata into it.

### Identity and containment remain distinct

When reassignment changes `instance.conceptId`, it preserves the instance's:

- `id` and `parentInstanceId`;
- position and dimensions;
- saved camera fields, view, pin, and sequence;
- children, whose `parentInstanceId` still points to the unchanged instance ID.

Other instances still refer to the original Concept. No instance-local title is added, and unused Concepts are not automatically deleted.

For example, suppose instance A in Garage and instance B in Transport both reference Bicycle. Editing A to `Scooter` has these outcomes:

1. If Scooter already exists, the default request reports a conflict without writing either file. The wizard opens and keeps the title commit pending.
2. Choosing an exact Scooter occurrence and Use it for this card reconnects A to that Concept with optional instance copies. B still represents Bicycle. Choosing a new sibling instead leaves both unchanged.
3. If there is no match, the service creates a new Scooter Concept with Bicycle's copied properties, tags, notes, dates, and optional appearance, then reconnects A. Bicycle remains unchanged for B.
4. Current-instance reassignment preserves A's children, parent, geometry, camera, view, pin, sequence, and ID; selected copies can merge properties, replace notes, or append descendants.

These are service traces, not instructions to test against personal records.

## Input behavior: two double-Enter paths

The input in `ConceptCard.svelte` delegates `keydown` to `handleConceptTitleKeydown` and blur to `handleConceptTitleBlur`. Its double-click handler stops propagation.

| Entry point                                  | Current behavior                                                                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Enter in a title input                       | Prevent default, record the title-specific Enter target, and await `commitTitleEdit`.                                              |
| Second Enter in the same title within 450 ms | After a normal `saved`/`unchanged` commit, create nearby via `getNearbyCardPosition(card)`; wizard outcomes do not create.         |
| Escape in a title input                      | Restore `card.concept.title` in the input, then blur; blur calls the normal commit path, normally a no-op for that restored value. |
| Blur                                         | Commit the current input value, joining the pending edit if Enter already started it.                                              |
| Double Enter outside interactive elements    | `handleWindowKeydown` creates at viewport center.                                                                                  |
| Canvas double-click                          | Convert pointer position to world coordinates and create with a random offset of up to 100 units per axis.                         |

`consumeDoubleEnter` compares the previous target ID and timestamp, then updates both. Title targets use `title:<instance ID>`; canvas targets use `canvas:<owner instance ID or root>`. It does not itself check whether the event was Enter. The window handler excludes focused inputs, buttons, and other interactive elements.

The title handler awaits the pending edit and creates nearby only for `saved` or `unchanged`. Wizard `resolved`/`cancelled`/`failed` outcomes do not create another card. Enter does not blur; the dialog stops keyboard propagation so wizard actions cannot trigger canvas double Enter. `commitConceptTitleInput` synchronizes the input with the canonical or restored title after completion.

Key wizard flows passed isolated browser tests, and unit tests passed (reported implementation validation). This documentation update does not rerun them or complete the broader manual checklist. Three-second interactive previews and date-display filtering remain deferred.

## Optional exercise: add a New Card button

Add a small composition command to `Editor`:

1. In `src/lib/components/editor/Editor.svelte.ts`, add `async createConceptAtViewportCenter()` immediately above `createConcept`.
2. Get the position from `this.canvas.getViewportCenterWorldPoint()` and return `this.createConcept({ position })`.
3. In `src/lib/components/editor/canvas/CanvasTopbar.svelte`, add one `New Card` button inside `concept-topbar-actions`, before the existing grouped controls. Call `editor.createConceptAtViewportCenter()` through an arrow callback.
4. Reuse the existing context. Do not add HTTP calls, defaults, camera arithmetic, CSS, or schema changes.
5. Leave both keyboard handlers and title behavior unchanged.

This method and button are proposed exercise code, not existing application features. [Integration](13-integration.md) requires this implementation, moves the method to `CanvasController`, and revises the same button rather than adding another.

The supporting coordinate helper computes:

```text
world x = (canvas viewport width / 2 - panX) / zoom
world y = (canvas viewport height / 2 - panY) / zoom
```

For a 1000 × 600 viewport, pan `(100, -50)`, and zoom `2`, the point is `(200, 175)`. This becomes the card's **top-left anchor**, not its geometric center. The helper returns `(0, 0)` if no canvas element is bound.

## Safe backup and restore for manual checks

Creation writes both `src/lib/data/concepts.json` and `src/lib/data/concept_instances.json`. Title editing can write either or both. Navigation/camera and geometry interactions can also write instances. These files contain personal data, not test fixtures.

Prefer disposable isolated storage. If checking the exercise against this checkout, stop the application and all other writers first. In native WSL Ubuntu, from `/home/cory/development/concept-editor`, create a fresh directory **outside the project**:

```sh
mkdir -m 700 /home/cory/concept-editor-tutorial-10-backup
```

If it fails or already exists, stop. Choose another unused literal directory name and use it consistently in every command below; do not reuse or overwrite an uncertain backup. Then copy and verify the pair:

```sh
cp -p src/lib/data/concepts.json /home/cory/concept-editor-tutorial-10-backup/concepts.json &&
cp -p src/lib/data/concept_instances.json /home/cory/concept-editor-tutorial-10-backup/concept_instances.json &&
cmp src/lib/data/concepts.json /home/cory/concept-editor-tutorial-10-backup/concepts.json &&
cmp src/lib/data/concept_instances.json /home/cory/concept-editor-tutorial-10-backup/concept_instances.json &&
printf 'Paired backup verified\n'
```

Continue only if every command succeeds and the verification message appears. Do not touch `data-backup-do-not-delete-project-level-data.zip`. This pair protects the operations described here, not later relationship edits or other storage changes.

To roll back only exercise mutations, stop the app and all writers again. **Do not restore if desired edits were made after the backup**, including titles, metadata, containment, geometry, or cameras. Preserve the current state separately and reconcile deliberately instead. If the backed-up pair is exactly the state you want:

```sh
test -s /home/cory/concept-editor-tutorial-10-backup/concepts.json &&
test -s /home/cory/concept-editor-tutorial-10-backup/concept_instances.json &&
cp -p /home/cory/concept-editor-tutorial-10-backup/concepts.json src/lib/data/concepts.json &&
cp -p /home/cory/concept-editor-tutorial-10-backup/concept_instances.json src/lib/data/concept_instances.json &&
cmp src/lib/data/concepts.json /home/cory/concept-editor-tutorial-10-backup/concepts.json &&
cmp src/lib/data/concept_instances.json /home/cory/concept-editor-tutorial-10-backup/concept_instances.json &&
printf 'Paired restore verified\n'
```

If any restore step fails, keep the app stopped until both files are restored and verified. Keep the external backup. Deleting a test instance alone is not exact rollback: its Concept remains. Never regenerate IDs or delete arbitrary records to undo the exercise.

## Verification and source cleanup

Run `npm run check` before manual interaction. This is static validation, not evidence of persistence or browser behavior.

After a verified backup, optional manual checks are:

- Pan/zoom, then click New Card. Confirm its top-left anchor is at the visible-center world point and its title input receives focus.
- Create at root and inside an occurrence. Confirm `parentInstanceId` is respectively `null` and that exact owner instance ID.
- Check browser requests/errors and reload to confirm persistence.

No title mutation is needed to verify the button. Review title decisions statically or use isolated disposable data; do not manufacture conflicts in personal records. Do not run mutation tests against the live JSON store.

Keep the command and button if continuing to integration. To remove this exercise instead, remove only `Editor.createConceptAtViewportCenter()` and its New Card button, then rerun `npm run check`. Data rollback is separate and follows the paired-restore rules above.

[Exercise solution](solutions/10-creation-and-title-editing.md) · [Next: Properties and tags](11-properties-and-tags.md)

## Summary

- Creation persists a new Concept and a distinct instance; derived cards appear through invalidation and `replaceData`.
- Title edits operate through an occurrence. They may reuse a Concept, name one singly used blank Concept, or create a Concept and reassign the instance.
- Reassignment preserves occurrence identity, containment, children, geometry, and camera. Titles are not unique IDs.
- The wizard resolves exact identities and current-card/new-sibling copy choices. Only normal saved/unchanged title double Enter creates nearby; wizard outcomes do not.
- The optional New Card command composes existing APIs without changing persistence or title semantics.

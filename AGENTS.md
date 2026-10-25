# Concept Editor: project guide for agents

**Updated:** 2026-10-25. This is the authoritative project instruction file, not a temporary co-coding handoff. Do not maintain a competing `Agent.md`.

## 1. Current state and scope

Concept Editor is intended as a **standalone application**, not a web-first product: a flexible data-model and visual-design tool for contextual and chronological idea development and organization. Organize information about things **as things**, develop thoughts as objects, and file them into contexts without destroying their identity or information. Chronological organization is product intent, not evidence that a timeline or date schema is already implemented.

- The application uses SvelteKit, TypeScript, Svelte 5 runes, Vite, npm, `adapter-node`, and JSON-file persistence. Check `package.json`, the lockfile, and installed declarations before choosing APIs.
- The structural refactor is implemented. Its final audit commit is `ca7786d` (`Complete the refactor audit`) on `refactor/editor-architecture`; inspect the current working tree rather than assuming it matches that commit.
- `refactor-checklist.md` and `docs/refactor-notes.md` record the refactor. At this update, 277 checklist items are checked and 38 are unchecked. The remaining items are manual behavior verification, not unimplemented architecture phases. Do not restart the refactor or mark those checks passed without testing.
- `Updates-Ideas.md` is the authoritative product roadmap and brainstorming backlog. Its **Current Priorities** section takes precedence over the broader High/Medium/Low categories: complete the data model for saving/loading and meaningful root contexts next, then redesign the card before further feature work. The owner considers the Electron window-launch milestone complete; automatic server startup/shutdown and production packaging are not completed by that milestone. Remaining refactor smoke checks should precede further broad structural work; the latest owner request determines the actual task. Recording priorities is not blanket implementation or migration authorization.
- `docs/tutorial/README.md` indexes a 13-chapter codebase guide organized by the information model, Editor, interface, and persistence. Chapters include optional exercises; worked solutions are separate in `docs/tutorial/solutions/`. Exercise features are not evidence of implemented application features.
- Electron launch currently uses `index.js` and `start-electron.js`; Windows selects a separately installed global Windows Electron, while WSL uses local Linux Electron. Vite/SvelteKit still starts separately with `npm run dev`; `npm run start` opens Electron, initially at 1280 × 720. Do not describe this as an installer or automatic server lifecycle.
- Standalone desktop use is the primary product goal. The current SvelteKit browser/Node implementation can be deployed, but deployment capability does not make a hosted web app the goal. Handle relevant request/storage failures without building an offline queue, sync system, or web-service architecture by implication. Java/JavaFX, Vaadin, Java backends, and Rails were explored, not chosen as migrations. Desktop packaging and storage decisions still require explicit authorization.

### Working with the owner

The agent-led structural refactor is complete. The current workflow favors small, owner-directed updates, not further rewriting. The owner uses Zed for the agent conversation and VS Code for manual edits; preserve their work in the shared checkout.

- Change application code only when the owner explicitly asks the agent to implement a change. A question, exploration, or discussion is not authorization to edit code.
- Make the smallest change that achieves the requested goal. Limit affected files and behavior; do not bundle unrelated cleanup, renaming, formatting, refactoring, or feature additions. If a broader change is necessary, explain why and confirm that expanded scope before proceeding.
- When discussing how to write or change code, first ask one straightforward, relevant clarifying question and wait before giving implementation guidance. This question-first preference does not apply to explanations of existing code, architecture, project structure, terminology, or general tool questions; answer those directly. Use clarification to understand the intended change, not to quiz the owner. Avoid rhetorical questions, humor, coy hints, and a performative teaching tone. Follow an explicit request for a direct answer instead; clear implementation requests do not need redundant confirmation.
- Explain simply and concretely, giving only the detail needed. Avoid long speculative architecture lectures.
- After implementing a change, briefly explain what changed, why each change was needed, and what was actually validated. Trace the affected behavior in context: which component receives the action, which command it calls, what state or records change, and what the user sees next. Use exact symbols and paths; do not expand into an unrelated tour of the architecture.
- When explaining code, state each file's responsibility and main functions before its supporting helpers. Connect related steps explicitly rather than listing isolated facts. Java/POJO comparisons can help, but explain where Svelte differs.
- A useful level of explanation: “`normalizeConceptInstance` repairs/defaults records when loaded; `CreateConceptInstanceInput` describes accepted input when creating a record.” Distinguish those jobs without presenting every design choice as inherently better.
- Use exact paths and symbol names. Keep code instructions IDE-independent unless the owner asks about a specific editor.
- Respect the latest request. Preserve user work, avoid incidental rewrites, and do not treat earlier agent proposals as approved decisions. Delegate only when a concrete subtask warrants it.
- Separate structural cleanup from feature work and changes to identity, containment, or persistence. Do not commit, stage unrelated files, or switch branches unless requested.
- Report actual inspection and validation. Static review, a successful build, and a browser interaction test are different evidence.
- Keep effort and validation proportional to risk; time and token cost matter. Routine small changes should use focused inspection and relevant checks, not automatically trigger multiple agents, full builds, or repeated browser passes. More extensive verification is justified for data-safety or interacting-behavior fixes, but explain the need before substantially expanding the work.

## 2. Current architecture and ownership

```text
src/routes/+page.server.ts
  -> loads canonical records through server repositories
src/routes/+page.svelte
  -> src/lib/components/editor/ConceptEditor.svelte
     -> one Editor instance, supplied through EditorContext
     -> canvas controls, ConceptCanvas, sidebar, menus
ConceptCanvas -> ConceptCard -> ConceptDropArea -> TreeView -> TreeViewNode
```

| Responsibility                                                                                                   | Current location                                                  |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Workspace composition, context provision, incoming-data bridge, viewport binding, sidebar resizing               | `src/lib/components/editor/ConceptEditor.svelte`                  |
| Canonical records, derived cards/indexes, hierarchy queries, selection, navigation, menus, editor commands       | `src/lib/components/editor/Editor.svelte.ts`                      |
| Camera, pointer/drag/resize/marquee interaction, canvas keyboard behavior, paste placement, framing, arrangement | `src/lib/components/editor/canvas/CanvasController.svelte.ts`     |
| Spatial canvas markup and scoped styles                                                                          | `src/lib/components/editor/canvas/ConceptCanvas.svelte`           |
| Card-local title focus and child-hold timer                                                                      | `src/lib/components/editor/card/ConceptCard.svelte`               |
| Tree expansion; sidebar property/tag drafts                                                                      | Components under `src/lib/components/editor/tree/` and `sidebar/` |
| Canonical model types, normalizers, relationship queries                                                         | `src/lib/model/`                                                  |
| Browser HTTP requests and response parsing                                                                       | `src/lib/client/`                                                 |
| HTTP handlers and page loading                                                                                   | `src/routes/`                                                     |
| Coordinated server rules                                                                                         | `src/lib/server/conceptService.ts`                                |
| JSON reads/writes                                                                                                | `src/lib/server/repositories/`                                    |
| Input parsing                                                                                                    | `src/lib/parsers/`                                                |

The old workspace-sized `ConceptCanvas`, duplicate core model declarations, old type/service/repository directories, confirmed-empty placeholders, and unused child-tile measurement/preview implementation have been removed. Do not follow old instructions to extract them again. Active `child-tile-*` DOM classes still exist for interactions; their names do not prove the retired layout remains.

Current names include `getChildCards`, `getRootCards`, `getCard`, `addTag`, `removeTag`, `setProperties`, `openParentCanvas`, `childDragState`, `startChildDrag`, `finishChildDrag`, and `getNearbyCardPosition`.

### State and refresh rules

- There is one stable `Editor` per workspace, not a mutable module singleton. `EditorContext.ts` currently uses Svelte's typed `createContext<Editor>()`, not the earlier proposed symbol wrapper.
- The loader supplies concepts, instances, relationships, and relationship definitions. It no longer constructs cards or duplicates repository file reading.
- Cards are derived from canonical records. `ConceptEditor.svelte` bridges refreshed loader data into the existing editor through `replaceData()` and `untrack()`. Preserve that bridge; neither one-time initialization nor recreating the editor on every refresh is equivalent.
- Successful record mutations generally call `invalidateAll()` so server records return through the loader. Camera persistence deliberately calls the instance client **without** invalidation. Preserve that exception.
- Shared capabilities come from context. Props still carry card identity, depth, and per-use callbacks; drafts, expansion, focus elements, and hold timers remain component-local.
- Keep observed controller fields reactive and preserve method binding in callbacks. Avoid DOM access/listener installation in SSR-capable constructors. Keep server imports out of browser controllers.
- Ordinary `Set`/`Map` mutation is not made reactive just by nesting it in `$state`. Preserve replacement-based updates or deliberately use Svelte reactive collections. The owner disabled `svelte/prefer-svelte-reactivity` in `eslint.config.js`; do not re-enable it or convert every collection incidentally.
- Type props as `let { data }: { data: PageData } = $props();`, not `$props<{ data: PageData }>()`. The installed `$props` declaration takes no type arguments, even though the command-line checker did not flag that old pattern.
- When moving markup, move its scoped CSS and preserve behavioral selectors/data attributes.

## 3. Domain rules: preserve these distinctions

The source of truth for shapes is `src/lib/model/`. Do not change persisted shapes as incidental cleanup.

### Concepts and instances

**Concept** is reusable, parentless identity: `id`, `title`, `properties: Record<string, string>`, and `tagConceptIds: string[]`.

- IDs establish identity; titles do not. Different Concepts with the same title must remain possible. Do not impose identity using equal names, metadata combinations, or hashes.
- Tags are Concepts, and `tagConceptIds` already stores their IDs. Do not introduce a separate tag entity merely to identify them.
- Properties and tags belong to the shared Concept. They are not copied per placement. Flexible metadata is central; required schemas, inheritance, arbitrary JSON values, and typed attributes are not implemented by implication.
- Concepts can exist without instances. Do not automatically garbage-collect them.

**ConceptInstance** is one occurrence: its own `id`, a `conceptId`, one nullable `parentInstanceId`, `x/y/width/height`, and `lastCameraPanX/lastCameraPanY/lastCameraZoom`.

- `null` means root placement. One instance does not have multiple simultaneous containment parents.
- One Concept can have many distinct instances in different contexts. Those instances retain independent geometry, cameras, and children.
- Children are queried by **parent instance ID**, not parent Concept ID. Do not synchronize children across occurrences.
- There is no local title, notes field, or child-ID array on the current instance type.

**ConceptCardView** combines `{ concept, instance }` for display. It is not a third persisted entity. `ConceptCard.svelte` receives this object as its `card` prop; the component is the visual interface, while the view object is its data. Other views can use that data without rendering a card.

### Title editing changes what an occurrence represents

Read `src/lib/server/conceptService.ts:updateConceptTitleFromInstance` before modifying this flow.

Editing one named occurrence can change its `conceptId`; it does **not** globally rename the existing shared Concept or require a local alias field. If instance A switches from Bicycle to Scooter, instance B can still reference the unchanged Bicycle Concept.

Current service behavior:

- Trim input and match titles case-insensitively.
- `report-conflict`: return other matching Concepts.
- `use-existing`: reconnect the edited instance to the first matching Concept, taking that Concept's shared metadata.
- `create-duplicate`: proceed without reusing the match.
- Rename a previously blank Concept in place when it has one instance and receives a nonempty title.
- Otherwise create a new Concept, copy existing properties/tags, and reconnect the edited instance.

Preserve the edited instance's ID, containment, children, geometry, and camera. The blank-Concept exception is not authorization to rename already named shared Concepts. Deliberate shared property/tag edits remain valid; “relatively static” does not mean immutable.

The service can express these operations, but complete title-selection/confirmation UI is still missing. Exact same-name disambiguation, metadata initialization decisions, no-op/cancel behavior, and the blank-Concept exception need care when extending it. Do not claim the full flow was runtime-tested merely because the service supports it.

### Tags, navigation, imports, and deletion

- Separate choosing a **Concept ID** among equal titles from choosing an **occurrence** of that Concept. The owner expects occurrence selection by readable path where needed; a path label is not itself a unique ID. Zero-instance navigation and chooser details remain open.
- `ensureConceptByTitle` and title `use-existing` still use the first case-insensitive match. These are incomplete identity shortcuts, not approved uniqueness rules.
- Importing children from another occurrence creates **new immediate child instances**, retains their Concept references, and skips Concept IDs already directly present at the destination. It does not recursively clone a subtree, share child instance IDs, or synchronize future edits. The endpoint requires distinct source/target occurrences of the same Concept.
- Instance deletion currently removes only the requested record. Cascade deletion, reparenting, orphan handling, and Concept garbage collection have not been decided. Do not introduce them as cleanup.

### Relationships are not containment

`ConceptRelationship` has `id`, `relationshipConceptId`, `participantGroups`, optional `representedByConceptId`, and string-valued properties. Participants are discriminated references of type `'concept'` or `'relationship'`; preserve that distinction.

- `relationshipConceptId` identifies the relationship kind. `representedByConceptId` can identify a Concept representing a particular occurrence. Do not interchange them.
- `RelationshipDefinition` describes optional inverse/mutual behavior and display patterns. Those fields do not prove complete creation, navigation, or equivalence-aware query support.
- Queries/display helpers live in `src/lib/model/relationshipQueries.ts`. `getRelationshipsForConcept` combines direct participation and represented relationships, but display support is narrower than the model.
- There is no instance-participant variant in the current union. Historical names such as `RelationshipRecord`, `backwardPattern`, and `inverseOf` are not migration instructions.
- Relationship behavior was accepted as sufficient for the refactor. Additional features require deliberate roadmap work. “Event concepts” is not an owner-approved occurrence schema.

## 4. Interactions to preserve and regression-test

These are source-inspected behaviors and verification targets, not a guarantee that every edge case has passed browser testing:

- Canvas double-click creation; double-Enter creation, including the title-input flow.
- Card placement/resizing, single/group selection and dragging, marquee selection.
- Pan/zoom, focus, framing, and grid arrangement.
- Navigation saves the outgoing camera, clears interaction/selection/menu state, waits for the view update, and applies the incoming camera or frames content. `openRootCanvas()` now **awaits** preparation; root framing remains distinct from per-instance camera restoration.
- Recursive child trees and approximately 300 ms hold-to-drag, including timer cancellation. Card trees receive child-drag callbacks; sidebar trees currently do not.
- Drop-target detection uses CSS classes and `data-instance-id`/`data-concept-id`. Treat those as behavioral interfaces.
- Double-clicking blank child-area space can open its parent card; actual tree rows/toggles are deliberately ignored by that handler.
- Shared property/tag updates and local sidebar drafts. Tree expansion remains independent per component.
- Paste import trims lines, removes blanks, and skips duplicate titles within the batch case-insensitively. More than 25 parsed items requires confirmation. Do not silently change that policy to address the broader duplicate-title goal.
- Importing another occurrence's immediate children, sidebar resizing, refresh persistence, and existing canvas/table-placeholder switching.

Do not silently implement missing tree opening, tag navigation, or other features while moving code.

## 5. Product intent and design boundaries

Use `Updates-Ideas.md` for priorities. The following preserves owner decisions and context, not blanket feature authorization.

### Spatial focus and multiple representations

- “Getting things out of your view” matters: filing an instance under another context should reduce clutter without erasing information. Nesting serves attention, not just taxonomy.
- Support purposeful mouse interaction and eventual fast keyboard-driven capture, search/typeahead, and tagging. Typing, focus, drag/drop, and possibly bulk tagging should work together; historical shortcuts such as `T -> T -> T` are not settled.
- Future move workflows should distinguish moving an existing instance, creating another occurrence, importing children, and merely navigating.
- Canvas, tree, and table should be different representations of the same information. A tree is not the entire knowledge model, and spatial containment is not an arbitrary semantic relationship graph.
- Table properties should become columns; tags should appear together in a familiar multi-tag column. Tag display names do not replace stored IDs.
- A table above the canvas with an adjustable divider is a confirmed direction, including all-table/all-canvas positions. Row identity, repeated instances, selection/filter synchronization, column choice, and result placement remain open.
- Lists, timelines, manual ordering, and exports are possible additional representations; bullets do not automatically become Concepts.

### Developing information

- The meeting workflow `Client Meetings -> ClientName -> Week1 -> Date1` illustrates evolving notes and child ideas during capture, rather than requiring complete modeling first.
- An idea can become “Defunct” or “Not Used” without losing its useful kernel or history. These examples do not establish a status enum or workflow engine.
- Notes are a definite goal, most recently described on the Concept. An expandable text/Markdown area is plausible; contextual variants, editor format, ownership details, and attachments remain open. Do not introduce instance notes based only on older recollections.
- Adaptive cards should reveal more useful information as they grow, with user-controlled collapse/view modes and remembered state. Current size-based collapse is not the full planned system; breakpoints and ownership remain design questions.
- Interactive ConceptCard previews remain a **major future feature**: hovering an instance representation, including a tree row, should eventually expose an interactive card with children and notes when available. Removing retired preview code did not reject that requirement. Placement, delay, dimensions, and interaction need design.

### Longer-term directions

- Audience includes the owner, storytellers, researchers, note takers, knowledge keepers, and hands-on/data-oriented users. SkuDB is a recalled inspiration, not permission to copy employer code or data.
- Rich customization is desired: card/canvas/drop-area appearance, reusable themes, and possibly themes per context. This does not approve a plugin framework or new persisted theme fields by implication.
- Images/video/web previews should eventually behave as spatial, draggable, resizable, animated, fileable content. Images may need a special entity. Pasted links creating visual screenshots are desired; storage/entity semantics are open. Playwright is an explored tool, not a settled architecture.
- Optional dates/custom labels and timelines are directions, not an approved `Date/Timeless`, `DateLabel`, birthday field, or event schema.
- Tags as types/supertags were discussed, but no inheritance or required-property rules were chosen.
- More arrangement tools, including selection-scoped layout and stack/cascade, are desired but historically low priority. User-controlled property ordering is not sufficiently specified.
- A temporary, clearable idea workspace is a confirmed later direction; persistence until flushing, lifecycle, and filing behavior need decisions.
- Importance/soft grouping may be instance-level visual emphasis; no schema is approved. Import/export needs explicit ID, metadata, recursion, ordering, and format decisions.
- Undo/redo is not permanently forbidden, but a full undo system was not an initial requirement.
- Drawing remains possible. Distinguish freehand marks from stored relationship connectors; historical point-based drawing discussion is not permanent law.
- Desktop packaging, hosting, sync, collaboration, and long-term storage remain open. Retain current storage unless a change is explicitly requested.

Do not repeat the old owner interview or reopen the settled one-parent-per-instance and title-reassignment decisions. Ask unresolved questions only when they affect the requested work.

## 6. Known unfinished features and hazards

- Table view is a workspace placeholder; the old empty table component files were deleted. Search/discovery, the split table/canvas view, and notes remain future work.
- `Editor.openTagCanvas()` is a logging stub. Same-title Concept selection and occurrence navigation remain incomplete.
- `TreeViewNode.svelte` supports expansion and optional pointer dragging, but not complete instance-opening double-click/keyboard behavior.
- Title-conflict responses/state exist, but current components do not render a resolving chooser/dialog. The old empty confirmation component was removed.
- Interactive card hover previews are not implemented. Basic size-based card collapse is not a configurable detail/view system.
- Relationship participant display is not full navigation; relationship-type participants and represented-only display cases have limitations.
- Missing camera zoom still defaults to **0** in normalization and **1** during creation. Do not silently normalize that discrepancy away; it is a behavior/data-default decision.
- Root/context labels still include placeholders; the root sidebar title is read-only.
- Whole-file JSON writes do not provide transactional or concurrent-write safety. Scoped context and successful builds do not establish multi-user or production readiness.
- Earlier `ERR_CONNECTION_REFUSED` reports coincided with the Vite server being down on port 5173. Distinguish server availability from source errors. The reported browser message-channel error may be extension-related; do not treat that attribution as proven.

## 7. Data protection

These are actual user data, not fixtures:

```text
src/lib/data/concepts.json
src/lib/data/concept_instances.json
src/lib/data/concept_relationships.json
src/lib/data/relationship_definitions.json
data-backup-do-not-delete-project-level-data.zip
```

The archive is currently at the **project root**, not `src/lib/`. Preserve it wherever the owner places it. Historical refactor notes record its earlier location and an external backup; neither proves a backup matches today's live data.

- Make and verify an external backup before mutation-heavy work. Never regenerate IDs, replace real data with fixtures, or delete backups as incidental cleanup.
- Repository paths currently resolve from `process.cwd()` to `src/lib/data/`; changing code organization must not redirect storage.
- Do not run mutation tests against live JSON or copy personal records into docs/logs. Use temporary isolated storage for mutation tests.
- Geometry and camera interactions can write data too; “display-only” source changes do not make every browser interaction read-only.
- Stop the application before restoring. Restore related files together after operations that changed both Concepts and instances. Never overwrite desired edits made after the backup.
- For property rollback, restore an original value if the key existed; remove the key only if it was originally absent. Do not delete unrelated metadata.
- The owner authorized project-wide Prettier formatting, including JSON. Formatting changes do not authorize semantic data changes; separate the two in reviews. Do not discard existing formatting or user edits to make a diff smaller.

## 8. Validation and environment

Run commands from the project root using its existing npm scripts:

| Command            | Purpose                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| `npm run check`    | SvelteKit sync and Svelte/TypeScript check                              |
| `npm run lint`     | Prettier check, then ESLint                                             |
| `npm run build`    | Production build using `adapter-node`                                   |
| `npm run format`   | Project-wide Prettier write; use a targeted invocation for narrow edits |
| `npm run test:run` | Vitest, non-watch mode; confirm tests exist before interpreting results |
| `npm run dev`      | Development server for intentional manual use                           |

Verified during this update on **2026-10-17**:

- `npm run check`: **0 errors, 19 warnings in 9 files**. These are existing accessibility/CSS-related warnings, not a blanket allowance for new warnings.
- `npm run lint`: passed, including formatting and ESLint. The two missing each-block keys and unused screenshot browser context reported earlier were fixed.
- `npm run build`: passed. The build also reports existing Svelte warnings and an empty environment chunk notice.
- No test/spec files were found under `src/`; Vitest is installed, but that is not evidence of automated regression coverage. No mutation tests or browser smoke tests were run for this guide update.

The checkout is in WSL Ubuntu at `/home/cory/development/concept-editor`, accessed from Windows through `\\wsl.localhost\Ubuntu\home\cory\development\concept-editor`. Native WSL Node/npm (owner's `asdf` environment) is the verified toolchain. Windows-side npm from a UNC path can fail independently of the source. If editor/file-tool output conflicts with recent writes, verify using native WSL reads before editing; stale snapshots previously caused trouble.

For behavior changes, test the affected interactions in Section 4 and check browser requests/errors and persistence after reload using protected/disposable data. Never mark remaining checklist items complete from static inspection alone. Keep pre-existing failures separate from regressions.

## 9. Documentation and source guide

- **Current source** establishes implementation; **owner decisions** establish intent. Keep both separate from historical suggestions.
- **`AGENTS.md`** supplies current working rules and durable decisions.
- **`refactor-checklist.md`** records implemented structural steps and pending manual checks. Its old introductory “execution plan” wording and old paths are historical context, not instructions to redo completed work.
- **`docs/refactor-notes.md`** records phase decisions and checks at the time they happened. For example, its final byte-for-byte backup comparison predates later edits/formatting; do not repeat it as a current verification.
- **`Updates-Ideas.md`** supplies owner-prioritized product work. Change priority/status only when the owner decides or implementation is verified; do not discount priorities because the document originated in recovered ideas.
- **`rejected_ideas.csv`** preserves rejected historical ideas separately.
- **`docs/tutorial/`** documents the current architecture by subject, with concrete traces, diagrams, optional exercises, separate solutions, and concise summaries. Use straightforward textbook/documentation prose, not literature analogies, humor, overt teaching scripts, or reflection questionnaires. Explain responsibilities and main functions before helpers, connect related ideas through normal prose and links, and keep exercises/solutions consistent when APIs change. Avoid CSS instruction except behavioral interfaces. Keep Markdown consistent for possible PDF assembly.

For the next task, inspect the relevant live files, implement within the requested scope, preserve data and interactions, and record what changed and what was actually tested. Do not prescribe another architecture overhaul merely because alternatives were discussed.

## 10. Communication principles

- Evaluate the owner's ideas, questions, and criticisms independently. Avoid reflexive agreement, flattery, unnecessary reassurance, and praise. Do not manufacture disagreements or suggestions merely to appear constructive.
- Communicate directly and naturally. Avoid excessive conversational framing, restating the question, announcing obvious intentions, or summarizing what has already been established.
- Favor understanding over procedural compliance when explaining technical concepts. Explain what significant operations do, why they work, and how they relate to the larger mechanism, rather than merely prescribing steps.
- Distinguish established facts, interpretations, and speculation. Acknowledge uncertainty without excessive hedging, and correct mistakes without defensiveness or exaggerated apologies.
- Match explanation depth to the question and the owner's demonstrated understanding. Do not oversimplify complex subjects or elaborate on details that are already understood.
- Do not infer lasting communication preferences from isolated interactions. Follow explicit preferences and instructions without constructing an unnecessarily rigid model of the owner.

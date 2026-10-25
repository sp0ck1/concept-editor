# Concept Editor codebase guide

This guide explains the application's data model, state ownership, interface, and persistence. It is organized by subject so it can be read in order or used as a reference. Each chapter identifies the relevant source files, explains the design, and follows concrete behavior through the code.

The focus is the application rather than CSS or a general introduction to TypeScript and Svelte. Framework features are explained where they affect the behavior being discussed.

## Contents

### Application overview

1. [Application architecture](01-architecture.md) — source organization, server/browser boundaries, and the complete loading and editing paths.

### Information model

2. [Concepts and instances](02-concepts-and-instances.md) — shared identity, contextual placement, creation inputs, normalization, and `ConceptCardView`.
3. [Relationships](03-relationships.md) — participants, relationship kinds and occurrences, `RelationshipDefinition`, queries, and display limits.

### Editor state and data flow

4. [Editor and context](04-editor-and-context.md) — the workspace's shared object, reactive state, commands, and component-local responsibilities.
5. [Loading and derived cards](05-loading-and-derived-cards.md) — repositories, page data, stable Editor refresh, indexes, joins, and current-canvas filtering.

### Interface and spatial behavior

6. [Cards](06-cards.md) — card data versus the component, event dispatch, local focus, hold timers, and derived presentation state.
7. [Canvas](07-canvas.md) — coordinates, camera transforms, selection, dragging, resizing, and view commands.
8. [Trees and containment](08-trees-and-containment.md) — parent-instance queries, recursive rendering, expansion, and optional child dragging.
9. [Navigation and cameras](09-navigation-and-cameras.md) — root and instance navigation, sequencing, breadcrumbs, and camera persistence.

### Commands and persistence

10. [Creation and title editing](10-creation-and-title-editing.md) — linked record creation, title identity decisions, input behavior, refresh, and focus.
11. [Properties and tags](11-properties-and-tags.md) — shared metadata, sidebar drafts, tag identity, and mutation paths.
12. [HTTP and persistence](12-http-and-persistence.md) — request handling, service/repository boundaries, JSON writes, and invalidation.
13. [Integration](13-integration.md) — sharing a spatial creation command between a button and the existing keyboard path.

## Examples and exercises

Examples distinguish current implementation from proposed changes. An exercise feature is not necessarily present in the application. Exercises are optional; explanations do not require completing earlier source changes.

Each chapter has a separate [worked solution](solutions/README.md). The changes are small enough to retain together or remove individually. The one explicit implementation dependency is chapter 13: it revises chapter 10's New Card command and button rather than adding a second version.

| Chapter                    | Exercise                                                         |
| -------------------------- | ---------------------------------------------------------------- |
| Architecture               | Document the instance-loading path                               |
| Concepts and instances     | Display the number of occurrences of a Concept                   |
| Relationships              | Display the selected relationship count                          |
| Editor and context         | Add a sidebar visibility command                                 |
| Loading and derived cards  | Display placements and distinct Concepts in the current canvas   |
| Cards                      | Display Concept and instance IDs                                 |
| Canvas                     | Add Reset View                                                   |
| Trees and containment      | Display immediate child counts                                   |
| Navigation and cameras     | Display current canvas depth                                     |
| Creation and title editing | Add a New Card button at the viewport-center anchor              |
| Properties and tags        | Display property and tag counts                                  |
| HTTP and persistence       | Temporarily write a `reviewed` property through the existing API |
| Integration                | Move and reuse the New Card command in the canvas controller     |

No exercise requires adding CSS. Existing classes and data attributes are discussed when they are behavioral interfaces used by event or drop-target code.

## Data safety

The four JSON files under `src/lib/data/` contain real project data, not fixtures:

- `concepts.json`
- `concept_instances.json`
- `concept_relationships.json`
- `relationship_definitions.json`

Source reading and static checks do not intentionally mutate these records. Browser interactions can: dragging and resizing save geometry, navigation can save cameras, and creation or title reassignment can write both Concepts and instances. A display-only source change does not make all interaction testing read-only.

Use a disposable project copy with isolated storage for browser mutation tests. Repository paths resolve relative to the running process's project root, so the copy must run from its own root rather than the original checkout. Do not share or symlink its data files to live storage.

Before mutation-heavy work in any dataset that must be retained, stop writers and make and verify a current external backup. The chapter-specific procedures identify the files affected. Preserve the root-level `data-backup-do-not-delete-project-level-data.zip`; its existence does not establish that it matches today's data.

For rollback:

- Stop the application before restoring files.
- Restore related Concept and instance files together when the operation changed both.
- Never overwrite desired changes made after the backup.
- If a temporary property existed beforehand, restore its original value. Remove the key only if it was originally absent.
- Removing a button or deleting a test instance does not undo all of its persisted effects.

## Validation

Run commands from the project root using native WSL Node/npm for this checkout:

```sh
npm run check
npm run lint
npm run build
```

These validate types, formatting/lint rules, and compilation. They do not establish correct browser interaction or safe persistence. The current source has existing accessibility/CSS warnings; distinguish them from new errors. Exercise-specific manual checks describe behavior separately.

Keep source edits isolated and review the diff before removing an exercise. Do not use destructive resets to discard unrelated work.

## Implementation boundaries

The guide describes the current architecture, not a complete product specification. Table view remains a placeholder. Notes, search, full title-conflict selection, full tree-row opening, tag navigation, and interactive card previews remain unfinished. Definitions and model fields may support more than the current UI implements.

The live source remains authoritative if it differs from an excerpt. `AGENTS.md` records preservation rules; `Updates-Ideas.md` records product priorities; the refactor checklist and notes retain the history and pending manual verification.

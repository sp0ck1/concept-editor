# 12. HTTP and persistence — solution

## Use isolated storage before applying the change

Complete [Protect data and isolate execution](../12-http-and-persistence.md#protect-data-and-isolate-execution) first:

1. Stop the live app and other data writers.
2. Back up all four JSON files to a fresh directory outside the checkout and verify every copy with `cmp`. Do not overwrite the project-level archive or an earlier backup.
3. Make a separate disposable project copy at `/tmp/concept-editor-tutorial-12/workspace` and confirm its `src/lib/data` is independent, not linked to live storage.
4. Edit and run only that copy. Start its server from its own root, using the chapter's distinct port 5174. Do not click the exercise button in a live-workspace tab.

The external backup is a safety measure, not permission to test against live files. Neither earlier display exercise is required.

## Add the button

In the disposable copy's `src/lib/components/editor/sidebar/ConceptSidebar.svelte`, add the button inside the existing Properties heading:

```svelte
<div class="sidebar-properties-heading">
	<div class="sidebar-label">Properties</div>
	<button
		type="button"
		onclick={() =>
			editor.setProperties(sidebarCard, {
				...(sidebarCard.concept.properties ?? {}),
				reviewed: 'yes'
			})}
	>
		Mark reviewed
	</button>
</div>
```

Keep any unrelated existing markup in that heading. Add no imports, CSS, new route, client function, model field, or Editor wrapper.

`sidebarCard` is already declared within the current-owner branch, so the button is not rendered at root. The callback reads its current properties when clicked rather than capturing a separate stale property object.

## Preserve the complete property object

The spread retains existing keys; the final assignment sets only `reviewed` to `'yes'` within that replacement object. This call would be wrong:

```ts
editor.setProperties(sidebarCard, { reviewed: 'yes' });
```

`setProperties` replaces the complete record. Omitting the spread would erase other properties. If `reviewed` already exists, the correct solution overwrites its value but does not add another key. That is why rollback must record its original presence and exact value first.

The key is flexible exercise metadata, not a new domain status field.

## Request and refresh path

1. `Editor.setProperties` assigns the object locally, then calls `Editor.updateConcept`.
2. Client `updateConceptRecord` sends `PATCH /api/concepts` with `{ id, properties }`.
3. The route follows the non-title branch. It accepts an object for `properties` but does not validate every value as a string.
4. Repository `updateConcept` finds the Concept and replaces its property object. `saveAllConcepts` rewrites the Concept collection.
5. After HTTP success, `Editor.updateConcept` calls `invalidateAll()`.
6. The page loader returns all four record collections. `ConceptEditor.svelte` passes them to the stable editor's `replaceData` inside `untrack`.
7. Card views, the property list, and an optional metadata summary derive from the refreshed records.

The server path uses the disposable copy because repository paths resolve from `process.cwd()`. The server response is not manually distributed to every card.

On client failure, `Editor.updateConcept` restores the last-loaded snapshot, exposes a visible error through `saveError`, and returns `false` without invalidation. This avoids a failing loader replacing the workspace while offline. The last-loaded snapshot is not a new server read: if the request was saved but its response was lost, reload when the server is available to confirm the final state.

## Verification

From the disposable project's root, run:

```sh
npm run check
npm run build
```

For an optional manual trace, start the disposable server as described in the chapter and choose a Concept there. Privately record its ID, whether `reviewed` existed, and its exact value if present. Do not print private records in documentation or logs.

Check:

| Initial state                    | After click           | Property count   |
| -------------------------------- | --------------------- | ---------------- |
| No `reviewed` key                | `reviewed: yes`       | Increases by one |
| `reviewed` exists with any value | `reviewed: yes`       | Unchanged        |
| Button clicked again             | Still `reviewed: yes` | Unchanged        |

Use only the disposable store if constructing additional cases. Confirm all unrelated properties remain intact, the PATCH succeeds, the loader refresh follows, and a browser reload retains the value. Root must omit the button.

If previous display exercises are present, the metadata summary reflects the key count and the relationship count remains unchanged. Their absence does not affect this solution.

Do not run automated mutation tests against live data. With no intervening intentional live edits, the original workspace's four JSON files should still match the external backup. A mismatch is a reason to investigate, not to overwrite the originals automatically.

## Cleanup and rollback

Remove only the added button. Preserve the Properties label and all unrelated component work.

For the tested Concept **in the disposable store**:

- If `reviewed` originally existed, restore its exact old value through the existing property UI, including an empty value if that was the original.
- If it was originally absent, remove only that key.
- Preserve every unrelated later edit. If someone intentionally changed `reviewed` itself after the exercise, decide what to retain before overwriting it.

Removing the button does not revert data. Conversely, restoring the entire backed-up file could erase desired later changes and is not the normal cleanup procedure. The live workspace requires no restoration because it was not used for the test.

Stop the disposable server afterward. Keep the verified external backup until the result is checked; do not delete or replace the project's existing archive.

## Summary

One button reuses the existing complete-property update path. The solution preserves other keys, verifies persistence rather than only local display, and confines temporary data changes to an isolated copy with field-specific rollback.

- [HTTP and persistence](../12-http-and-persistence.md)
- [Properties and tags](../11-properties-and-tags.md)
- [Integration](../13-integration.md)

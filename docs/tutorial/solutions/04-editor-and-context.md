# Editor and context: sidebar command

[Chapter](../04-editor-and-context.md#exercise-add-a-sidebar-visibility-command)

## Editor command

In `src/lib/components/editor/Editor.svelte.ts`, add a method to the class near the other UI commands:

```ts
toggleSidebar() {
	this.sidebarVisible = !this.sidebarVisible;
}
```

The existing `sidebarVisible` field already uses `$state`, and the workspace already reads it to decide whether to render the sidebar.

## Topbar button

In `src/lib/components/editor/canvas/CanvasTopbar.svelte`, add this button inside the existing `concept-topbar-actions` element, outside the breadcrumb navigation:

```svelte
<button type="button" onclick={() => editor.toggleSidebar()}>
	{editor.sidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'}
</button>
```

The component already retrieves the Editor through context. No new prop or import is needed. The arrow calls the method on `editor`, preserving its receiver.

## Update path

```text
Button click
  → Editor.toggleSidebar()
  → sidebarVisible changes
  → workspace conditional and button label update
```

The command changes only in-memory presentation state. It does not call a client or write JSON. The same Editor remains available after the sidebar is removed because the provider is the workspace, not the sidebar.

## Verification and removal

Run `npm run check`. The button should alternate between Hide Sidebar and Show Sidebar, and remain accessible in both states. Reloading restores the default visible state.

Remove only the method and button to undo the exercise. Other topbar exercises can remain. There is no data rollback for this visibility command.

## Summary

Context supplies the existing Editor; the command changes one reactive field; components reading that field update. Shared behavior does not require forwarding a callback through the component tree.

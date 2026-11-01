<script lang="ts">
	import { onMount } from 'svelte';
	import { getEditorContext } from './EditorContext';
	import type { TitleConflictCandidate } from './EditorTypes';
	import type { TitleConflictResolution } from '$lib/model/TitleConflictMode';

	const editor = getEditorContext();
	let dialog: HTMLDialogElement;
	let source = $state<TitleConflictCandidate | null>(null);
	let destination = $state<TitleConflictResolution['destination']>('current-instance');
	let propertySelections = $state<Record<string, boolean>>({});
	let copyNotes = $state(true);
	let copyChildren = $state(false);
	let retainChildMetadata = $state(true);
	const candidates = $derived(editor.getTitleConflictCandidates());
	const currentInstance = $derived(
		editor.titleConflict ? editor.getCard(editor.titleConflict.instanceId)?.instance : undefined
	);
	const sourceProperties = $derived(Object.entries(source?.instance?.properties ?? {}));
	const sourceNotes = $derived(source?.instance?.notes.text ?? '');
	const replacesNotes = $derived(
		destination === 'current-instance' && Boolean(currentInstance?.notes.text)
	);

	onMount(() => {
		dialog.showModal();
	});

	function cancel() {
		if (!editor.titleConflictSaving) editor.cancelTitleConflict();
	}

	function choose(candidate: TitleConflictCandidate) {
		if (editor.titleConflictSaving) return;
		source = candidate;
		destination = 'current-instance';
		propertySelections = Object.fromEntries(
			Object.keys(candidate.instance?.properties ?? {}).map((key) => [key, true])
		);
		copyNotes = Boolean(candidate.instance);
		copyChildren = Boolean(candidate.instance && candidate.childrenCount > 0);
		retainChildMetadata = true;
	}

	function selectProperties(selected: boolean) {
		propertySelections = Object.fromEntries(sourceProperties.map(([key]) => [key, selected]));
	}

	function confirm() {
		if (!source || editor.titleConflictSaving) return;
		const resolution: TitleConflictResolution = {
			targetConceptId: source.concept.id,
			...(source.instance ? { sourceInstanceId: source.instance.id } : {}),
			destination,
			propertyKeys: source.instance
				? sourceProperties.filter(([key]) => propertySelections[key]).map(([key]) => key)
				: [],
			copyNotes: Boolean(source.instance && copyNotes),
			copyChildren: Boolean(source.instance && copyChildren),
			retainChildMetadata: Boolean(source.instance && retainChildMetadata)
		};
		void editor.resolveTitleConflict('use-existing', resolution);
	}

	function replacementValue(key: string, value: string): string | null {
		const properties = currentInstance?.properties;
		return destination === 'current-instance' &&
			properties &&
			Object.hasOwn(properties, key) &&
			properties[key] !== value
			? properties[key]
			: null;
	}
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="title-conflict-heading"
	aria-busy={editor.titleConflictSaving}
	oncancel={(event) => {
		event.preventDefault();
		cancel();
	}}
	onkeydown={(event) => event.stopPropagation()}
	onkeyup={(event) => event.stopPropagation()}
>
	<h2 id="title-conflict-heading">{source ? 'Use an existing Concept' : 'Choose a Concept'}</h2>

	{#if !source}
		<p>One or more Concepts titled “{editor.titleConflict?.title}” already exist.</p>
		<p>Create a new Concept, or use an existing Concept for this card.</p>
		<div class="candidates" aria-label="Existing Concepts">
			{#each candidates as candidate (candidate.instance?.id ?? candidate.concept.id)}
				<button
					type="button"
					class="candidate"
					disabled={editor.titleConflictSaving}
					onclick={() => choose(candidate)}
				>
					<span class="path" title={candidate.path}>
						{#if candidate.instance}
							<span class="ancestors"
								>{candidate.path.endsWith(candidate.concept.title)
									? candidate.path.slice(0, candidate.path.length - candidate.concept.title.length)
									: candidate.path}</span
							><span class="final-title">{candidate.concept.title}</span>
						{:else}
							{candidate.path}
						{/if}
					</span>
					<span>properties: {candidate.propertiesCount}</span>
					<span>children: {candidate.childrenCount}</span>
				</button>
			{/each}
		</div>
	{:else}
		<p class="selected-path" title={source.path}>{source.path}</p>
		<fieldset disabled={editor.titleConflictSaving}>
			<legend>Destination</legend>
			<label
				><input type="radio" bind:group={destination} value="current-instance" /> Use it for this card</label
			>
			<label
				><input type="radio" bind:group={destination} value="new-instance" /> Keep this card and create
				another occurrence</label
			>
		</fieldset>

		{#if source.instance}
			<fieldset disabled={editor.titleConflictSaving}>
				<legend>Copy instance properties</legend>
				<div class="selection-actions">
					<button type="button" onclick={() => selectProperties(true)}>Select All</button>
					<button type="button" onclick={() => selectProperties(false)}>Select None</button>
				</div>
				{#if sourceProperties.length === 0}
					<p>No instance properties to copy.</p>
				{/if}
				{#each sourceProperties as [key, value] (key)}
					<label class="property-row">
						<input type="checkbox" bind:checked={propertySelections[key]} />
						<span class="property-key">{key}</span>
						<span class="property-value">{value}</span>
						{#if replacementValue(key, value) !== null}
							<small>Replaces current value “{replacementValue(key, value)}” if selected.</small>
						{/if}
					</label>
				{/each}
				{#if destination === 'current-instance'}
					<p class="hint">Unselected properties on this card are preserved.</p>
				{/if}
			</fieldset>

			<fieldset disabled={editor.titleConflictSaving}>
				<legend>Instance notes</legend>
				<label
					><input type="checkbox" bind:checked={copyNotes} />
					{replacesNotes ? 'Replace current notes' : 'Copy notes'}</label
				>
				<div class="notes-preview" aria-label="Source notes">
					{sourceNotes || '(No source notes)'}
				</div>
				{#if copyNotes && !sourceNotes && replacesNotes}
					<p class="warning">The source notes are empty. Copying them clears the current notes.</p>
				{/if}
			</fieldset>

			<fieldset disabled={editor.titleConflictSaving}>
				<legend>Children</legend>
				<label><input type="checkbox" bind:checked={copyChildren} /> Copy children</label>
				<p class="hint">Copies the entire subtree, including all descendants.</p>
				<label
					><input type="checkbox" bind:checked={retainChildMetadata} disabled={!copyChildren} /> Retain
					child metadata</label
				>
				<p class="hint">Applies to every copied descendant.</p>
				{#if destination === 'current-instance'}
					<p class="hint">
						Existing children on this card are preserved; copied children are appended.
					</p>
				{/if}
			</fieldset>
		{:else}
			<p>
				This Concept is not placed. There are no instance properties, notes, or children to copy.
			</p>
		{/if}
	{/if}

	{#if editor.titleConflictError}
		<p class="error" role="alert">{editor.titleConflictError}</p>
	{/if}

	<div class="actions">
		{#if source}
			<button type="button" disabled={editor.titleConflictSaving} onclick={() => (source = null)}
				>Back</button
			>
		{/if}
		<button type="button" disabled={editor.titleConflictSaving} onclick={cancel}>Cancel</button>
		{#if source}
			<button type="button" disabled={editor.titleConflictSaving} onclick={confirm}
				>{editor.titleConflictSaving ? 'Saving…' : 'Use existing Concept'}</button
			>
		{:else}
			<button
				type="button"
				disabled={editor.titleConflictSaving}
				onclick={() => editor.resolveTitleConflict('create-duplicate')}>Create new Concept</button
			>
		{/if}
	</div>
</dialog>

<style>
	dialog {
		box-sizing: border-box;
		width: min(46rem, calc(100vw - 2rem));
		max-height: calc(100dvh - 2rem);
		overflow: auto;
		padding: 1rem;
		border: 1px solid #443d30;
		border-radius: 0;
		background: #fff9e9;
		color: #29251e;
		font-size: 0.875rem;
	}

	dialog::backdrop {
		background: rgb(30 26 18 / 35%);
	}

	h2 {
		margin: 0 0 0.75rem;
		font-size: 1.1rem;
	}

	p {
		margin: 0.5rem 0;
	}

	button {
		padding: 0.35rem 0.6rem;
		border: 1px solid #665d4b;
		border-radius: 0;
		background: #f4ecd7;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	button:hover:not(:disabled) {
		background: #e8ddbf;
	}

	button:focus-visible,
	input:focus-visible {
		outline: 2px solid #55472b;
		outline-offset: 2px;
	}

	button:disabled {
		cursor: default;
		opacity: 0.55;
	}

	input {
		accent-color: #665735;
	}

	.candidates {
		margin: 0.75rem 0;
		border-top: 1px solid #665d4b;
	}

	.candidate {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		gap: 0.75rem;
		width: 100%;
		border-top: 0;
		text-align: left;
	}

	.path {
		display: flex;
		min-width: 0;
	}

	.ancestors {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.final-title {
		flex-shrink: 0;
		min-width: 0;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.selected-path,
	.property-key,
	.property-value {
		overflow-wrap: anywhere;
	}

	fieldset {
		min-width: 0;
		margin: 0.75rem 0;
		padding: 0.5rem;
		border: 1px solid #8b8068;
	}

	label {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		padding: 0.25rem 0;
	}

	.selection-actions,
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.selection-actions {
		margin-bottom: 0.4rem;
	}

	.actions {
		justify-content: flex-end;
		margin-top: 1rem;
	}

	.property-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) minmax(0, 2fr);
		border-top: 1px solid #c0b59a;
	}

	.property-row small {
		grid-column: 2 / -1;
	}

	.hint,
	small {
		font-size: 0.8rem;
	}

	.notes-preview {
		max-height: 8rem;
		overflow: auto;
		padding: 0.4rem;
		border: 1px solid #c0b59a;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		background: #fffdf5;
	}

	.warning,
	.error {
		color: #7b281b;
	}

	@media (max-width: 32rem) {
		.candidate {
			grid-template-columns: 1fr 1fr;
			gap: 0.25rem;
		}

		.path {
			grid-column: 1 / -1;
		}
	}
</style>

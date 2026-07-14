<script lang="ts">
	import ConceptTagsPreview from '$lib/components/ConceptTagsPreview.svelte';
	import type { Concept } from '$lib/types/Concept';
	import type { ConceptCardView } from '$lib/types/ConceptCardView';
    import TreeView from '$lib/components/tree/TreeView.svelte';
	import type { ConceptRelationship } from '$lib/types/ConceptRelationship';
	import type { RelationshipDefinition } from '$lib/types/RelationshipDefinition';
	import { getRelationshipDisplayParts } from '$lib/queries/conceptRelationshipQueries';
	
	let {
		sidebarTab,
		currentCanvasOwnerCard,
		sidebarNewTag,
		getTagConcepts,
		onSidebarTabChange,
		onTitleKeydown,
		onTitleBlur,
		onSidebarNewTagChange,
		onSidebarTagAdd,
		onTagOpen,
		onTagRemove,
		onGoUpOneLevel,
		onPropertiesChange,
		getConceptChildren,
		getRootConceptInstances,
		relationships,
		relationshipDefinitions,
		getConceptById,
		onRelationshipConceptOpen,
	} = $props<{
		sidebarTab: 'concept' | 'tree';
		currentCanvasOwnerCard: ConceptCardView | null;
		sidebarNewTag: string;
		getTagConcepts: (tagConceptIds: string[]) => Concept[];
		onSidebarTabChange: (tab: 'concept' | 'tree') => void;
		onTitleKeydown: (event: KeyboardEvent, card: ConceptCardView) => void;
		onTitleBlur: (event: FocusEvent, card: ConceptCardView) => void;
		onSidebarNewTagChange: (value: string) => void;
		onSidebarTagAdd: (card: ConceptCardView) => void;
		onTagOpen: (tagConcept: Concept) => void;
		onTagRemove: (card: ConceptCardView, tagConcept: Concept) => void;
		onGoUpOneLevel: () => void;
		onPropertiesChange: (card: ConceptCardView, properties: Record<string, string>) => void;
		getConceptChildren: (conceptInstanceId: string) => ConceptCardView[];
		getRootConceptInstances: () => ConceptCardView[];
		relationships: ConceptRelationship[];
		relationshipDefinitions: RelationshipDefinition[];
		getConceptById: (conceptId: string) => Concept | null;
		onRelationshipConceptOpen: (concept: Concept) => void;
		
	}>();

let newPropertyKey = $state('');
let newPropertyValue = $state('');

$effect(() => {
	currentCanvasOwnerCard?.instance.id;

	newPropertyKey = '';
	newPropertyValue = '';
});

function updatePropertyKey(
	card: ConceptCardView,
	oldKey: string,
	nextKey: string,
	input: HTMLInputElement
) {
	const trimmedKey = nextKey.trim();

	if (!trimmedKey || trimmedKey === oldKey) {
		input.value = oldKey;
		return;
	}

	const properties = card.concept.properties ?? {};

	if (trimmedKey in properties) {
		input.value = oldKey;
		return;
	}

	const nextProperties = Object.fromEntries(
		Object.entries(properties).map(([key, value]) =>
			key === oldKey ? [trimmedKey, value] : [key, value]
		)
	);

	onPropertiesChange(card, nextProperties);
}

function updatePropertyValue(
	card: ConceptCardView,
	key: string,
	value: string
) {
	onPropertiesChange(card, {
		...(card.concept.properties ?? {}),
		[key]: value
	});
}

function removeProperty(card: ConceptCardView, keyToRemove: string) {
	const nextProperties = Object.fromEntries(
		Object.entries(card.concept.properties ?? {}).filter(
			([key]) => key !== keyToRemove
		)
	);

	onPropertiesChange(card, nextProperties);
}

function commitNewProperty(card: ConceptCardView) {
	const key = newPropertyKey.trim();

	if (!key) {
		return;
	}

	const properties = card.concept.properties ?? {};

	if (key in properties) {
		return;
	}

	onPropertiesChange(card, {
		...properties,
		[key]: newPropertyValue
	});

	newPropertyKey = '';
	newPropertyValue = '';
}

function handleNewPropertyKeydown(event: KeyboardEvent) {
	if (event.key !== 'Enter') {
		return;
	}

	event.preventDefault();

	const row = (event.currentTarget as HTMLInputElement).closest(
		'.sidebar-property-row'
	);

	const valueInput =
		row?.querySelector<HTMLInputElement>('.sidebar-property-value');

	valueInput?.focus();
}

function handleNewPropertyValueKeydown(
	event: KeyboardEvent,
	card: ConceptCardView
) {
	if (event.key !== 'Enter') {
		return;
	}

	event.preventDefault();
	commitNewProperty(card);
}

function blurOnEnter(event: KeyboardEvent) {
	if (event.key === 'Enter') {
		event.preventDefault();
		(event.currentTarget as HTMLInputElement).blur();
	}


}

</script>

<aside class="concept-sidebar" aria-label="Concept sidebar">
	<div class="sidebar-tabs" role="tablist" aria-label="Sidebar tabs">
		<button
			type="button"
			role="tab"
			aria-selected={sidebarTab === 'concept'}
			class:active={sidebarTab === 'concept'}
			onclick={() => onSidebarTabChange('concept')}
		>
			Concept
		</button>

		<button
			type="button"
			role="tab"
			aria-selected={sidebarTab === 'tree'}
			class:active={sidebarTab === 'tree'}
			onclick={() => onSidebarTabChange('tree')}
		>
			Tree
		</button>
	</div>

	<!-- if sidebarTab is Concept vs. is sidebarTab is Tree -->
	 <!-- Maybe you should be able to rename Concept to something else. Or change type. I did want everything to have type. Hmmmmmmm -->
	{#if sidebarTab === 'concept'}
		<div class="sidebar-panel">
			{#if currentCanvasOwnerCard}
				{@const sidebarCard = currentCanvasOwnerCard}
				
				<div class="sidebar-section">
					<input
						class="sidebar-title-input"
						value={sidebarCard.concept.title}
						placeholder="Untitled Concept"
						aria-label="Concept title"
						onkeydown={(event) => onTitleKeydown(event, sidebarCard)}
						onblur={(event) => onTitleBlur(event, sidebarCard)}
					/>

					<div class="sidebar-id">{sidebarCard.instance.id}</div>
					
			<!-- If not at root, display up button -->
			{#if currentCanvasOwnerCard !== null}
				<button class="canvas-breadcrumb-up" type="button" onclick={onGoUpOneLevel}>Up</button>
			{/if}
				</div>
<div class="sidebar-section">
	<div class="sidebar-label">Relationships</div>

	{#if relationships.length > 0}
	<div class="sidebar-relationship-list">
		{#each relationships as relationship (relationship.id)}
			<div class="sidebar-relationship-row">
				{#each getRelationshipDisplayParts(
					relationship,
					relationshipDefinitions,
					sidebarCard.concept.id,
					getConceptById
				) as part}
					{#if part.type === 'text'}
						<span>{part.value}</span>
					{:else}
<span
	class="sidebar-relationship-concept"
	title={part.concept.title || 'Untitled Concept'}
>
	{part.concept.title || 'Untitled Concept'}
</span>
					{/if}
				{/each}
			</div>
		{/each}
	</div>
{:else}
	<div class="sidebar-empty">
		No relationships yet.
	</div>
{/if}
</div>
				<div class="sidebar-section sidebar-tags-section">
					<div class="tag-label-row">
						<div class="sidebar-label">Tags</div>

						<input
							class="concept-tag-input sidebar-tag-input"
							value={sidebarNewTag}
							placeholder="+ tag"
							aria-label="Add tag"
							oninput={(event) => {
								onSidebarNewTagChange((event.currentTarget as HTMLInputElement).value);
							}}
							onkeydown={(event) => {
								if (event.key === 'Enter') {
									event.preventDefault();
									event.stopPropagation();
									onSidebarTagAdd(sidebarCard);
								}
							}}
							onblur={() => onSidebarTagAdd(sidebarCard)}
						/>
					</div>

					<ConceptTagsPreview
						tags={getTagConcepts(sidebarCard.concept.tagConceptIds ?? [])}
						showInput={false}
						{onTagOpen}
						onTagRemove={(tagConcept) => onTagRemove(sidebarCard, tagConcept)}
					/>
				</div>

<div class="sidebar-section sidebar-properties-section">
	<div class="sidebar-properties-heading">
		<div class="sidebar-label">Properties</div>
	</div>

	<div class="sidebar-property-list">
		{#each Object.entries(sidebarCard.concept.properties ?? {}) as [key, value] (key)}
			<div class="sidebar-property-row">
				<input
					class="sidebar-property-key"
					value={key}
					aria-label="Property name"
					onkeydown={blurOnEnter}
					onblur={(event) =>
						updatePropertyKey(
							sidebarCard,
							key,
							event.currentTarget.value,
							event.currentTarget
						)}
				/>

				<div class="sidebar-property-divider" aria-hidden="true">:</div>

				<input
					class="sidebar-property-value"
					value={value}
					aria-label={`Value for ${key}`}
					onkeydown={blurOnEnter}
					onblur={(event) =>
						updatePropertyValue(
							sidebarCard,
							key,
							event.currentTarget.value
						)}
				/>

				<button
					class="sidebar-remove-property"
					type="button"
					aria-label={`Remove ${key}`}
					onclick={() => removeProperty(sidebarCard, key)}
				>
					×
				</button>
			</div>
		{/each}

		<div class="sidebar-property-row sidebar-property-row-new">
			<input
				class="sidebar-property-key"
				bind:value={newPropertyKey}
				placeholder="property"
				aria-label="New property name"
				onkeydown={handleNewPropertyKeydown}
				onblur={(event) => {
					const nextTarget = event.relatedTarget as Element | null;

					if (!nextTarget?.closest('.sidebar-property-row-new')) {
						commitNewProperty(sidebarCard);
					}
				}}
			/>

			<div class="sidebar-property-divider" aria-hidden="true">:</div>

			<input
				class="sidebar-property-value"
				bind:value={newPropertyValue}
				placeholder="value"
				aria-label="New property value"
				onkeydown={(event) =>
					handleNewPropertyValueKeydown(event, sidebarCard)}
				onblur={() => commitNewProperty(sidebarCard)}
			/>

			<div class="sidebar-property-row-spacer" aria-hidden="true"></div>
		</div>
	</div>
</div>
			{:else}
				<div class="sidebar-section">
					<input
						class="sidebar-title-input"
						value="Untitled Context"
						placeholder="Untitled Context"
						aria-label="Context Title"
						onkeydown={(event) => onTitleKeydown(event)}
						onblur={(event) => onTitleBlur(event)}
					/>

					<div class="sidebar-empty">Open a concept to inspect it.</div>
				</div>
			{/if}
		</div>
{:else}
	<div class="sidebar-panel sidebar-tree-panel">
	<div class="sidebar-section">
		<TreeView
			{getConceptChildren}
			{getRootConceptInstances}
		/>
	</div>
</div>
{/if}
</aside>

<style>
	.concept-sidebar {
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		border-right: 1px solid hsl(224 8% 24%);
		background: hsl(224 8% 14%);
		overflow: hidden;
	}

	.sidebar-tabs {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.375rem;
		padding: 0.5rem;
		border-bottom: 1px solid hsl(224 8% 24%);
	}

	.sidebar-tabs button {
		min-width: 0;
		border: 1px solid hsl(224 8% 32%);
		border-radius: 0.375rem;
		background: hsl(224 8% 20%);
		color: hsl(0 0% 88%);
		padding: 0.4rem 0.5rem;
		font: inherit;
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.sidebar-tabs button:hover {
		background: hsl(224 8% 25%);
	}

	.sidebar-tabs button.active {
		border-color: hsl(210 90% 55%);
		background: hsl(210 45% 28%);
		color: white;
	}

	.sidebar-panel {
		min-height: 0;
		flex: 1;
		overflow: auto;
		padding: 0.875rem;
	}

	.sidebar-section + .sidebar-section {
		margin-top: 1.25rem;
	}

	.sidebar-label {
		margin-bottom: 0.4rem;
		color: hsl(224 8% 68%);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.sidebar-title-input {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
		border: 0;
		border-bottom: var(--properties-divider-color);
		background: transparent;
		color: inherit;
		padding: 0.15rem 0 0.35rem;
		outline: none;
		font: inherit;
		font-size: 3rem;
		font-weight: 700;
		line-height: 1.2;
	}

	.sidebar-title-input:focus {
		border-bottom-color: hsl(210 90% 70%);
	}

	.sidebar-id {
		margin-top: 0.375rem;
		color: hsl(224 8% 58%);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.6875rem;
		overflow-wrap: anywhere;
	}

	.sidebar-note,
	.sidebar-empty {
		margin: 0;
		color: hsl(224 8% 70%);
		font-size: 0.8125rem;
		line-height: 1.45;
	}

	.concept-sidebar :global(.concept-tag-tile) {
		background: rgb(165, 222, 165);
	}

	.concept-sidebar :global(.concept-tag-tile):hover {
		background: rgb(173, 234, 173);
	}

	.concept-sidebar :global(.concept-tags-preview) {
		padding-left: 0;
	}

	.sidebar-properties-heading {
	margin-bottom: 0.5rem;
}

.sidebar-properties-heading .sidebar-label {
	margin-bottom: 0;
}

.sidebar-property-list {
	display: grid;
	gap: 0.5rem;
	border-top: var(--properties-divider-color);
}

.sidebar-property-row {
	display: grid;
	grid-template-columns:
		minmax(0, 1fr)
		1px
		minmax(0, 1fr)
		auto;
	align-items: stretch;
	min-width: 0;
	overflow: hidden;
	border-bottom: 1px dotted rgba(128, 128, 128, 0.299);
}

.sidebar-property-row:hover,
.sidebar-property-row:focus-within {
	background: hsl(224 8% 17%);
}

.sidebar-property-key,
.sidebar-property-value {
	width: 100%;
	min-width: 0;
	box-sizing: border-box;
	border: 0;
	background: transparent;
	padding: 0.45rem 0.5rem;
	outline: none;
	color: inherit;
	font: inherit;
	font-size: 1em;
}

.sidebar-property-key {
	color: hsl(224 8% 72%);
	font-weight: 650;
	text-align: right;
}

.sidebar-property-value {
	color: hsl(0 0% 92%);
	line-height: 1.35;
	text-align: left;
}

.sidebar-property-key:focus,
.sidebar-property-value:focus {
	background: hsl(0 0% 100% / 6%);
}

.sidebar-property-divider {
	width: 1px;
	margin-block: 0.25rem;
	color: hsla(0, 0%, 100%, 0.375);
	display: flex;
	align-items: center;
	justify-content: center;
}

.sidebar-remove-property {
	align-self: stretch;
	border: 0;
	border-left: 1px solid hsl(224 8% 25%);
	background: transparent;
	color: inherit;
	opacity: 0;
	padding: 0.25rem 0.4rem;
	font: inherit;
	font-size: 1rem;
	line-height: 1;
	cursor: pointer;
}

.sidebar-property-row:hover .sidebar-remove-property,
.sidebar-remove-property:focus-visible {
	opacity: 0.65;
}

.sidebar-remove-property:hover {
	background: hsl(0 45% 30%);
	opacity: 1;
}

.sidebar-property-row-new {
	opacity: 0;
	border-bottom: none;
}

.sidebar-property-row-new:hover,
.sidebar-property-row-new:focus-within {
	opacity: 1;
}

.sidebar-property-row-new input::placeholder {
	color: inherit;
	opacity: 0;
}

.sidebar-property-row-new:hover input::placeholder,
.sidebar-property-row-new:focus-within input::placeholder {
	opacity: 0.45;
}

.sidebar-property-row-spacer {
	width: 1.65rem;
}
	.sidebar-relationship-concept {
	display: inline;
	font-weight: 650;
	text-decoration: underline dotted;
	text-underline-offset: 0.15em;
	cursor: default;
}

.sidebar-relationship-concept:hover {
	background: hsl(210 45% 28%);
	border-radius: 0.2rem;
}
</style>


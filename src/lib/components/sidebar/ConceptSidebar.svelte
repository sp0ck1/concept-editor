<script lang="ts">
	import ConceptTagsPreview from '$lib/components/ConceptTagsPreview.svelte';
	import type { Concept } from '$lib/types/Concept';
	import type { ConceptCardView } from '$lib/types/ConceptCardView';

	let {
		sidebarTab,
		currentCanvasCard,
		sidebarNewTag,
		getTagConcepts,
		onSidebarTabChange,
		onTitleKeydown,
		onTitleBlur,
		onSidebarNewTagChange,
		onSidebarTagAdd,
		onTagOpen,
		onTagRemove
	} = $props<{
		sidebarTab: 'concept' | 'tree';
		currentCanvasCard: ConceptCardView | null;
		sidebarNewTag: string;
		getTagConcepts: (tagConceptIds: string[]) => Concept[];
		onSidebarTabChange: (tab: 'concept' | 'tree') => void;
		onTitleKeydown: (event: KeyboardEvent, card: ConceptCardView) => void;
		onTitleBlur: (event: FocusEvent, card: ConceptCardView) => void;
		onSidebarNewTagChange: (value: string) => void;
		onSidebarTagAdd: (card: ConceptCardView) => void;
		onTagOpen: (tagConcept: Concept) => void;
		onTagRemove: (card: ConceptCardView, tagConcept: Concept) => void;
	}>();
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

	{#if sidebarTab === 'concept'}
		<div class="sidebar-panel">
			{#if currentCanvasCard}
				{@const sidebarCard = currentCanvasCard}

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
						onTagOpen={onTagOpen}
						onTagRemove={(tagConcept) => onTagRemove(sidebarCard, tagConcept)}
					/>
				</div>

				<div class="sidebar-section">
					<div class="sidebar-label">Properties</div>

					{#if Object.entries(sidebarCard.concept.properties ?? {}).length === 0}
						<div class="sidebar-empty">No properties yet.</div>
					{:else}
						<div class="sidebar-property-list">
							{#each Object.entries(sidebarCard.concept.properties ?? {}) as [key, value]}
								<div class="sidebar-property-row">
									<div class="sidebar-property-key">{key}</div>
									<div class="sidebar-property-value">{value}</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else}
				<div class="sidebar-section">
				<input
						class="sidebar-title-input"
						value="Context Name"
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
		<div class="sidebar-panel">
			<div class="sidebar-section">
				<div class="sidebar-label">Tree</div>
				<div class="sidebar-empty">Tree view will go here later.</div>
			</div>
		</div>
	{/if}
</aside>
<style>
	.sidebar-title-input {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
		border: 0;
		border-bottom: 1px solid hsl(0 0% 100% / 20%);
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 3rem;
		font-weight: 700;
		line-height: 1.2;
		padding: 0.15rem 0 0.35rem;
		outline: none;
	}

	.sidebar-title-input:focus {
		border-bottom-color: hsl(210 90% 70%);
	}

	.concept-sidebar :global(.concept-tag-tile) {
		background: rgb(173, 234, 173);
	}

	.concept-sidebar :global(.concept-tag-tile):hover {
		background: rgb(109, 148, 109);
	}

	.concept-sidebar :global(.concept-tags-preview) {
		padding-left: 0px;
	}
    </style>
<script lang="ts">
	import type { Concept } from '$lib/types/Concept';

	// Props

	let {
		tags = [],
		showInput = true,
		onManualTagAdd,
		onTagOpen,
		onTagRemove
	} = $props<{
		tags?: Concept[];
		showInput?: boolean;
		onManualTagAdd?: (title: string) => void;
		onTagOpen?: (tagConcept: Concept) => void;
		onTagRemove?: (tagConcept: Concept) => void;
	}>();

	let newTag = $state('');

	function addTag() {
		const title = newTag.trim();

		if (!title) {
			newTag = '';
			return;
		}

		onManualTagAdd?.(title);
		newTag = '';
	}
</script>

{#if showInput}
	<input
		class="concept-tag-input"
		bind:value={newTag}
		placeholder="+ tag"
		aria-label="Add tag"
		onkeydown={(event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				event.stopPropagation();
				addTag();
			}
		}}
		onblur={addTag}
	/>
{/if}

<div class="concept-tags-preview" data-tag-area="true">
	<div class="concept-tag-list">
		{#each tags as tagConcept (tagConcept.id)}
			<div
				class="concept-tag-tile"
				role="button"
				tabindex="0"
				title={tagConcept.title || tagConcept.id}
				aria-label={tagConcept.title || tagConcept.id}
				ondblclick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					onTagOpen?.(tagConcept);
				}}
				onkeydown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						event.stopPropagation();
						onTagOpen?.(tagConcept);
					}
				}}
			>
				<span>{tagConcept.title || tagConcept.id}</span>

				<button
					class="concept-tag-remove"
					type="button"
					aria-label={`Remove ${tagConcept.title || tagConcept.id}`}
					onclick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						onTagRemove?.(tagConcept);
					}}
				>
					<span aria-hidden="true">×</span>
				</button>
			</div>
		{/each}
	</div>
</div>

<style>

	.tag-label-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.5rem;
	margin-bottom: 0.4rem;
}

.sidebar-tag-input {
	width: 10ch;
	margin-top: 0;
}

	.concept-tags-preview {
		min-width: 0;
		max-width: 100%;
		padding: 6px;
		overflow: hidden;
	
	}

	.concept-tag-list {
		display: flex;
		flex-wrap: wrap;
		align-content: flex-start;
		gap: 4px;
		overflow: hidden;
		
		
	}

	.concept-tag-tile {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	max-width: 100%;
	min-width: 0;
	padding: 3px 6px;
	border-radius: var(--child-tile-radius-small);
	border: 1px transparent var(--child-tile-border);
	opacity: 0.75;
	background: var(--tag-background-color);
	color: black;
	font-size: 0.7rem;
	font-weight: 600;
	cursor: pointer;
	box-sizing: border-box;
	
}

.concept-tag-tile > span {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	text-decoration: underline dotted;
}
	.concept-tag-tile:hover {
		background: var(--tag-background-color-hover);
	}

	.concept-tag-tile span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
.concept-tag-remove {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 11px;
	height: 12px;
	padding: 0;
	border: 0;
	border-radius: 1px;
	background: rgb(246, 246, 246);
	color: inherit;
	cursor: pointer;
	opacity: 0;
}

.concept-tag-remove > span {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	height: 100%;
	line-height: 1;
	

	
}

	.concept-tag-remove:hover {
		opacity: 1;
		background: rgba(255, 0, 0, 0.722);
		
	}
	.concept-tag-input {
		width: 8ch;
		min-width: 0;
		margin-top: 4px;
		border: 0;
		border-radius: 4px;
		padding: 2px 4px;
		font: inherit;
		font-size: 0.7rem;
	}


		</style>

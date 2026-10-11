<script lang="ts">
	import { untrack } from 'svelte';
	import ConceptCard from '$lib/components/editor/card/ConceptCard.svelte';
	import CanvasContextMenu from '$lib/components/editor/canvas/CanvasContextMenu.svelte';
	import CanvasSelectionBox from '$lib/components/editor/canvas/CanvasSelectionBox.svelte';
	import CanvasTopbar from '$lib/components/editor/canvas/CanvasTopbar.svelte';
	import PasteImportConfirmation from '$lib/components/editor/canvas/PasteImportConfirmation.svelte';
	import ConceptSidebar from '$lib/components/editor/sidebar/ConceptSidebar.svelte';
	import { clamp } from '$lib/components/editor/canvas/geometry';
	import type { ConceptCardView } from '$lib/model/ConceptCardView';
	import type { EditorData } from '$lib/components/editor/EditorTypes';
	import { Editor } from '$lib/components/editor/Editor.svelte';
	import { setEditorContext } from '$lib/components/editor/EditorContext';

	let { data } = $props<{ data: EditorData }>();

	const editor = untrack(() => new Editor(data));
	setEditorContext(editor);

	$effect(() => {
		const concepts = data.concepts;
		const instances = data.instances;
		const relationships = data.relationships;
		const relationshipDefinitions = data.relationshipDefinitions;

		untrack(() => {
			editor.replaceData({ concepts, instances, relationships, relationshipDefinitions });
		});
	});

	let sidebarElement = $state<HTMLElement | null>(null);
	let sidebarWidth = $state<number | null>(null);
	let isResizingSidebar = $state(false);
	let sidebarResizeStartX = 0;
	let sidebarResizeStartWidth = 0;
	let sidebarNewTag = $state('');

	const minSidebarWidth = 180;
	const minCanvasWidth = 240;

	function handleSidebarResizePointerDown(event: PointerEvent) {
		if (event.button !== 0 || !sidebarElement) return;
		event.preventDefault();
		event.stopPropagation();
		const handle = event.currentTarget as HTMLElement;
		handle.setPointerCapture(event.pointerId);
		isResizingSidebar = true;
		sidebarResizeStartX = event.clientX;
		sidebarResizeStartWidth = sidebarElement.getBoundingClientRect().width;
	}

	function handleSidebarResizePointerMove(event: PointerEvent) {
		if (!isResizingSidebar || !sidebarElement) return;
		const workspaceWidth =
			sidebarElement.parentElement?.getBoundingClientRect().width ?? window.innerWidth;
		const maxSidebarWidth = Math.max(minSidebarWidth, workspaceWidth - minCanvasWidth);
		sidebarWidth = clamp(
			sidebarResizeStartWidth + (event.clientX - sidebarResizeStartX),
			minSidebarWidth,
			maxSidebarWidth
		);
	}

	function handleSidebarResizePointerUp(event: PointerEvent) {
		if (!isResizingSidebar) return;
		const handle = event.currentTarget as HTMLElement;
		if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
		isResizingSidebar = false;
	}

	async function addSidebarTag(card: ConceptCardView) {
		const title = sidebarNewTag.trim();
		if (!title) {
			sidebarNewTag = '';
			return;
		}
		sidebarNewTag = '';
		await editor.handleManualTagAdd(card, title);
	}
</script>

<svelte:window
	onclick={() => editor.closeContextMenu()}
	onkeydown={(event) => editor.canvas.handleWindowKeydown(event)}
	onpointermove={(event) => editor.canvas.handleWindowPointerMove(event)}
	onpointerup={(event) => void editor.canvas.handleWindowPointerUp(event)}
/>

<section class="concept-workspace">
	<CanvasTopbar
		currentBreadcrumb={editor.currentBreadcrumb}
		currentCanvasOwnerCard={editor.currentCanvasOwnerCard}
		currentCanvasOwnerInstanceId={editor.currentCanvasOwnerInstanceId}
		mainView={editor.mainView}
		onGoToRootCanvas={() => editor.openRootCanvas()}
		onGoToCanvas={(id) => editor.openInstanceCanvas(id)}
		onGoUpOneLevel={() => editor.openInstanceParentCanvas()}
		onMainViewChange={(view) => editor.setMainView(view)}
		onFocus={() => editor.canvas.focusSelectionOrNearestCard()}
		onFrameAll={() => editor.canvas.frameCardsInCurrentCanvas()}
		onArrangeGrid={() => editor.canvas.arrangeCardsInCurrentCanvasInGrid()}
	/>

	<div class="concept-workspace-body">
		{#if editor.sidebarVisible}
			<div
				bind:this={sidebarElement}
				class="sidebar-shell"
				style:width={sidebarWidth === null ? undefined : `${sidebarWidth}px`}
			>
				<ConceptSidebar
					sidebarTab={editor.sidebarTab}
					currentCanvasOwnerCard={editor.currentCanvasOwnerCard}
					{sidebarNewTag}
					getTagConcepts={(ids) => editor.getTagConcepts(ids)}
					getConceptChildren={(id) => editor.getConceptChildren(id)}
					getRootConceptInstances={() => editor.getRootConceptInstances()}
					onGoUpOneLevel={() => editor.openInstanceParentCanvas()}
					onSidebarTabChange={(tab) => {
						editor.sidebarTab = tab;
					}}
					onTitleKeydown={(event, card) => editor.canvas.handleConceptTitleKeydown(event, card)}
					onTitleBlur={(event, card) => editor.canvas.handleConceptTitleBlur(event, card)}
					onSidebarNewTagChange={(value) => {
						sidebarNewTag = value;
					}}
					onSidebarTagAdd={addSidebarTag}
					onTagOpen={(tag) => editor.openTagCanvas(tag)}
					onTagRemove={(card, tag) => editor.handleTagRemove(card, tag)}
					onPropertiesChange={(card, properties) =>
						editor.handlePropertiesChange(card, properties)}
					relationships={editor.currentConceptRelationships}
					relationshipDefinitions={editor.relationshipDefinitions}
					getConceptById={(id) => editor.getConceptById(id)}
				/>

				<button
					class="sidebar-resize-handle"
					class:active={isResizingSidebar}
					type="button"
					aria-label="Resize sidebar"
					onpointerdown={handleSidebarResizePointerDown}
					onpointermove={handleSidebarResizePointerMove}
					onpointerup={handleSidebarResizePointerUp}
					onpointercancel={handleSidebarResizePointerUp}
				></button>
			</div>
		{/if}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<section
			bind:this={editor.canvas.canvasElement}
			class="canvas"
			class:sidebar-hidden={!editor.sidebarVisible}
			class:is-panning={editor.canvas.isPanning}
			role="application"
			aria-label="Concept canvas"
			tabindex="0"
			onwheel={(event) => editor.canvas.handleCanvasWheel(event)}
		>
			{#if editor.mainView === 'canvas'}
				{#if editor.canvas.childTileDragState.active}
					<div
						class="child-tile-drag-ghost"
						style={`left: ${editor.canvas.childTileDragState.mouseX}px; top: ${editor.canvas.childTileDragState.mouseY}px;`}
					>
						<div class="child-tile-drag-ghost-title">
							{editor.canvas.childTileDragState.childCard.concept.title ||
								editor.canvas.childTileDragState.childCard.concept.id}
						</div>
					</div>
				{/if}

				<div
					class="canvas-background"
					ondblclick={(event) => editor.canvas.handleCanvasDoubleClick(event)}
					oncontextmenu={(event) => editor.canvas.handleCanvasContextMenu(event)}
					onpointerdown={(event) => editor.canvas.handleCanvasPointerDown(event)}
					onpaste={(event) => editor.canvas.handleCanvasPaste(event)}
				></div>

				{#if editor.canvas.selectionBoxState.active}
					{@const selectionCanvasRect = editor.canvas.getSelectionBoxCanvasRect()}
					{#if selectionCanvasRect}
						<CanvasSelectionBox rect={selectionCanvasRect} />
					{/if}
				{/if}

				<div
					class="canvas-world"
					style={`transform: translate(${editor.canvas.panX}px, ${editor.canvas.panY}px) scale(${editor.canvas.zoom});`}
					class:is-arranging-camera={editor.canvas.arrangingCamera}
				>
					{#each editor.cardsInCurrentCanvas as card (card.instance.id)}
						<ConceptCard
							{card}
							isActive={editor.activeInstanceId === card.instance.id}
							isDragging={(editor.canvas.dragState.active &&
								editor.canvas.dragState.draggedCards.some(
									(draggedCard) => draggedCard.instanceId === card.instance.id
								)) ||
								(editor.canvas.resizeState.active &&
									editor.canvas.resizeState.instanceId === card.instance.id)}
							isSelected={editor.selectedInstanceIds.has(card.instance.id)}
							isMarqueePreviewed={editor.canvas.marqueePreviewInstanceIds.has(card.instance.id)}
							isArranging={editor.canvas.arrangingCards}
							shouldFocusTitle={editor.pendingFocusInstanceId === card.instance.id}
							onTitleFocused={() => {
								if (editor.pendingFocusInstanceId === card.instance.id) {
									editor.pendingFocusInstanceId = null;
								}
							}}
							onChildDragStart={(event, childCard) =>
								editor.canvas.handleChildTileDragStart(event, childCard)}
							onPointerDown={(event, currentCard) =>
								editor.canvas.handleCardPointerDown(event, currentCard)}
							onContextMenu={(event, currentCard) =>
								editor.canvas.handleCardContextMenu(event, currentCard)}
							onTitleBlur={(event, currentCard) =>
								editor.canvas.handleConceptTitleBlur(event, currentCard)}
							onTitleKeydown={(event, currentCard) =>
								editor.canvas.handleConceptTitleKeydown(event, currentCard)}
							onResizePointerDown={(event, currentCard) =>
								editor.canvas.handleResizePointerDown(event, currentCard)}
							onCardOpen={(currentCard) => editor.openCardCanvas(currentCard)}
							tagConcepts={editor.getTagConcepts(card.concept.tagConceptIds ?? [])}
							onManualTagAdd={(currentCard, title) =>
								editor.handleManualTagAdd(currentCard, title)}
							onTagOpen={(tag) => editor.openTagCanvas(tag)}
							onTagRemove={(currentCard, tag) => editor.handleTagRemove(currentCard, tag)}
							getConceptChildren={(id) => editor.getConceptChildren(id)}
						/>
					{/each}
				</div>
			{:else}
				<div class="table-placeholder">
					<h2>Table View</h2>
					<p>
						Table view will render here later. For now, switching to Table also forces the sidebar
						to Tree.
					</p>
				</div>
			{/if}

			{#if editor.canvas.pasteConfirmation.visible}
				<PasteImportConfirmation
					itemsCount={editor.canvas.pasteConfirmation.items.length}
					targetConceptName={editor.canvas.pasteConfirmation.targetConceptName}
					onConfirm={() => editor.canvas.confirmPasteImport()}
					onCancel={() => editor.canvas.cancelPasteImport()}
				/>
			{/if}
			<CanvasContextMenu
				contextMenu={editor.contextMenu}
				importChildrenMenu={editor.importChildrenMenu}
				importOptions={editor.importChildrenOptions}
				onCreateConceptFromMenu={(size) => editor.createConceptFromMenu(size)}
				onGoToCanvas={(id) => editor.openInstanceCanvas(id)}
				onCloseContextMenu={() => editor.closeContextMenu()}
				onOpenImportChildrenMenu={() => editor.openImportChildrenMenu()}
				onDeleteInstanceFromMenu={() => editor.deleteInstanceFromMenu()}
				onImportChildrenFromSource={(id) => editor.importChildrenFromSource(id)}
			/>
			<div class="zoom-indicator">
				{Math.round(editor.canvas.zoom * 100)}%
			</div>
		</section>
	</div>
</section>

<style>
	.child-tile-drag-ghost {
		position: fixed;
		z-index: var(--maximum-z-index);
		width: fit-content;
		max-width: 500px;
		text-overflow: ellipsis;
		height: var(--child-tile-height);
		transform: translate(-50%, -50%);
		pointer-events: none;

		display: flex;
		align-items: center;
		justify-content: center;

		padding: 0.75rem;
		border-radius: var(--child-tile-radius);
		border: 1px solid var(--child-tile-border-drag);
		background: var(--child-tile-bg);
		color: var(--child-tile-text);
		box-shadow: 2px 2px 1px black;

		user-select: none;
		box-sizing: border-box;
	}

	.child-tile-drag-ghost-title {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 8;

		max-width: 100%;
		max-height: 100%;

		overflow: hidden;
		text-overflow: ellipsis;

		font-size: var(--child-tile-drag-font-size);
		font-weight: var(--child-tile-drag-font-weight);
		line-height: var(--child-tile-line-height);
		text-align: center;

		white-space: normal;
		overflow-wrap: normal;
		word-break: normal;
	}

	.concept-workspace {
		height: 100vh;
		width: 100vw;
		display: grid;
		grid-template-rows: 44px minmax(0, 1fr);

		overflow: hidden;
		background: hsl(224 8% 12%);
	}

	.concept-workspace-body {
		min-height: 0;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		overflow: hidden;
	}

	.concept-workspace-body.sidebar-hidden {
		grid-template-columns: minmax(0, 1fr);
	}

	.sidebar-shell {
		position: relative;
		display: flex;
		width: max(260px, 25vw);
		min-width: 0;
		min-height: 0;
	}

	.sidebar-shell :global(.concept-sidebar) {
		width: 100%;
		min-width: 0;
		min-height: 0;
	}

	.sidebar-resize-handle {
		position: absolute;
		z-index: 30;
		top: 0;
		right: -3px;
		bottom: 0;
		width: 6px;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: col-resize;
		touch-action: none;
	}

	.sidebar-resize-handle:hover,
	.sidebar-resize-handle.active {
		background: hsl(210 90% 55% / 45%);
	}

	.canvas {
		position: relative;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		background: var(--canvas-background-color);
		touch-action: none;
	}

	.canvas-background {
		position: absolute;
		inset: 0;
		z-index: 0;
	}

	.canvas-world {
		position: absolute;
		left: 0;
		top: 0;
		z-index: 1;
		transform-origin: 0 0;
	}

	.zoom-indicator {
		position: absolute;
		right: 0.75rem;
		bottom: 0.75rem;
		z-index: 20;
		padding: 0.25rem 0.45rem;
		border-radius: 6px;
		background: hsl(0 0% 0% / 45%);
		color: white;
		font-size: 0.75rem;
		pointer-events: none;
	}

	.canvas-world.is-arranging-camera {
		transition: transform 4000ms ease;
	}
</style>

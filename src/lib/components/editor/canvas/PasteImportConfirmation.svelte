<script lang="ts">
	let { 
        itemsCount, 
        targetConceptName, 
        onConfirm, 
        onCancel } = $props<{
		itemsCount: number;
		targetConceptName: string;
		onConfirm: () => void | Promise<void>;
		onCancel: () => void;
	}>();

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			event.stopPropagation();
			void onConfirm();
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			onCancel();
		}
	}
</script>

<div
	class="paste-confirmation"
	role="dialog"
	tabindex="-1"
	aria-label="Confirm paste import"
	onkeydown={handleKeydown}
>
	<div class="paste-confirmation-message">
		Please confirm you intended to add {itemsCount} concepts to {targetConceptName}.
	</div>

	<div class="paste-confirmation-actions">
		<button type="button" autofocus onclick={() => void onConfirm()}>Confirm</button>
		<button type="button" onclick={onCancel}>Cancel</button>
	</div>
</div>

<style>
	.paste-confirmation {
		position: fixed;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		z-index: 1000;
		display: grid;
		gap: 0.75rem;
		width: min(28rem, calc(100vw - 2rem));
		border: 1px solid hsl(45 90% 60% / 65%);
		background: hsl(224 12% 16%);
		color: white;
		border-radius: 10px;
		padding: 1rem;
		box-shadow: 0 12px 36px rgb(0 0 0 / 35%);
	}

	.paste-confirmation-message {
		font-size: 0.9rem;
		line-height: 1.4;
	}

	.paste-confirmation-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	.paste-confirmation-actions button {
		border: 1px solid hsl(0 0% 70% / 40%);
		background: hsl(0 0% 100% / 12%);
		color: inherit;
		border-radius: 6px;
		padding: 0.35rem 0.6rem;
		font: inherit;
		cursor: pointer;
	}
</style>
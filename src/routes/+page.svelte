<script lang="ts">
	import ConceptEditor from '$lib/components/editor/ConceptEditor.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<main class="app">
	<ConceptEditor {data} />
</main>

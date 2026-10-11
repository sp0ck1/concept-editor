<script lang="ts">
	import ConceptEditor from '$lib/components/editor/ConceptEditor.svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();
</script>

<main class="app">
	<ConceptEditor {data} />
</main>
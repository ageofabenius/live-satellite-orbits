<script lang="ts">
	import './layout.css';
	import DebugOverlay from '$lib/components/DebugOverlay.svelte';

	let { children } = $props();
</script>

{@render children()}

{#if import.meta.env.VITE_DEBUG === 'true'}
	<DebugOverlay />
{/if}

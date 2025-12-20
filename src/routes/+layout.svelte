<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import DebugOverlay from './DebugOverlay.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

{#if import.meta.env.VITE_DEBUG === 'true'}
	<DebugOverlay />
{/if}

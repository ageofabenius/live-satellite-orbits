<script lang="ts">
	import { onMount } from 'svelte';
	import { init_debug_mode, Level } from './debug';

	let debug_log_buffer: [Level, string][] = [];

	init_debug_mode(debug_log_buffer);

	// Use a separate $state variable to decouple logging from state updates
	let displayed_log: [Level, string][] = $state([]);

	onMount(() => {
		const log_interval = setInterval(() => {
			if (debug_log_buffer.length > 0) {
				displayed_log.push(...debug_log_buffer.splice(0));
			}
		}, 100);

		return () => clearInterval(log_interval);
	});
</script>

<div
	class="absolute bottom-0 mb-2 left-0 mx-2 w-full h-1/3 info-panel bg-black/10 z-2222 flex flex-col"
>
	<div class="">DEBUG</div>
	<div class="size-full flex flex-col overflow-auto text-sm font-mono">
		{#each displayed_log as [level, message]}
			<span
				class={level === Level.WARN
					? 'text-orange-300'
					: level === Level.ERROR
						? 'text-red-800'
						: ''}>{message}</span
			>
		{/each}
	</div>
</div>

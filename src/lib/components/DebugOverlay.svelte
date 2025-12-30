<script lang="ts">
	/**
	 * This component overrides the default console.log/warn/error methods,
	 * mirroring their content in an internal buffer in this component.
	 */
	import { onMount } from 'svelte';

	// Buffer all console messages here
	let debug_log_buffer: [Level, string][] = [];
	// Use a separate $state variable to decouple logging from state updates,
	// preventing log cascades due to interactions between console logging and
	// Svelte's reactivity.
	let displayed_log: [Level, string][] = $state([]);

	onMount(() => {
		init_debug_mode();

		// Update the displayed_log once every 100 ms from the debug_log_buffer
		const log_interval = setInterval(() => {
			if (debug_log_buffer.length > 0) {
				displayed_log.push(...debug_log_buffer.splice(0));
			}
		}, 100);

		return () => clearInterval(log_interval);
	});

	enum Level {
		INFO,
		WARN,
		ERROR
	}

	function init_debug_mode() {
		console.log('OVERRIDDING DEFAULT CONSOLE.LOG HANDLERS');

		const original = {
			log: console.log,
			warn: console.warn,
			error: console.error
		};
		function log_to_debug_console(level: Level, args: unknown[]) {
			const line = args
				.map((a) =>
					typeof a === 'string'
						? a
						: (() => {
								try {
									return JSON.stringify(a);
								} catch {
									return String(a);
								}
							})()
				)
				.join(' ');

			debug_log_buffer.push([level, line]);
		}

		console.log = (...args: unknown[]) => {
			original.log(...args);
			log_to_debug_console(Level.INFO, args);
		};

		console.warn = (...args: unknown[]) => {
			original.warn(...args);
			log_to_debug_console(Level.WARN, args);
		};

		console.error = (...args: unknown[]) => {
			original.error(...args);
			log_to_debug_console(Level.ERROR, args);
		};
	}
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

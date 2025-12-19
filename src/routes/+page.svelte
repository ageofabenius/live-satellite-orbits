<script lang="ts">
	import { Canvas } from '@threlte/core';
	import Scene from './Scene.svelte';
	import { SCENE_BACKGROUND } from './scene_colors';
	import { flip } from 'svelte/animate';
	import { fade, fly } from 'svelte/transition';

	let is_loading = $state(true);
	let loading_components: Record<string, boolean> = $state({});
	function register_loading_started(name: string) {
		loading_components[name] = true;
		console.log('register_loading_started', name, JSON.stringify(loading_components));
	}
	function register_loading_completed(name: string) {
		loading_components[name] = false;
		console.log('register_loading_completed', name, JSON.stringify(loading_components));
		if (Object.entries(loading_components).every(([name, status]) => status === false)) {
			console.log('All components loaded');
			is_loading = false;
		}
	}

	let loading_messages: string[] = $state([]);
	let displayed_loading_messages: string[] = $state([]);
	function loading_message(message: string) {
		loading_messages.push(message);
		throttle_displayed_messages();
	}

	let throttle_displayed_messages_is_running = false;
	let last_displayed_time = 0;
	const MIN_MESSAGE_MS = 1000;
	async function throttle_displayed_messages() {
		if (throttle_displayed_messages_is_running) return;
		throttle_displayed_messages_is_running = true;

		while (loading_messages.length > 0) {
			const elapsed = performance.now() - last_displayed_time;

			if (elapsed < MIN_MESSAGE_MS) {
				await new Promise((r) => setTimeout(r, MIN_MESSAGE_MS - elapsed));
			}

			let next_message = loading_messages.shift()!;
			displayed_loading_messages = [...displayed_loading_messages.slice(-2), next_message];

			last_displayed_time = performance.now();
		}
		throttle_displayed_messages_is_running = false;
	}

	loading_message('initializing scene');
</script>

<div class="h-screen w-screen p-4 bg-gray-900">
	<div class="size-full {SCENE_BACKGROUND} relative">
		<div
			class="
				absolute
				z-10
				pointer-events-none
				size-full
				bg-black/80 backgrop-blur-sm
				{is_loading ? 'opacity-100' : 'opacity-0'}
				transition-opacity duration-500
				text-cyan-300
				grid grid-cols-3 grid-rows-5 items-center
				"
		>
			<div
				class="row-start-3 col-start-2 grid place-items-center
			 size-full"
			>
				<div class="col-start-1 row-start-1">loading...</div>
				<div
					class="col-start-1 row-start-1
					size-24
					rounded-full
					border-4 border-cyan-400/30
					border-t-cyan-400
					animate-spin
					"
				></div>
			</div>
			<div
				class="row-start-4 row-end-6 col-start-2 size-full flex flex-col
			gap-2 items-center text-xs font-mono"
			>
				{#each displayed_loading_messages as message (message)}
					<div
						class=""
						in:fly={{ y: 20, duration: 250, delay: 300 }}
						out:fade={{ duration: 300 }}
						animate:flip={{ duration: 400, easing: (t) => t }}
					>
						{message}
					</div>
				{/each}
			</div>
		</div>
		<Canvas>
			<Scene
				loading_started={register_loading_started}
				loading_complete={register_loading_completed}
				{loading_message}
			/>
		</Canvas>
	</div>
</div>

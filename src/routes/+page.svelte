<script lang="ts">
	import { Canvas } from '@threlte/core';
	import Scene from '$lib/components/scene/Scene.svelte';
	import { SCENE_BACKGROUND } from '../../config/colors.config';
	import { flip } from 'svelte/animate';
	import { fade, fly } from 'svelte/transition';
	import InfoOverlay from './InfoOverlay.svelte';
	import { onMount } from 'svelte';

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

	// The full scene should only be loaded and rendered if in an actual web
	// browser.  This check should prevent against the scene loading in a
	// headless environment, such as with web crawlers.
	//
	// This was added as I believe the long load time was preventing Google from
	// indexing the site.
	let canvas_parent: HTMLDivElement | undefined = $state();
	let canvas_is_visible: boolean = $state(false);
	onMount(() => {
		const observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					console.debug('Canvas is visible in the viewport');
					canvas_is_visible = true;
				} else {
					console.debug('Canvas is not visible in the viewport');
				}
			});
		});

		observer.observe(canvas_parent!);
	});
</script>

<div class="h-screen w-screen size-full {SCENE_BACKGROUND} relative">
	<!-- Canvas scene -->
	<div bind:this={canvas_parent} id="canvas_parent" class="absolute inset-0 z-0">
		<Canvas>
			{#if canvas_is_visible}
				<Scene
					loading_started={register_loading_started}
					loading_complete={register_loading_completed}
					{loading_message}
				/>
			{/if}
		</Canvas>
	</div>

	<noscript>
		<figure>
			<img
				src="/screenshot.png"
				alt="3D visualization of Earth with thousands of satellites in low Earth orbit"
				width="2154"
				height="1047"
			/>
			<figcaption>Static preview of the interactive 3D satellite orbit visualization.</figcaption>
		</figure>

		<p>
			This page features an interactive 3D visualization of publicly known satellites orbiting
			Earth, driven by real-time TLE propagation. JavaScript is required to explore the live
			simulation.
		</p>
	</noscript>

	<!-- UI Overlay -->
	<div class="absolute size-full pointer-events-none z-11">
		<InfoOverlay />
	</div>

	<!-- Loading screen -->
	<div
		class="
				absolute
				z-10
				pointer-events-none
				size-full
				bg-black/80 backdrop-blur-sm
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
</div>

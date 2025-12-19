<script lang="ts">
	import { Canvas } from '@threlte/core';
	import Scene from './Scene.svelte';
	import { SCENE_BACKGROUND } from './scene_colors';

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
</script>

<div class="h-screen w-screen p-4 bg-gray-900">
	<div class="size-full {SCENE_BACKGROUND} relative">
		<!-- {#if is_loading} -->
		<div
			class="
				absolute
				z-10
				flex flex-col items-center justify-center
				pointer-events-none
				size-full
				bg-black/80 backgrop-blur-sm
				{is_loading ? 'opacity-100' : 'opacity-0'}
				transition-opacity duration-100
				text-cyan-300
				"
		>
			<div class="absolute">loading...</div>
			<div
				class="
					absolute
					size-24
					rounded-full
					border-4 border-cyan-400/30
					border-t-cyan-400
					animate-spin
					"
			></div>
		</div>
		<!-- {/if} -->
		<Canvas>
			<Scene
				loading_started={register_loading_started}
				loading_complete={register_loading_completed}
			/>
		</Canvas>
	</div>
</div>

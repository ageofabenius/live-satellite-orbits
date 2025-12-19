<script lang="ts">
	import { Canvas } from '@threlte/core';
	import Scene from './Scene.svelte';
	import { SCENE_BACKGROUND } from './scene_colors';

	let is_loading = $state(false);
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
		}
	}
</script>

<div class="h-screen w-screen p-4 bg-gray-900">
	<div class="size-full {SCENE_BACKGROUND}">
		<Canvas>
			<Scene
				loading_started={register_loading_started}
				loading_complete={register_loading_completed}
			/>
		</Canvas>
	</div>
</div>

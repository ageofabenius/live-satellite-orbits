<script lang="ts">
	import { Canvas } from '@threlte/core';
	import Scene from './Scene.svelte';
	import { SCENE_BACKGROUND } from './scene_colors';
</script>

<div class="h-screen w-screen p-4 bg-gray-900">
	<div class="size-full {SCENE_BACKGROUND}">
		<Canvas>
			<Scene />
		</Canvas>
	</div>
</div>

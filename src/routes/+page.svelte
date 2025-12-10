<script lang="ts">
	import { Canvas } from '@threlte/core';
	import Scene from './Scene.svelte';
</script>

<div class="h-screen w-screen p-4 bg-gray-900">
	<div class="bg-gray-900 size-full">
		<Canvas>
			<Scene />
		</Canvas>
	</div>
</div>

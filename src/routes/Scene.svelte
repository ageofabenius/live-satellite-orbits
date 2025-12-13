<script lang="ts">
	import { T } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import Earth from './Earth.svelte';
	import Satellites from './Satellites.svelte';
	import type { Mesh } from 'three';

	let earth_mesh: Mesh | null = $state(null);
</script>

<T.PerspectiveCamera
	makeDefault
	near={1}
	far={500_000}
	position={[10000, 10000, 10000]}
	oncreate={(ref) => {
		ref.lookAt(0, 0, 0);
	}}
>
	<OrbitControls enableDamping />
</T.PerspectiveCamera>

<Earth bind:earth_mesh />

<Satellites {earth_mesh} />

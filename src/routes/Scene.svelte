<script lang="ts">
	import { T } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import Earth from './Earth.svelte';
	import Satellites from './Satellites.svelte';
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

<Earth />

<Satellites />

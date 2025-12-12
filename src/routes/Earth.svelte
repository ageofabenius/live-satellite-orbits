<script lang="ts">
	// TO-DO:
	// Correctly-sized globe
	// Choose new globe?  New textures?
	// Correctly tilted-globe
	// Correctly live-rotated globe

	import { T } from '@threlte/core';
	import { TextureLoader, Mesh } from 'three';

	import { interactivity } from '@threlte/extras';
	interactivity();

	const EARTH_RADIUS_KM = 6371;

	let { earth_mesh = $bindable() }: { earth_mesh: Mesh } = $props();

	const loader = new TextureLoader();

	const earth_texture = loader.load(
		'https://unpkg.com/three-globe@2.45.0/example/img/earth-blue-marble.jpg'
	);
	const bump_texture = loader.load(
		'https://unpkg.com/three-globe@2.45.0/example/img/earth-topology.png'
	);
</script>

<T.Mesh
	bind:ref={earth_mesh}
	scale={EARTH_RADIUS_KM}
	layers={0}
	onpointerenter={() => console.log('Earth hit')}
	onpointerleave={() => console.log('Earth leave')}
>
	<T.SphereGeometry args={[1, 64, 64]} />
	<T.MeshStandardMaterial map={earth_texture} bumpMap={bump_texture} bumpScale={0.05} />
</T.Mesh>

<T.DirectionalLight position={[1, 0, 0]} />
<T.AmbientLight intensity={0.2} />

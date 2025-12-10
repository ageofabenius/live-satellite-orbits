<script lang="ts">
	import { T } from '@threlte/core';

	const EARTH_RADIUS_KM = 6371;
	const EARTH_RADIUS_MILES = 3959;


	// TO-DO:
	// Correctly-sized globe
	// Choose new globe?  New textures?
	// Correctly tilted-globe
	// Correctly live-rotated globe
</script>

<T.Group
	scale={EARTH_RADIUS_KM / 100}
	oncreate={(group) => {
		(async () => {
			// ThreeGlobe tries to access `window` on import, this prevents vite dev // from
			// building since `window` only exists in the browser.  So we import it //
			// dynamically when running.
			const mod = await import('three-globe');
			const ThreeGlobe: any = mod.default;

			const globe = new ThreeGlobe()
				.globeImageUrl('https://unpkg.com/three-globe@2.45.0/example/img/earth-blue-marble.jpg')
			    .bumpImageUrl('https://unpkg.com/three-globe@2.45.0/example/img/earth-topology.png');


			group.add(globe);
		})();
	}}
/>

<!-- <T.DirectionalLight position={[1, 0, 0]} /> -->

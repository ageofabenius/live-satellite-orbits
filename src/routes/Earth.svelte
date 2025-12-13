<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import {
		TextureLoader,
		Mesh,
		Texture,
		SRGBColorSpace,
		LinearSRGBColorSpace,
		Vector3,
		MeshPhysicalMaterial,
		DirectionalLight,
		MathUtils
	} from 'three';

	import { interactivity } from '@threlte/extras';
	import { onMount } from 'svelte';
	interactivity();

	let { earth_mesh = $bindable() }: { earth_mesh: Mesh } = $props();

	//// Earth mesh and textures ////
	const EARTH_RADIUS_KM = 6371;

	let day_texture: Texture | undefined = $state();
	let night_texture: Texture | undefined = $state();
	let cloud_texture: Texture | undefined = $state();
	let normal_map: Texture | undefined = $state();
	let specular_map: Texture | undefined = $state();

	let earth_material: MeshPhysicalMaterial | undefined = $state();
	let earth_material_shader: any = $state();

	onMount(async () => {
		const loader = new TextureLoader();

		[day_texture, night_texture, cloud_texture, normal_map, specular_map] = await Promise.all([
			loader.loadAsync('/textures/2k_earth_daymap.jpg'),
			loader.loadAsync('/textures/2k_earth_nightmap.jpg'),
			loader.loadAsync('/textures/2k_earth_clouds.jpg'),
			loader.loadAsync('/textures/2k_earth_normal_map.png'),
			loader.loadAsync('/textures/2k_earth_specular_map.png')
		]);

		day_texture.colorSpace = SRGBColorSpace;
		night_texture.colorSpace = SRGBColorSpace;
		cloud_texture.colorSpace = LinearSRGBColorSpace;

		normal_map.colorSpace = LinearSRGBColorSpace;
		specular_map.colorSpace = LinearSRGBColorSpace;

		earth_material!.onBeforeCompile = (shader) => {
			shader.uniforms.sunDirection = { value: sunDirectionView };

			// inject uniform
			shader.fragmentShader = shader.fragmentShader.replace(
				'#include <common>',
				`
				#include <common>
				uniform vec3 sunDirection;
    			`
			);

			// mask emissive
			shader.fragmentShader = shader.fragmentShader.replace(
				'#include <emissivemap_fragment>',
				`
				#include <emissivemap_fragment>

				float ndotl = dot( normalize( vNormal ), normalize( sunDirection ) );

				// 1.0 on night side, 0.0 on day side, smooth terminator
				float nightFactor = smoothstep( 0.3, -0.2, ndotl );

				totalEmissiveRadiance *= nightFactor;
				`
			);

			earth_material_shader = shader;
		};
	});

	const EARTH_AXIAL_TILT = (23.44 * Math.PI) / 180;

	// //// Sun directional light ////
	// let sun_direction = $state(new Vector3(-1, 0, 0));

	// let fast_forward_days = 0;
	// function compute_sun_direction() {
	// 	let current_time = new Date(Date.now() + fast_forward_days * 24 * 60 * 60 * 1000);
	// 	let new_sun_direction = new Vector3(-1, 0, 0);

	// 	// Compute adjustment to sun angle to account for Earth's rotation
	// 	// throughtout the day
	// 	let fractional_day = current_time.getUTCHours() / 24 + current_time.getUTCMinutes() / 1440;
	// 	let fractional_day_angle = fractional_day * Math.PI * 2;
	// 	// sun direction in world frame
	// 	// Apply the angle to the -Y axis since we're rotating the sun, not the Earth
	// 	new_sun_direction.applyAxisAngle(new Vector3(0, -1, 0), fractional_day_angle);

	// 	// Compute adjustment to sun angle to account for Earth's axial tilt
	// 	// throughtout the year
	// 	// @ts-ignore
	// 	let day_of_year = (current_time - Date.UTC(current_time.getUTCFullYear(), 0, 0)) / 86_400_000;
	// 	let fractional_year = day_of_year / 365.2422;
	// 	let day_of_year_angle = fractional_year * Math.PI * 2 - Math.PI / 2;
	// 	new_sun_direction.applyAxisAngle(new Vector3(0, 1, 0), day_of_year_angle);

	// 	// Apply the Earth's axial tilt
	// 	new_sun_direction.applyAxisAngle(new Vector3(0, 0, 1), EARTH_AXIAL_TILT);

	// 	// Apply to the sun_direction state
	// 	sun_direction = new_sun_direction;

	// 	console.log(`current_time: ${current_time.toISOString()}`);

	// 	fast_forward_days += 1;
	// }

	// onMount(() => {
	// 	// Update once every minute
	// 	const sun_update_interval = setInterval(compute_sun_direction, 50);

	// 	return () => {
	// 		clearInterval(sun_update_interval);
	// 	};
	// });

	// sun direction in camera frame
	const sunDirectionView = new Vector3();
	let directional_light: DirectionalLight | undefined = $state();
	// const { camera } = useThrelte();
	// useTask(() => {
	// 	// Transform the sun direction from world frame to camera view frame
	// 	sunDirectionView.copy(sun_direction).transformDirection(camera.current.matrixWorldInverse);

	// 	earth_material_shader?.uniforms.sunDirection.value.copy(sunDirectionView);
	// });
</script>

{#if day_texture && night_texture && cloud_texture && normal_map && specular_map}
	<T.Group scale={EARTH_RADIUS_KM}>
		<T.Mesh bind:ref={earth_mesh}>
			<T.SphereGeometry args={[1, 128, 128]} />
			<T.MeshPhysicalMaterial
				bind:ref={earth_material}
				map={day_texture}
				normalMap={normal_map}
				normalScale={[0.6, 0.6]}
				metalness={0.0}
				roughness={0.85}
				emissive="#ffffff"
				emissiveMap={night_texture}
				clearcoat={1.0}
				clearcoatRoughness={0.15}
				clearcoatMap={specular_map}
			/>
		</T.Mesh>

		<T.Mesh scale={1.005}>
			<T.SphereGeometry args={[1, 128, 128]} />
			<T.MeshStandardMaterial
				map={cloud_texture}
				alphaMap={cloud_texture}
				transparent={true}
				opacity={1}
				depthWrite{false}
			/>
		</T.Mesh>
	</T.Group>
{/if}

<!-- <T.DirectionalLight
	bind:ref={directional_light}
	position={[sun_direction.x, sun_direction.y, sun_direction.z]}
/>
<T.AmbientLight intensity={0.02} /> -->

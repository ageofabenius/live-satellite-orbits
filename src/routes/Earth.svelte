<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import {
		TextureLoader,
		Mesh,
		Texture,
		SRGBColorSpace,
		LinearSRGBColorSpace,
		Vector3,
		MeshPhysicalMaterial
	} from 'three';

	import { interactivity } from '@threlte/extras';
	import { onMount } from 'svelte';
	import { flip } from 'svelte/animate';
	import { LOADING_WIREFRAME } from './scene_colors';
	interactivity();

	let { earth_mesh = $bindable(), simulated_time }: { earth_mesh: Mesh; simulated_time: Date } =
		$props();

	//// Earth mesh and textures ////
	const EARTH_RADIUS_KM = 6371;

	let day_texture: Texture | undefined = $state();
	let night_texture: Texture | undefined = $state();
	let cloud_texture: Texture | undefined = $state();
	let normal_map: Texture | undefined = $state();
	let specular_map: Texture | undefined = $state();

	let earth_material: MeshPhysicalMaterial | undefined = $state();
	let earth_material_shader: any = $state();

	let sun_direction_world: Vector3 = $state(new Vector3());

	onMount(async () => {
		const loader = new TextureLoader();

		// [day_texture, night_texture, cloud_texture, normal_map, specular_map] = await Promise.all([
		// 	loader.loadAsync('/textures/2k_earth_daymap.jpg'),
		// 	loader.loadAsync('/textures/2k_earth_nightmap.jpg'),
		// 	loader.loadAsync('/textures/2k_earth_clouds.jpg'),
		// 	loader.loadAsync('/textures/2k_earth_normal_map.png'),
		// 	loader.loadAsync('/textures/2k_earth_specular_map.png')
		// ]);

		[day_texture, night_texture, cloud_texture, normal_map, specular_map] = await Promise.all([
			loader.loadAsync('/textures/8k_earth_daymap.avif'),
			loader.loadAsync('/textures/8k_earth_nightmap.avif'),
			loader.loadAsync('/textures/8k_earth_clouds.avif'),
			loader.loadAsync('/textures/8k_earth_normal_map.avif'),
			loader.loadAsync('/textures/8k_earth_specular_map.avif')
		]);

		day_texture.colorSpace = SRGBColorSpace;
		night_texture.colorSpace = SRGBColorSpace;
		cloud_texture.colorSpace = LinearSRGBColorSpace;

		normal_map.colorSpace = LinearSRGBColorSpace;
		specular_map.colorSpace = LinearSRGBColorSpace;

		earth_material!.onBeforeCompile = (shader) => {
			shader.uniforms.sunDirectionWorld = { value: sun_direction_world };

			// --- vertex shader injection ---
			shader.vertexShader = shader.vertexShader.replace(
				'#include <common>',
				`
				#include <common>
				varying vec3 vWorldNormal;
  				`
			);

			shader.vertexShader = shader.vertexShader.replace(
				'#include <beginnormal_vertex>',
				`
				#include <beginnormal_vertex>

				// transform object normal → world space
				vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
				`
			);

			// inject uniform
			shader.fragmentShader = shader.fragmentShader.replace(
				'#include <common>',
				`
				#include <common>
				uniform vec3 sunDirectionWorld;
				varying vec3 vWorldNormal;
				`
			);

			shader.fragmentShader = shader.fragmentShader.replace(
				'#include <emissivemap_fragment>',
				`
				#include <emissivemap_fragment>

				float ndotl = dot( normalize( vWorldNormal ), normalize( sunDirectionWorld ) );

				// 1.0 on night side, 0.0 on day side, smooth terminator
				float nightFactor = smoothstep(0.3, -0.2, ndotl);

				totalEmissiveRadiance *= nightFactor;
				`
			);

			earth_material_shader = shader;
		};
	});

	// When simulated_time updates we update the sun position
	$effect(() => {
		simulated_time;

		if (!earth_mesh || !earth_material_shader) {
			return;
		}

		let earth_position: Vector3 = new Vector3();

		earth_mesh.getWorldPosition(earth_position);
		sun_direction_world.copy(earth_position.normalize().negate());
	});

	// Loading sphere rotation
	let loading_sphere_rotation = $state(0);
	let t = 0;
	let rotation_amplitude = Math.PI / 4;
	let rotation_speed = 5;
	// Loading sphere geometry growth
	let growth_start = 2;
	let growth_end = 8;
	let growth_multiplier = 1;
	let loading_sphere_num_faces: number = $state(growth_start);
	useTask((delta) => {
		t += delta;

		loading_sphere_rotation = Math.sin(t * rotation_speed) * rotation_amplitude;

		// Align the change in number of faces with the end bounds of loading_sphere_rotation
		const current = Math.cos(t * rotation_speed);
		const next = Math.cos((t + delta) * rotation_speed);
		if (next * current < 0) {
			// We just crossed zero
			loading_sphere_num_faces = Math.min(loading_sphere_num_faces + growth_multiplier, growth_end);
			if (loading_sphere_num_faces >= growth_end || loading_sphere_num_faces <= growth_start) {
				growth_multiplier *= -1;
			}
		}
	});
</script>

{#if false && day_texture && night_texture && cloud_texture && normal_map && specular_map}
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
{:else}
	<T.Group scale={EARTH_RADIUS_KM}>
		<T.Mesh bind:rotation.y={loading_sphere_rotation}>
			<T.SphereGeometry args={[1, loading_sphere_num_faces, loading_sphere_num_faces]} />
			<T.MeshStandardMaterial
				wireframe={true}
				color={[...LOADING_WIREFRAME]}
				emissive={[...LOADING_WIREFRAME]}
				emissiveIntensity={0.3}
				toneMapped={false}
				depthWrite={false}
				opacity={0.5}
				transparent={true}
			/>
		</T.Mesh>
	</T.Group>
{/if}

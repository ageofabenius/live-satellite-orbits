<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import Earth from './Earth.svelte';
	import Satellites from './Satellites.svelte';
	import { PerspectiveCamera, Vector3, type DirectionalLight, type Group } from 'three';
	import { onMount } from 'svelte';

	let earth_orbit_group: Group | undefined = $state();
	let earth_rotate_group: Group | undefined = $state();

	let earth_mesh: Mesh | undefined = $state();

	let sun: DirectionalLight | undefined = $state();

	let camera: PerspectiveCamera | undefined = $state();
	let ghost_camera: PerspectiveCamera | undefined = $state();

	const EARTH_ORBIT_KM = 150_000_000;
	const YEAR_DAYS = 365.2422;

	const EARTH_AXIAL_TILT_RAD = (23.44 * Math.PI) / 180;

	function orbit_earth(target_date: Date) {
		console.log('orbiting...');
		// Compute the day of year and position the Earth group accordingly
		let day_of_year =
			// @ts-ignore
			(target_date - Date.UTC(target_date.getUTCFullYear(), 0, 0)) / 86_400_000;
		// Offset so that Spring equinox at March 20th-ish = angle 0, this will
		// simplify handling of the Earth's axial tilt
		let fractional_year = (day_of_year - 79) / YEAR_DAYS;
		let fractional_year_angle = fractional_year * Math.PI * 2;
		earth_orbit_group!.position.set(
			Math.cos(-fractional_year_angle) * EARTH_ORBIT_KM,
			0,
			Math.sin(-fractional_year_angle) * EARTH_ORBIT_KM
		);

		// Point the Sun towards the Earth
		sun?.target.position.copy(earth_orbit_group!.position);
		sun?.target.updateMatrixWorld();
	}

	function rotate_earth(target_date: Date) {
		let fractional_day = target_date.getUTCHours() / 24 + target_date.getUTCMinutes() / 1440;
		let fractional_day_angle = fractional_day * Math.PI * 2;
		// let new_earth_rotation = new Vector3(0, 0, 0);
		// new_earth_rotation.applyAxisAngle(new Vector3(0, 1, 0), fractional_day_angle);
		// earth_rotate_group!.rotation.set(
		// 	new_earth_rotation.x,
		// 	new_earth_rotation.y,
		// 	new_earth_rotation.z
		// );
		earth_rotate_group!.rotation.y = fractional_day_angle;
	}

	let fast_forward_hours = 0;
	let fast_forward_days = 0;
	function update_earth_group_position_and_rotation() {
		// let current_time = new Date();
		let current_time = new Date('2025-03-20T15:00:00+00:00');

		let simulated_time = new Date(
			current_time.getTime() + (fast_forward_days * 24 + fast_forward_hours) * 60 * 60 * 1000
		);

		orbit_earth(simulated_time);

		rotate_earth(simulated_time);

		console.log('simulated_time', simulated_time.toISOString());

		// fast_forward_days += 10;
		fast_forward_hours += 0.25;
	}

	onMount(() => {
		const orbit_update_interval = setInterval(update_earth_group_position_and_rotation, 1000);

		return () => {
			clearInterval(orbit_update_interval);
		};
	});

	useTask(() => {
		camera?.position.copy(ghost_camera!.position);
		camera?.quaternion.copy(ghost_camera!.quaternion);
	});
</script>

<!-- Sun -->
{#if earth_orbit_group}
	<!-- <T.Object3D bind:ref={sun_target} /> -->
	<T.DirectionalLight bind:ref={sun} />
	<T.AmbientLight intensity={0.02} />
{/if}

<!-- Earth orbit group -->
<T.Group bind:ref={earth_orbit_group}>
	<!-- Earth axial tilt group -->
	<T.Group rotation.z={EARTH_AXIAL_TILT_RAD}>
		<T.PerspectiveCamera
			bind:ref={camera}
			makeDefault
			position={[10_000, 10_000, 10_000]}
			lookAt={[0, 0, 0]}
			near={1}
			far={500_000}
		/>

		<!-- Earth day-rotation group -->
		<T.Group bind:ref={earth_rotate_group}>
			<Earth bind:earth_mesh />
		</T.Group>

		<Satellites {earth_mesh} />
	</T.Group>
</T.Group>

<T.PerspectiveCamera
	bind:ref={ghost_camera}
	position={[30_000, 30_000, 30_000]}
	near={1}
	far={500_000}
>
	<OrbitControls enableDamping enablePan={false} minDistance={10_000} maxDistance={100_000} />
</T.PerspectiveCamera>

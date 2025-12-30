<script lang="ts">
	import { onMount } from 'svelte';
	import { T, useTask, useThrelte } from '@threlte/core';
	import {
		ShaderMaterial,
		AdditiveBlending,
		Mesh,
		Points,
		Vector2,
		Vector3,
		BufferGeometry
	} from 'three';
	import vertex_shader from '../satellites/satellite.vert?raw';
	import fragment_shader from '../satellites/satellite.frag?raw';

	import { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

	import { interactivity, HTML } from '@threlte/extras';

	import { Line2 } from 'three/addons/lines/Line2.js';
	import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
	import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
	import { extend } from '@threlte/core';
	extend({
		Line2,
		LineGeometry,
		LineMaterial
	});

	import * as SceneColors from '../../../../../config/colors.config';
	import { propagate_one_orbit } from '$lib/satellite_orbits/propagate_tles';
	import { OrbitalRegime } from '$lib/satellite_orbits/orbital_regime';
	import { SatellitesDetailsComp } from './satellite_details.svelte';
	import type { SatRec } from 'satellite.js';

	const SATELLITE_BASE_SIZE = 5;
	const SATELLITE_HIGHLIGHTED_SIZE = 20;
	const RAYCASTER_PADDING = 200;
	const BASE_TRANSPARENCY = 1;

	let {
		tle,
		simulated_time,
		tick_rate_seconds
	}: {
		tle: [string, SatRec, OrbitalRegime];
		simulated_time: Date;
		tick_rate_seconds: number;
	} = $props();

	const { renderer } = useThrelte();

	let ctx = new SatellitesDetailsComp(
		// svelte-ignore state_referenced_locally
		tle,
		renderer,
		// svelte-ignore state_referenced_locally
		simulated_time,
		// svelte-ignore state_referenced_locally
		tick_rate_seconds,
		// svelte-ignore state_referenced_locally
		SATELLITE_HIGHLIGHTED_SIZE,
		SceneColors.SATELLITE_POINTS,
		BASE_TRANSPARENCY
	);

	$effect(() => {
		ctx.tick(simulated_time);
	});

	$effect(() => {
		ctx.set_tick_rate(tick_rate_seconds);
	});

	onMount(async () => {
		await ctx.on_mount();
	});

	useTask((delta) => {
		ctx.interpolate_position(delta);
	});

	const shader_material = new ShaderMaterial({
		vertexShader: vertex_shader,
		fragmentShader: fragment_shader,
		transparent: true,
		depthWrite: false,
		blending: AdditiveBlending
	});
</script>

<T.Points geometry={ctx.satellites_geometry} material={shader_material} />

<T.Line2 bind:ref={ctx.orbit_line}>
	<T.LineGeometry attach="geometry" />
	<T.LineMaterial
		bind:ref={ctx.orbit_line_material}
		attach="material"
		linewidth={2}
		transparent
		opacity={0.7}
	/>
</T.Line2>

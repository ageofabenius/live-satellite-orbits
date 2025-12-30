<script lang="ts">
	import { onMount } from 'svelte';
	import { T, useTask, useThrelte } from '@threlte/core';
	import { ShaderMaterial, AdditiveBlending, Mesh, Points, Vector2 } from 'three';
	import vertex_shader from './satellite.vert?raw';
	import fragment_shader from './satellite.frag?raw';

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
	import { SatellitesComp } from './satellites.svelte';
	import { OrbitalRegime } from '$lib/satellite_orbits/orbital_regime';
	import SatelliteDetails from './SatelliteDetails/SatelliteDetails.svelte';

	const SATELLITE_BASE_SIZE = 5;
	const SATELLITE_HIGHLIGHTED_SIZE = 20;
	const RAYCASTER_PADDING = 200;
	const BASE_TRANSPARENCY = 1;

	let {
		earth_mesh,
		simulated_time,
		tick_rate_seconds,
		orbit_controls,
		loading_started,
		loading_complete,
		loading_message
	}: {
		earth_mesh: Mesh;
		simulated_time: Date;
		tick_rate_seconds: number;
		orbit_controls: ThreeOrbitControls;
		loading_started: (name: string) => void;
		loading_complete: (name: string) => void;
		loading_message: (name: string) => void;
	} = $props();

	let ctx = new SatellitesComp(
		// svelte-ignore state_referenced_locally
		simulated_time,
		// svelte-ignore state_referenced_locally
		tick_rate_seconds,
		// svelte-ignore state_referenced_locally
		loading_started,
		// svelte-ignore state_referenced_locally
		loading_complete,
		// svelte-ignore state_referenced_locally
		loading_message,
		SATELLITE_BASE_SIZE,
		SATELLITE_HIGHLIGHTED_SIZE,
		RAYCASTER_PADDING,
		BASE_TRANSPARENCY,
		SceneColors.SATELLITE_POINTS
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

	onMount(() => {
		loading_started('Satellites');
	});

	let points_mesh: Points | null = $state(null);

	const { raycaster } = interactivity();
	raycaster.params.Points.threshold = RAYCASTER_PADDING;

	const shader_material = new ShaderMaterial({
		vertexShader: vertex_shader,
		fragmentShader: fragment_shader,
		transparent: true,
		depthWrite: false,
		blending: AdditiveBlending
	});

	useTask((delta) => {
		ctx.interpolate_positions(delta);
	});

	// Declared desired states
	let hovered_satellite_index: number | null = $state(null);
	let selected_satellite_indexes: number[] = $state([]);

	// Raycasting to highlight satellites on mouseover
	// Get the renderer and camera from Threlte
	const { renderer } = useThrelte();

	onMount(() => {
		const canvas = renderer.domElement;

		// Register to canvas pointermove event
		canvas.addEventListener('pointermove', on_canvas_pointer_move);

		// Register to canvas pointerdown and click events
		// These are used in conjunction to detect clicks that did not result in
		// OrbitControls camera moves
		canvas.addEventListener('pointerdown', on_canvas_pointerdown);
		canvas.parentElement!.addEventListener('click', on_canvas_click);

		// Register to keyup for Esc presses, these are used to deselect
		window.addEventListener('keyup', on_canvas_escape_up);

		return () => {
			canvas.removeEventListener('pointermove', on_canvas_pointer_move);
			canvas.removeEventListener('pointerdown', on_canvas_pointerdown);
			canvas.parentElement!.removeEventListener('click', on_canvas_click);
			window.removeEventListener('keyup', on_canvas_escape_up);
		};
	});

	function on_canvas_escape_up(e: any) {
		if (e.key === 'Escape') {
			selected_satellite_indexes = [];
		}
	}

	function on_canvas_pointer_move() {
		const hovered_satellite = raycast_mouse_to_satellite_points_index();

		if (!hovered_satellite) {
			if (hovered_satellite_index === null) {
				return;
			}
			hovered_satellite_index = null;
		} else {
			if (hovered_satellite_index === hovered_satellite) {
				// This occurs when the mouse moves while still hovering over the
				// same point
				return;
			}

			hovered_satellite_index = hovered_satellite;
		}
	}

	function raycast_mouse_to_satellite_points_index(): number | null {
		if (!raycaster.camera || !earth_mesh || !points_mesh) {
			// Scene is not yet fully initialized
			return null;
		}
		const intersections = raycaster.intersectObjects(
			[
				earth_mesh,
				// @ts-ignore
				points_mesh
			],
			true
		);

		let closest = null;
		let minDist = Infinity;

		for (const inter of intersections) {
			if (inter.object === earth_mesh) {
				// Ignore any intersections **behind** the Earth mesh, or with
				// the Earth mesh
				break;
			}

			const dist: number | undefined = inter.distanceToRay;

			if (dist && dist < minDist) {
				minDist = dist;
				closest = inter.index!;
			}
		}

		return closest;
	}

	let drag_start_position = new Vector2(0, 0);
	const DRAG_THRESHOLD = 10;
	function on_canvas_pointerdown(e: any) {
		// Record the start position of a potential drag
		[drag_start_position.x, drag_start_position.y] = [e.clientX, e.clientY];
	}

	function on_canvas_click(e: any) {
		const current_position = new Vector2(e.clientX, e.clientY);
		const dragged_distance = drag_start_position.distanceTo(current_position);
		// console.log(
		// 	'on_canvas_click called',
		// 	'drag_start_position',
		// 	drag_start_position,
		// 	'current_position',
		// 	current_position,
		// 	'dragged_distance',
		// 	dragged_distance
		// );
		if (dragged_distance > DRAG_THRESHOLD) {
			return;
		}

		const clicked_satellite = raycast_mouse_to_satellite_points_index();

		if (clicked_satellite && !selected_satellite_indexes.includes(clicked_satellite)) {
			selected_satellite_indexes = [...selected_satellite_indexes, clicked_satellite];
		}
	}

	// Register to OrbitControls zoom
	onMount(() => {
		orbit_controls.addEventListener('change', on_camera_move);
		return () => orbit_controls.removeEventListener('change', on_camera_move);
	});

	let leo_transparency = 1;
	function on_camera_move(e: any) {
		let camera_radius = e.target._spherical.radius;

		let new_leo_transparency = 1;
		if (camera_radius >= 80_000) {
			new_leo_transparency = 0.1;
		} else if (camera_radius >= 60_000) {
			new_leo_transparency = 0.25;
		}

		if (new_leo_transparency != leo_transparency) {
			ctx.tles.forEach(([_name, _satrec, orbital_regime], i) => {
				if (orbital_regime == OrbitalRegime.LEO) {
					ctx.transparencies![i] = new_leo_transparency;
				}
			});

			leo_transparency = new_leo_transparency;
			ctx.satellites_geometry!.attributes.transparency.needsUpdate = true;
		}
	}
</script>

<T.Points bind:ref={points_mesh} geometry={ctx.satellites_geometry} material={shader_material} />

{#if hovered_satellite_index}
	{#key hovered_satellite_index}
		{@const tle = ctx.tles[hovered_satellite_index]}
		<SatelliteDetails {tle} {simulated_time} {tick_rate_seconds} />
	{/key}
{/if}

{#each selected_satellite_indexes as index (index)}
	{@const tle = ctx.tles[index]}
	<SatelliteDetails {tle} {simulated_time} {tick_rate_seconds} />
{/each}

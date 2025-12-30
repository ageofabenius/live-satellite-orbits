<script lang="ts">
	import { onMount } from 'svelte';
	import type { PositionAndVelocity, SatRec } from 'satellite.js';
	import { T, useTask, useThrelte } from '@threlte/core';
	import {
		BufferGeometry,
		Vector3,
		ShaderMaterial,
		AdditiveBlending,
		BufferAttribute,
		Mesh,
		type Intersection,
		Points,
		Vector2
	} from 'three';
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
	import { EARTH_MU, OrbitalRegime } from '$lib/satellite_orbits/orbital_regime';
	import { load_tles } from '$lib/satellite_orbits/load_tles';
	import {
		propagate_one_orbit,
		propagate_tles_to_target_time
	} from '$lib/satellite_orbits/propagate_tles';
	import { eci_to_three } from '$lib/satellite_orbits/coordinate_transforms';
	import { format_duration } from '$lib/time';
	import { SatellitesComp } from './satellites.svelte';

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
		simulated_time,
		tick_rate_seconds,
		loading_started,
		loading_complete,
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

	const { invalidate } = useThrelte();

	const shader_material = new ShaderMaterial({
		vertexShader: vertex_shader,
		fragmentShader: fragment_shader,
		transparent: true,
		depthWrite: false,
		blending: AdditiveBlending
	});

	let orbit_line: Line2 | null = $state(null);
	let orbit_line_material: LineMaterial | null = $state(null);

	function update_line_resolution() {
		if (!orbit_line_material || !renderer) return;

		const canvas = renderer.domElement;

		orbit_line_material.resolution.set(canvas.clientWidth, canvas.clientHeight);
	}

	onMount(() => {
		update_line_resolution();

		window.addEventListener('resize', update_line_resolution);
		return () => window.removeEventListener('resize', update_line_resolution);
	});

	useTask((delta) => {
		ctx.interpolate_positions(delta);
	});

	// Declared desired states
	let hovered_satellite_index: number | null = null;
	let selected_satellite_index: number | null = $state(null);

	// Tracked states used to unhighlight previously highlighted points
	let last_hovered_satellite_index: number | null = null;
	let last_selected_satellite_index: number | null = null;

	function handle_highlight_and_orbit_display() {
		// Handle highlighting for both hovered and selected points
		if (selected_satellite_index === null && last_selected_satellite_index !== null) {
			// Handle unhighligting selected point
			unhighlight_point(last_selected_satellite_index);
			last_selected_satellite_index = null;
			selected_satellite_tooltip = null;
		} else if (selected_satellite_index !== null) {
			// First unhighlight previous one if needed
			if (last_selected_satellite_index) {
				unhighlight_point(last_selected_satellite_index);
				last_selected_satellite_index = null;
				selected_satellite_tooltip = null;
			}
			// Then highlight
			highlight_point(selected_satellite_index);
			last_selected_satellite_index = selected_satellite_index;
			selected_satellite_tooltip = satellite_tooptip(selected_satellite_index);
		}

		if (hovered_satellite_index === null && last_hovered_satellite_index !== null) {
			if (last_hovered_satellite_index === selected_satellite_index) {
				// Do nothing, this occurs when a satellite is first selected
				// and the mouse then leaves
				last_hovered_satellite_index = null;
				hovered_satellite_tooltip = null;
			} else {
				// Handle highlighting hovered point
				unhighlight_point(last_hovered_satellite_index);
				last_hovered_satellite_index = null;
				hovered_satellite_tooltip = null;
			}
		} else if (hovered_satellite_index !== null) {
			// First unhighlight previous one if needed
			if (last_hovered_satellite_index) {
				unhighlight_point(last_hovered_satellite_index);
				last_hovered_satellite_index = null;
				hovered_satellite_tooltip = null;
			}
			// Then highlight
			highlight_point(hovered_satellite_index);
			last_hovered_satellite_index = hovered_satellite_index;
			hovered_satellite_tooltip = satellite_tooptip(hovered_satellite_index);
		}

		// Handle displaying orbit of selected, then hovered if no selected
		if (selected_satellite_index !== null) {
			show_orbit(selected_satellite_index);
		} else if (hovered_satellite_index !== null) {
			show_orbit(hovered_satellite_index);
		} else {
			hide_orbit();
		}
	}

	function highlight_point(index: number) {
		ctx.point_sizes![index] = SATELLITE_HIGHLIGHTED_SIZE;
		ctx.satellites_geometry!.attributes.size.needsUpdate = true;
		invalidate();
	}

	function unhighlight_point(index: number) {
		ctx.point_sizes![index] = SATELLITE_BASE_SIZE;
		ctx.satellites_geometry!.attributes.size.needsUpdate = true;
		invalidate();
	}

	function show_orbit(index: number) {
		const orbit_positions = propagate_one_orbit(ctx.tles[index][1], simulated_time);
		if (orbit_positions) {
			orbit_line!.geometry.setPositions(orbit_positions.flatMap((p) => [p.x, p.y, p.z]));
			orbit_line!.computeLineDistances();
		}
	}

	function hide_orbit() {
		// geometry needs at least 1 point or it errors
		orbit_line!.geometry.setPositions([0, 0, 0]);
		orbit_line!.computeLineDistances();
		invalidate();
	}

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
			selected_satellite_index = null;
			handle_highlight_and_orbit_display();
		}
	}

	function on_canvas_pointer_move() {
		const hovered_satellite = raycast_mouse_to_satellite();

		// console.log(`on_canvas_pointer_move intersecting with ${intersections.length} objects`);

		if (!hovered_satellite) {
			if (hovered_satellite_index === null) {
				// This occurs when the mouse moves while still hovering over the
				// same point
				return;
			}
			hovered_satellite_index = null;
			handle_highlight_and_orbit_display();
		} else {
			if (hovered_satellite_index === hovered_satellite.index) {
				// This occurs when the mouse moves while still hovering over the
				// same point
				return;
			}

			hovered_satellite_index = hovered_satellite.index!;
			handle_highlight_and_orbit_display();
		}
	}

	function raycast_mouse_to_satellite(): Intersection | null {
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
				closest = inter;
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

		const clicked_satellite = raycast_mouse_to_satellite();

		// console.log(`on_canvas_pointer_move intersecting with ${intersections.length} objects`);

		if (!clicked_satellite) {
			if (selected_satellite_index === null) {
				// This occurs when the mouse moves while still hovering over the
				// same point
				return;
			}
			selected_satellite_index = null;
		} else {
			if (selected_satellite_index === clicked_satellite.index) {
				// This occurs when the mouse moves while still hovering over the
				// same point
				return;
			}

			selected_satellite_index = clicked_satellite.index!;
		}
		handle_highlight_and_orbit_display();
	}

	// Reactive state for satellite tooltip display
	type SatelliteTooltip = {
		position: Vector3;
		name: string;
		orbital_regime: OrbitalRegime;
		period: string;
		semi_major_axis: string;
		eccentricity: string;
		inclination_deg: string;
	};
	let hovered_satellite_tooltip: SatelliteTooltip | null = $state(null);
	let selected_satellite_tooltip: SatelliteTooltip | null = $state(null);

	function satellite_tooptip(satellite_index: number): SatelliteTooltip {
		const satrec = ctx.tles[satellite_index][1];

		const mean_motion_rad_per_sec = satrec.no / 60;
		const mean_motion_rev_per_day = (satrec.no * 1440) / (2 * Math.PI);
		const inclination_deg = (satrec.inclo * 180) / Math.PI;
		const eccentricity = satrec.ecco;

		const semi_major_axis = Math.cbrt(
			EARTH_MU / (mean_motion_rad_per_sec * mean_motion_rad_per_sec)
		);

		const period_seconds = 86400 / mean_motion_rev_per_day;

		return {
			name: ctx.tles[satellite_index][0],
			position: ctx.target_satellite_positions[satellite_index][1],
			orbital_regime: ctx.tles[satellite_index][2],
			period: format_duration(period_seconds),
			semi_major_axis: `${semi_major_axis.toFixed(0)} km`,
			eccentricity: `${eccentricity.toFixed(6)}`,
			inclination_deg: `${inclination_deg.toFixed(1)}°`
		};
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

<T.Line2 bind:ref={orbit_line}>
	<T.LineGeometry attach="geometry" />
	<T.LineMaterial
		bind:ref={orbit_line_material}
		attach="material"
		linewidth={2}
		transparent
		opacity={0.7}
	/>
</T.Line2>

{#if hovered_satellite_tooltip}
	<HTML
		position={[
			hovered_satellite_tooltip.position.x,
			hovered_satellite_tooltip.position.y,
			hovered_satellite_tooltip.position.z
		]}
		class="pointer-events-none"
	>
		<div
			class="
				rounded-lg
				border {SceneColors.TOOLTIP_EDGE}
				{SceneColors.TOOLTIP_FILL}
				backdrop-blur-md
				px-3 py-2
				pointer-events-none
			"
		>
			<div
				class="
					absolute
					inset-0
					rounded-xl
					{SceneColors.TOOLTIP_GLOW}
					blur-lg
				"
			></div>
			<div class="flex flex-col gap-1 whitespace-nowrap">
				<span class="text-sm font-semibold tracking-wide {SceneColors.TOOLTIP_HEADER_TEXT}">
					{hovered_satellite_tooltip.name}
				</span>

				<div
					class="text-xs {SceneColors.TOOLTIP_REGULAR_TEXT} grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5"
				>
					<span class="col-span-2">{OrbitalRegime[hovered_satellite_tooltip.orbital_regime]}</span>

					<span class={SceneColors.TOOLTIP_MUTED_TEXT}>period</span>
					<span class="text-right"> {hovered_satellite_tooltip.period}</span>

					<span class={SceneColors.TOOLTIP_MUTED_TEXT}>semi-major axis</span>
					<span class="text-right">{hovered_satellite_tooltip.semi_major_axis}</span>

					<span class={SceneColors.TOOLTIP_MUTED_TEXT}>eccentricity</span>
					<span class="text-right"> {hovered_satellite_tooltip.eccentricity}</span>

					<span class={SceneColors.TOOLTIP_MUTED_TEXT}>inclination</span>
					<span class="text-right"> {hovered_satellite_tooltip.inclination_deg}</span>
				</div>
			</div>
		</div>
	</HTML>
{/if}

{#if selected_satellite_tooltip}
	<HTML
		position={[
			selected_satellite_tooltip.position.x,
			selected_satellite_tooltip.position.y,
			selected_satellite_tooltip.position.z
		]}
		class="pointer-events-none"
	>
		<div
			class="
				rounded-lg
				border {SceneColors.TOOLTIP_EDGE}
				{SceneColors.TOOLTIP_FILL}
				backdrop-blur-md
				px-3 py-2
				pointer-events-none
			"
		>
			<div
				class="
					absolute
					inset-0
					rounded-xl
					{SceneColors.TOOLTIP_GLOW}
					blur-lg
				"
			></div>
			<div class="flex flex-col gap-1 whitespace-nowrap">
				<span class="text-sm font-semibold tracking-wide {SceneColors.TOOLTIP_HEADER_TEXT}">
					{selected_satellite_tooltip.name}
				</span>

				<div
					class="text-xs {SceneColors.TOOLTIP_REGULAR_TEXT} grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5"
				>
					<span class="col-span-2">{OrbitalRegime[selected_satellite_tooltip.orbital_regime]}</span>

					<span class={SceneColors.TOOLTIP_MUTED_TEXT}>period</span>
					<span class="text-right"> {selected_satellite_tooltip.period}</span>

					<span class={SceneColors.TOOLTIP_MUTED_TEXT}>semi-major axis</span>
					<span class="text-right">{selected_satellite_tooltip.semi_major_axis}</span>

					<span class={SceneColors.TOOLTIP_MUTED_TEXT}>eccentricity</span>
					<span class="text-right"> {selected_satellite_tooltip.eccentricity}</span>

					<span class={SceneColors.TOOLTIP_MUTED_TEXT}>inclination</span>
					<span class="text-right"> {selected_satellite_tooltip.inclination_deg}</span>
				</div>
			</div>
		</div>
	</HTML>
{/if}

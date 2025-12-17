<script lang="ts">
	// TO-DO: Validate that satellite points mesh is correctly oriented

	// TO-DO: Selecting one satellite then mousing over empty space
	// un-highlights the selected satellite, mousing over another satellite then
	// correctly re-highlights the selected satellite

	// TO-DO: Tooltips are interfering with the functionality to click to select
	// a satellite

	// TO-DO: To raycast to distance satellites, we should increase the
	// RAYCASTER_PADDING significantly and then add another check in
	// raycast_to_satellite that we're under a certain **screen-space**
	// threshold

	import { onMount } from 'svelte';
	import {
		EARTH_MU,
		eci_to_three,
		load_tles,
		OrbitalRegime,
		propagate_one_orbit,
		propagate_tles_to_target_time
	} from './load_tles';
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

	const SATELLITE_BASE_SIZE = 5;
	const SATELLITE_HIGHLIGHTED_SIZE = 20;
	const RAYCASTER_PADDING = 200;
	const BASE_TRANSPARENCY = 1;

	const OrbitalRegimeColorMap: Record<OrbitalRegime, Vector3> = {
		[OrbitalRegime.LEO]: new Vector3(0.75, 0.84, 0.92),
		[OrbitalRegime.MEO]: new Vector3(0.75, 0.84, 0.92),
		[OrbitalRegime.GEO]: new Vector3(0.75, 0.84, 0.92),
		[OrbitalRegime.Other]: new Vector3(0.75, 0.84, 0.92)
	};

	let {
		earth_mesh,
		simulated_time,
		tick_rate_seconds,
		orbit_controls
	}: {
		earth_mesh: Mesh;
		simulated_time: Date;
		tick_rate_seconds: number;
		orbit_controls: ThreeOrbitControls;
	} = $props();

	let points_mesh: Points | null = $state(null);

	const { raycaster } = interactivity();
	raycaster.params.Points.threshold = RAYCASTER_PADDING;

	const { invalidate } = useThrelte();

	let tles: [string, SatRec, OrbitalRegime][] = [];

	const shader_material = new ShaderMaterial({
		vertexShader: vertex_shader,
		fragmentShader: fragment_shader,
		transparent: true,
		depthWrite: false,
		blending: AdditiveBlending
	});

	$effect(() => {
		propagate_new_target_positions(tles, simulated_time);
	});

	let start_satellite_positions: [string, Vector3][] = [];
	let target_satellite_positions: [string, Vector3][] = [];
	let interpolated_elapsed_seconds = 0;

	let satellites_geometry: BufferGeometry = $state(new BufferGeometry());
	let satellites_position_attribute: BufferAttribute | null = null;

	let point_sizes: Float32Array | null = null;

	let colors: Float32Array | null = null;

	let transparencies: Float32Array | null = null;
	let satellites_transparency_attribute: BufferAttribute | null = null;

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

	onMount(async () => {
		// Load TLEs
		tles = await load_tles();

		// Initialize size array and set base point sizes
		point_sizes = new Float32Array(tles.length).fill(SATELLITE_BASE_SIZE);
		satellites_geometry.setAttribute('size', new BufferAttribute(point_sizes, 1));

		// Initialize color array and set point colors
		colors = new Float32Array(tles.length * 3).fill(1);
		tles.forEach(([_name, _satrec, orbital_regime], i) => {
			const color = OrbitalRegimeColorMap[orbital_regime].clone();
			colors![i * 3] = color.x;
			colors![i * 3 + 1] = color.y;
			colors![i * 3 + 2] = color.z;
		});
		satellites_geometry.setAttribute('color', new BufferAttribute(colors, 3));

		transparencies = new Float32Array(tles.length).fill(1);
		satellites_transparency_attribute = satellites_geometry.getAttribute(
			'transparency'
		) as BufferAttribute;
		satellites_geometry.setAttribute(
			'transparency',
			new BufferAttribute(transparencies, BASE_TRANSPARENCY)
		);

		// Initialize position array and set initial point positions
		satellites_geometry.setAttribute(
			'position',
			new BufferAttribute(new Float32Array(tles.length * 3), 3)
		);

		satellites_position_attribute = satellites_geometry.getAttribute('position') as BufferAttribute;

		start_satellite_positions = propagate_to_time(tles, simulated_time);
		target_satellite_positions = start_satellite_positions;

		for (let i = 0; i < start_satellite_positions.length; i++) {
			// Set start positions
			const [name, position] = start_satellite_positions[i];
			satellites_position_attribute.setXYZ(i, position.x, position.y, position.z);
		}
	});

	function propagate_to_time(
		tles: [string, SatRec, OrbitalRegime][],
		target_time: Date
	): [string, Vector3][] {
		let positions_and_velocities: [string, PositionAndVelocity | null][] =
			propagate_tles_to_target_time(tles, target_time);

		return positions_and_velocities.map(([name, pos_and_vel]) => {
			const position = pos_and_vel ? eci_to_three(pos_and_vel.position) : new Vector3(0, 0, 0);
			return [name, position];
		});
	}

	function propagate_new_target_positions(
		tles: [string, SatRec, OrbitalRegime][],
		target_time: Date
	) {
		start_satellite_positions = target_satellite_positions;
		target_satellite_positions = propagate_to_time(tles, target_time);
		interpolated_elapsed_seconds = 0;
	}

	useTask((delta) => {
		if (!satellites_position_attribute) {
			return;
		}
		if (interpolated_elapsed_seconds >= tick_rate_seconds) {
			return;
		}

		interpolated_elapsed_seconds += delta;
		// Bound to tick rate
		const t = Math.min(interpolated_elapsed_seconds / tick_rate_seconds, 1);
		for (let i = 0; i < start_satellite_positions.length; i++) {
			const start = start_satellite_positions[i][1];
			const target = target_satellite_positions[i][1];

			const x = start.x + (target.x - start.x) * t;
			const y = start.y + (target.y - start.y) * t;
			const z = start.z + (target.z - start.z) * t;

			satellites_position_attribute.setXYZ(i, x, y, z);
		}
		satellites_position_attribute.needsUpdate = true;
		satellites_geometry.computeBoundingSphere();
		satellites_geometry.computeBoundingBox();
	});

	// Declared desired states
	let hovered_satellite_index: number | null = null;
	let selected_satellite_index: number | null = $state(null);

	// Tracked states used to unhighlight previously highlighted points
	let last_hovered_satellite_index: number | null = null;
	let last_selected_satellite_index: number | null = null;

	function handle_highlight_and_orbit_display() {
		// Handle highlighting for both hovered and selected points
		if (!selected_satellite_index && last_selected_satellite_index) {
			// Handle unhighligting selected point
			unhighlight_point(last_selected_satellite_index);
			last_selected_satellite_index = null;
			selected_satellite_tooltip = null;
		} else if (selected_satellite_index) {
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

		if (!hovered_satellite_index && last_hovered_satellite_index) {
			// Handle highlighting hovered point
			unhighlight_point(last_hovered_satellite_index);
			last_hovered_satellite_index = null;
			hovered_satellite_tooltip = null;
		} else if (hovered_satellite_index) {
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
		if (selected_satellite_index) {
			show_orbit(selected_satellite_index);
		} else if (hovered_satellite_index) {
			show_orbit(hovered_satellite_index);
		} else {
			hide_orbit();
		}
	}

	function highlight_point(index: number) {
		point_sizes![index] = SATELLITE_HIGHLIGHTED_SIZE;
		satellites_geometry!.attributes.size.needsUpdate = true;
		invalidate();
	}

	function unhighlight_point(index: number) {
		point_sizes![index] = SATELLITE_BASE_SIZE;
		satellites_geometry!.attributes.size.needsUpdate = true;
		invalidate();
	}

	function show_orbit(index: number) {
		const orbit_positions = propagate_one_orbit(tles[index][1], simulated_time);
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
		const satrec = tles[satellite_index][1];

		const mean_motion_rad_per_sec = satrec.no / 60;
		const mean_motion_rev_per_day = (satrec.no * 1440) / (2 * Math.PI);
		const inclination_deg = (satrec.inclo * 180) / Math.PI;
		const eccentricity = satrec.ecco;

		const semi_major_axis = Math.cbrt(
			EARTH_MU / (mean_motion_rad_per_sec * mean_motion_rad_per_sec)
		);

		const period_seconds = 86400 / mean_motion_rev_per_day;

		return {
			name: tles[satellite_index][0],
			position: target_satellite_positions[satellite_index][1],
			orbital_regime: tles[satellite_index][2],
			period: format_duration(period_seconds),
			semi_major_axis: `${semi_major_axis.toFixed(0)} km`,
			eccentricity: `${eccentricity.toFixed(6)}`,
			inclination_deg: `${inclination_deg.toFixed(1)}°`
		};
	}

	function format_duration(duration_seconds: number): string {
		const days = Math.floor(duration_seconds / 86_400);
		let remainder_seconds = duration_seconds % 86_400;

		const hours = Math.floor(remainder_seconds / 3600);
		remainder_seconds = remainder_seconds % 3600;

		const minutes = Math.floor(remainder_seconds / 60);
		remainder_seconds = remainder_seconds % 60;

		const seconds = Math.floor(remainder_seconds);

		let s = [];
		if (days >= 1) {
			s.push(`${days}d`);
		}
		s.push(`${hours}h`);
		s.push(`${minutes}m`);
		s.push(`${seconds}s`);

		return s.join(' ');
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
			tles.forEach(([_name, _satrec, orbital_regime], i) => {
				if (orbital_regime == OrbitalRegime.LEO) {
					transparencies![i] = new_leo_transparency;
				}
			});

			leo_transparency = new_leo_transparency;
			satellites_geometry!.attributes.transparency.needsUpdate = true;
		}
	}
</script>

{#if satellites_geometry}
	<T.Points bind:ref={points_mesh} geometry={satellites_geometry} material={shader_material} />
{/if}

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
	>
		<div
			class="
				rounded-lg
				border border-cyan-400/30
				bg-black/60
				backdrop-blur-md
				px-4 py-2
				pointer-events-none
			"
		>
			<div
				class="
					absolute
					inset-0
					rounded-xl
					bg-cyan-400/10
					blur-lg
				"
			></div>
			<div class="flex flex-col gap-1 whitespace-nowrap">
				<span class="text-sm font-semibold tracking-wide text-cyan-200">
					{hovered_satellite_tooltip.name}
				</span>

				<div class="text-xs text-slate-300 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
					<span class="col-span-2">{OrbitalRegime[hovered_satellite_tooltip.orbital_regime]}</span>

					<span class="text-neutral-500">period</span>
					<span class="text-right"> {hovered_satellite_tooltip.period}</span>

					<span class="text-neutral-500">semi-major axis</span>
					<span class="text-right">{hovered_satellite_tooltip.semi_major_axis}</span>

					<span class="text-neutral-500">eccentricity</span>
					<span class="text-right"> {hovered_satellite_tooltip.eccentricity}</span>

					<span class="text-neutral-500">inclination</span>
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
	>
		<div
			class="
				rounded-lg
				border border-cyan-400/30
				bg-black/60
				backdrop-blur-md
				px-4 py-2
				pointer-events-none
			"
		>
			<div
				class="
					absolute
					inset-0
					rounded-xl
					bg-cyan-400/10
					blur-lg
				"
			></div>
			<div class="flex flex-col gap-1 whitespace-nowrap">
				<span class="text-sm font-semibold tracking-wide text-cyan-200">
					{selected_satellite_tooltip.name}
				</span>

				<div class="text-xs text-slate-300 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
					<span class="col-span-2">{OrbitalRegime[selected_satellite_tooltip.orbital_regime]}</span>

					<span class="text-neutral-500">period</span>
					<span class="text-right"> {selected_satellite_tooltip.period}</span>

					<span class="text-neutral-500">semi-major axis</span>
					<span class="text-right">{selected_satellite_tooltip.semi_major_axis}</span>

					<span class="text-neutral-500">eccentricity</span>
					<span class="text-right"> {selected_satellite_tooltip.eccentricity}</span>

					<span class="text-neutral-500">inclination</span>
					<span class="text-right"> {selected_satellite_tooltip.inclination_deg}</span>
				</div>
			</div>
		</div>
	</HTML>
{/if}

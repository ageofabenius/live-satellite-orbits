<script lang="ts">
	// TO-DO: Validate that satellite points mesh is correctly oriented

	import { onMount } from 'svelte';
	import {
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

	import { interactivity } from '@threlte/extras';

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

	let hovered_satellite_index: number | null = null;
	let selected_satellite_index: number | null = null;

	let highlighted_satellite_index: number | null = null;
	let displayed_orbit_index: number | null = null;
	function highlight_point(index: number) {
		if (hovered_satellite_index !== null) {
			unhighlight_point();
		}

		highlighted_satellite_index = index;

		point_sizes![highlighted_satellite_index] = SATELLITE_HIGHLIGHTED_SIZE;
		satellites_geometry!.attributes.size.needsUpdate = true;
		invalidate();
	}

	function unhighlight_point() {
		if (highlighted_satellite_index === null) {
			return;
		}

		point_sizes![highlighted_satellite_index] = SATELLITE_BASE_SIZE;
		satellites_geometry!.attributes.size.needsUpdate = true;
		invalidate();

		highlighted_satellite_index = null;
	}

	function show_orbit(index: number) {
		const orbit_positions = propagate_one_orbit(tles[index][1], simulated_time);
		if (orbit_positions) {
			orbit_line!.geometry.setPositions(orbit_positions.flatMap((p) => [p.x, p.y, p.z]));
			orbit_line!.computeLineDistances();

			displayed_orbit_index = index;
		}
	}

	function hide_orbit() {
		if (displayed_orbit_index === null) {
			return;
		}
		// geometry needs at least 1 point or it errors
		orbit_line!.geometry.setPositions([0, 0, 0]);
		orbit_line!.computeLineDistances();
		invalidate();

		displayed_orbit_index = null;
	}

	// Raycasting to highlight satellites on mouseover
	// Get the renderer and camera from Threlte
	const { renderer } = useThrelte();

	onMount(() => {
		const canvas = renderer.domElement;

		// Register to canvas pointermove event
		canvas.addEventListener('pointermove', on_canvas_pointer_move);

		// Register to canvas click event
		canvas.addEventListener('pointerdown', on_canvas_pointerdown);
		canvas.parentElement!.addEventListener('click', on_canvas_click);

		return () => {
			canvas.removeEventListener('pointermove', on_canvas_pointer_move);
			canvas.removeEventListener('pointerdown', on_canvas_pointerdown);
			canvas.parentElement!.removeEventListener('click', on_canvas_click);
		};
	});

	function handle_highlight_and_orbit_display() {
		// console.log(
		// 	`handle_highlight_and_orbit_display with hovered, selected: ${hovered_satellite_index}, ${selected_satellite_index}`
		// );
		if (selected_satellite_index) {
			highlight_point(selected_satellite_index);
			show_orbit(selected_satellite_index);
		} else if (hovered_satellite_index) {
			highlight_point(hovered_satellite_index);
			show_orbit(hovered_satellite_index);
		} else {
			unhighlight_point();
			hide_orbit();
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

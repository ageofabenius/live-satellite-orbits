<script lang="ts">
	import { onMount } from 'svelte';
	import { eci_to_three, load_tles, propagate_tles_to_target_time } from './load_tles';
	import type { PositionAndVelocity, SatRec } from 'satellite.js';
	import { T, useTask, useThrelte, type CurrentWritable } from '@threlte/core';
	import {
		BufferGeometry,
		Vector3,
		ShaderMaterial,
		AdditiveBlending,
		BufferAttribute,
		WebGLRenderer,
		Camera,
		Mesh,
		type Intersection
	} from 'three';
	import vertex_shader from './satellite.vert?raw';
	import fragment_shader from './satellite.frag?raw';

	import { interactivity } from '@threlte/extras';

	const SATELLITE_BASE_SIZE = 5;
	const SATELLITE_HIGHLIGHTED_SIZE = 20;
	const RAYCASTER_PADDING = 200;

	let {
		earth_mesh,
		simulated_time,
		tick_rate_seconds
	}: {
		earth_mesh: Mesh;
		simulated_time: Date;
		tick_rate_seconds: number;
	} = $props();

	let points_mesh: Mesh | null = $state(null);

	const { raycaster } = interactivity();
	raycaster.params.Points.threshold = RAYCASTER_PADDING;

	const { invalidate } = useThrelte();

	let tles: [string, SatRec][] = [];

	const shader_material = new ShaderMaterial({
		vertexShader: vertex_shader,
		fragmentShader: fragment_shader,
		transparent: true,
		depthWrite: false,
		blending: AdditiveBlending
	});

	$effect(() => {
		console.log('simulated_time in Satellites.svelte', simulated_time);

		propagate_new_target_positions(tles, simulated_time);
	});

	let start_satellite_positions: [string, Vector3][] = [];
	let target_satellite_positions: [string, Vector3][] = [];
	let interpolated_elapsed_seconds = 0;

	let satellites_geometry: BufferGeometry = $state(new BufferGeometry());

	let point_sizes: Float32Array | null = null;

	let satellites_position_attribute: BufferAttribute | null = null;

	onMount(async () => {
		tles = await load_tles();

		satellites_geometry.setAttribute(
			'position',
			new BufferAttribute(new Float32Array(tles.length * 3), 3)
		);

		satellites_position_attribute = satellites_geometry.getAttribute('position') as BufferAttribute;

		point_sizes = new Float32Array(tles.length).fill(SATELLITE_BASE_SIZE);
		satellites_geometry.setAttribute('size', new BufferAttribute(point_sizes, 1));

		start_satellite_positions = propagate_to_time(tles, simulated_time);
		target_satellite_positions = start_satellite_positions;

		for (let i = 0; i < start_satellite_positions.length; i++) {
			const [name, position] = start_satellite_positions[i];
			satellites_position_attribute.setXYZ(i, position.x, position.y, position.z);
		}
	});

	function propagate_to_time(tles: [string, SatRec][], target_time: Date): [string, Vector3][] {
		let positions_and_velocities: [string, PositionAndVelocity | null][] =
			propagate_tles_to_target_time(tles, target_time);

		return positions_and_velocities.map(([name, pos_and_vel]) => {
			const position = pos_and_vel ? eci_to_three(pos_and_vel.position) : new Vector3(0, 0, 0);
			return [name, position];
		});
	}

	function propagate_new_target_positions(tles: [string, SatRec][], target_time: Date) {
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

	let highlighted_index: number | null = null;
	function highlight_point(index: number) {
		if (highlighted_index !== null) {
			unhighlight_point();
		}

		highlighted_index = index;

		point_sizes![highlighted_index] = SATELLITE_HIGHLIGHTED_SIZE;
		satellites_geometry!.attributes.size.needsUpdate = true;
		invalidate();
	}

	function unhighlight_point() {
		if (highlighted_index === null) {
			return;
		}

		point_sizes![highlighted_index] = SATELLITE_BASE_SIZE;
		satellites_geometry!.attributes.size.needsUpdate = true;
		invalidate();

		highlighted_index = null;
	}

	// Raycasting to highlight satellites on mouseover
	// Get the renderer and camera from Threlte
	const { renderer, camera } = useThrelte();

	// Register to canvas pointermove event
	onMount(() => {
		const canvas = renderer.domElement;
		canvas.addEventListener('pointermove', on_canvas_pointer_move);
		return () => canvas.removeEventListener('pointermove', on_canvas_pointer_move);
	});

	function on_canvas_pointer_move(e: any) {
		const intersections = raycaster.intersectObjects(
			[
				earth_mesh,
				// @ts-ignore
				points_mesh
			],
			true
		);

		// console.log(`on_canvas_pointer_move intersecting with ${intersections.length} objects`);

		if (!intersections.length) {
			unhighlight_point();
		} else if (intersections.length > 0) {
			const canvas = renderer.domElement;
			const rect = canvas.getBoundingClientRect();

			const mouse = {
				x: (e.clientX * 0.5 + 0.5) * rect.width,
				y: (1 - (e.clientY * 0.5 + 0.5)) * rect.height
			};

			const closest = closest_intersected_satellite(intersections, mouse);

			if (closest) {
				highlight_point(closest.index!);
			}
		}
	}

	function closest_intersected_satellite(
		intersections: Intersection[],
		mouse: {
			x: number;
			y: number;
		}
	): Intersection | null {
		let closest = null;
		let minDist = Infinity;

		for (const inter of intersections) {
			if (inter.object === earth_mesh) {
				// Ignore any intersections behind the Earth mesh
				break;
			}

			const pointIndex = inter.index!;

			// Get world position of this point
			const [tle, pos] = target_satellite_positions![pointIndex];

			const dist = screen_space_distance(renderer, camera, pos, mouse);

			if (dist < minDist) {
				minDist = dist;
				closest = inter;
			}
		}

		return closest;
	}

	function screen_space_distance(
		renderer: WebGLRenderer,
		camera: CurrentWritable<Camera>,
		point: Vector3,
		mouse: {
			x: number;
			y: number;
		}
	) {
		const vector = point.clone().project(camera.current);

		const width = renderer.domElement.clientWidth;
		const height = renderer.domElement.clientHeight;

		const px = (vector.x * 0.5 + 0.5) * width;
		const py = (vector.y * -0.5 + 0.5) * height;

		const dx = px - mouse.x;
		const dy = py - mouse.y;

		return Math.sqrt(dx * dx + dy * dy);
	}
</script>

{#if satellites_geometry}
	<T.Points bind:ref={points_mesh} geometry={satellites_geometry} material={shader_material} />
{/if}

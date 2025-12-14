<script lang="ts">
	import { onMount } from 'svelte';
	import { eci_to_three, load_tles, propagate_tles_to_target_time, type TLE } from './load_tles';
	import type { PositionAndVelocity, SatRec } from 'satellite.js';
	import { T, useThrelte, type CurrentWritable } from '@threlte/core';
	import {
		BufferGeometry,
		Vector3,
		ShaderMaterial,
		AdditiveBlending,
		BufferAttribute,
		WebGLRenderer,
		Camera,
		Mesh
	} from 'three';
	import vertex_shader from './satellite.vert?raw';
	import fragment_shader from './satellite.frag?raw';

	import { interactivity } from '@threlte/extras';

	const SATELLITE_BASE_SIZE = 5;
	const SATELLITE_HIGHLIGHTED_SIZE = 20;
	const RAYCASTER_PADDING = 200;

	let {
		earth_mesh,
		simulated_time
	}: {
		earth_mesh: Mesh;
		simulated_time: Date;
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

		propagate_to_time(tles, simulated_time);
	});

	// let positions_and_velocities: [string, PositionAndVelocity][] = $derived.by(() => {
	// 	console.log('positions_and_velocities deriving...', 'simulated_time', simulated_time);
	// 	if (!tles) {
	// 		return [];
	// 	}
	// 	return propagate_tles_to_target_time(tles, simulated_time);
	// });

	// let satellite_positions: [TLE, Vector3][] = $derived.by(() => {
	// 	return positions_and_velocities.map(([tle, position_and_velocity]) => {
	// 		return [{ ...tle }, eci_to_three(position_and_velocity.position)];
	// 	});
	// });

	let satellite_positions: [string, Vector3][] = [];

	let satellites_geometry: BufferGeometry = $state(new BufferGeometry());

	let point_sizes: Float32Array | null = null;

	onMount(async () => {
		tles = await load_tles();

		satellites_geometry.setAttribute(
			'position',
			new BufferAttribute(new Float32Array(tles.length * 3), 3)
		);

		point_sizes = new Float32Array(tles.length).fill(SATELLITE_BASE_SIZE);
		satellites_geometry.setAttribute('size', new BufferAttribute(point_sizes, 1));

		propagate_to_time(tles, simulated_time);
	});

	function propagate_to_time(tles: [string, SatRec][], target_time: Date) {
		let positions_and_velocities: [string, PositionAndVelocity | null][] =
			propagate_tles_to_target_time(tles, target_time);

		satellite_positions = positions_and_velocities.map(([name, pos_and_vel]) => {
			const position = pos_and_vel ? eci_to_three(pos_and_vel.position) : new Vector3(0, 0, 0);
			return [name, position];
		});

		const position_attribute: BufferAttribute = satellites_geometry.getAttribute(
			'position'
		) as BufferAttribute;

		if (!position_attribute) {
			return;
		}

		for (let i = 0; i < satellite_positions.length; i++) {
			const [name, position] = satellite_positions[i];
			position_attribute.setXYZ(i, position.x, position.y, position.z);
		}

		position_attribute.needsUpdate = true;
	}

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

	// Get the renderer and camera from Threlte
	const { renderer, camera } = useThrelte();
	function handle_pointer_enter_satellite(e: any) {
		const intersections = raycaster.intersectObjects([earth_mesh, points_mesh], true);

		if (!intersections.length) return;

		const canvas = renderer.domElement;
		const rect = canvas.getBoundingClientRect();

		const mouse = {
			x: (e.pointer.x * 0.5 + 0.5) * rect.width,
			y: (1 - (e.pointer.y * 0.5 + 0.5)) * rect.height
		};

		let closest = null;
		let minDist = Infinity;

		for (const inter of intersections) {
			if (inter.object === earth_mesh) {
				// Ignore any intersections behind the Earth mesh
				break;
			}

			const pointIndex = inter.index!;

			// Get world position of this point
			const [tle, pos] = satellite_positions![pointIndex];

			const dist = screenSpaceDistance(renderer, camera, pos, mouse);

			if (dist < minDist) {
				minDist = dist;
				closest = inter;
			}
		}

		if (closest) {
			highlight_point(closest.index!);
		}
	}

	function screenSpaceDistance(
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

	function handle_pointer_leave_satellite(e: any) {
		unhighlight_point();
	}
</script>

{#if satellites_geometry}
	<T.Points
		bind:ref={points_mesh}
		geometry={satellites_geometry}
		material={shader_material}
		onpointerenter={handle_pointer_enter_satellite}
		onpointerleave={handle_pointer_leave_satellite}
	/>
{/if}

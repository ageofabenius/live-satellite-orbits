<script lang="ts">
	// TO-DO: Fix axes so z is north pole Once mesh Earth is added, don't
	// include points behind Earth when choosing raycasted intersectioning
	// points to highlight

	import { onMount } from 'svelte';
	import { load_tles, propagate_tles_to_now } from './load_tles';
	import type { PositionAndVelocity, SatRec } from 'satellite.js';
	import { T, useThrelte, type CurrentWritable } from '@threlte/core';
	import {
		BufferGeometry,
		Vector3,
		ShaderMaterial,
		AdditiveBlending,
		InstancedBufferAttribute,
		BufferAttribute,
		WebGLRenderer,
		Camera
	} from 'three';
	import vertex_shader from './satellite.vert?raw';
	import fragment_shader from './satellite.frag?raw';

	import { interactivity } from '@threlte/extras';
	import type { _ } from '$env/static/private';

	const SATELLITE_BASE_SIZE = 5;
	const SATELLITE_HIGHLIGHTED_SIZE = 20;
	const RAYCASTER_PADDING = 400;

	const { raycaster } = interactivity();
	raycaster.params.Points.threshold = RAYCASTER_PADDING;

	const { invalidate } = useThrelte();

	let tles: Map<string, SatRec> | null = $state(null);

	const shader_material = new ShaderMaterial({
		vertexShader: vertex_shader,
		fragmentShader: fragment_shader,
		transparent: true,
		depthWrite: false,
		blending: AdditiveBlending
	});

	let satellite_positions: Vector3[] | null = null;
	let satellites_geometry: BufferGeometry | null = $state(null);

	let point_sizes: Float32Array | null = null;

	onMount(async () => {
		tles = await load_tles();

		point_sizes = new Float32Array(tles.size).fill(SATELLITE_BASE_SIZE);

		propagate_to_now(tles);
	});

	function propagate_to_now(tles: Map<string, SatRec>) {
		let positions_and_velocities: Map<string, PositionAndVelocity> = propagate_tles_to_now(tles);

		satellite_positions = [
			...positions_and_velocities.values().map((value) => {
				return new Vector3(value.position.x, value.position.y, value.position.z);
			})
		];

		satellites_geometry = new BufferGeometry().setFromPoints(satellite_positions);
		satellites_geometry.setAttribute('size', new BufferAttribute(point_sizes!, 1));
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
		const intersections = e.intersections;

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
			const pointIndex = inter.index;

			// Get world position of this point
			const pos = satellite_positions![pointIndex];

			const dist = screenSpaceDistance(renderer, camera, pos, mouse);

			if (dist < minDist) {
				minDist = dist;
				closest = inter;
			}
		}

		if (closest) {
			highlight_point(closest.index);
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
		geometry={satellites_geometry}
		material={shader_material}
		onpointerenter={handle_pointer_enter_satellite}
		onpointerleave={handle_pointer_leave_satellite}
	/>
{/if}

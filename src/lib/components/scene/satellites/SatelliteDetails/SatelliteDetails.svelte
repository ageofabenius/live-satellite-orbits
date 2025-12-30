<script lang="ts">
	import { onMount } from 'svelte';
	import { T, useTask, useThrelte } from '@threlte/core';
	import { ShaderMaterial, AdditiveBlending } from 'three';
	import vertex_shader from '../satellite.vert?raw';
	import fragment_shader from '../satellite.frag?raw';

	import { HTML } from '@threlte/extras';

	import { Line2 } from 'three/addons/lines/Line2.js';
	import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
	import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
	import { extend } from '@threlte/core';
	extend({
		Line2,
		LineGeometry,
		LineMaterial
	});

	import * as SceneColors from '../../../../../../config/colors.config';
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
		tick_rate_seconds,
		show_tooltip = true
	}: {
		tle: [string, SatRec, OrbitalRegime];
		simulated_time: Date;
		tick_rate_seconds: number;
		show_tooltip?: boolean;
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
		BASE_TRANSPARENCY,
		// svelte-ignore state_referenced_locally
		show_tooltip
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

{#if ctx.tooltip}
	<HTML
		position={[ctx.tooltip.position.x, ctx.tooltip.position.y, ctx.tooltip.position.z]}
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
					{ctx.tooltip.name}
				</span>

				<div
					class="text-xs {SceneColors.TOOLTIP_REGULAR_TEXT} grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5"
				>
					<span class="col-span-2">{OrbitalRegime[ctx.tooltip.orbital_regime]}</span>

					<span class={SceneColors.TOOLTIP_MUTED_TEXT}>period</span>
					<span class="text-right"> {ctx.tooltip.period}</span>

					<span class={SceneColors.TOOLTIP_MUTED_TEXT}>semi-major axis</span>
					<span class="text-right">{ctx.tooltip.semi_major_axis}</span>

					<span class={SceneColors.TOOLTIP_MUTED_TEXT}>eccentricity</span>
					<span class="text-right"> {ctx.tooltip.eccentricity}</span>

					<span class={SceneColors.TOOLTIP_MUTED_TEXT}>inclination</span>
					<span class="text-right"> {ctx.tooltip.inclination_deg}</span>
				</div>
			</div>
		</div>
	</HTML>
{/if}

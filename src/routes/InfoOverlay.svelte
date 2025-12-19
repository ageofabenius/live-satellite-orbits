<script lang="ts">
	type InfoSection = 'about' | 'data' | 'methodology' | null;
	let open_section: InfoSection = null;

	function toggle(section: InfoSection) {
		open_section = open_section === section ? null : section;
	}

	function close() {
		open_section = null;
	}
</script>

<!-- Identity + buttons -->
<div class="absolute top-2 left-2 menu-panel">
	<div class="flex items-center gap-2">
		<!-- Title -->
		<div class="text-sm font-semibold tracking-wide">Live Satellite Orbits</div>

		<!-- Info buttons -->
		<button
			class="info-btn"
			data-selected={open_section === 'about'}
			on:click={() => toggle('about')}
		>
			About
		</button>

		<button
			class="info-btn"
			data-selected={open_section === 'data'}
			on:click={() => toggle('data')}
		>
			Data
		</button>

		<button
			class="info-btn"
			data-selected={open_section === 'methodology'}
			on:click={() => toggle('methodology')}
		>
			Methodology
		</button>
	</div>

	<!-- Anchored info panel -->
	{#if open_section}
		<!-- absolute top-full mt-3 left-1/2 -translate-x-1/2 -->
		<div
			class="
                absolute top-full mt-3 left-0
                w-104 max-h-[60vh]
                info-panel
            "
		>
			<!-- Header -->
			<div class="flex justify-between items-center mb-2">
				<h2 class="text-sm font-semibold capitalize">
					{open_section}
				</h2>
				<button class="text-xs info-btn" on:click={close}>x</button>
			</div>

			<!-- Content -->
			<div class="text-xs leading-relaxed overflow-y-auto space-y-2">
				{#if open_section === 'about'}
					<p>
						This visualization shows satellites orbiting around Earth, <span class="font-semibold"
							>live and to-scale</span
						>, based on real, publicly-available orbital data.
					</p>
					<p>
						It is intended to make the structure and motion of Earth orbit easier to understand
						through direct visual exploration.
					</p>
				{:else if open_section === 'data'}
					<p>
						Satellite positions are derived from publicly available Two-Line Element (TLE) sets.
					</p>
					<p>
						TLEs describe an orbit at a specific point in time and are widely used for orbit
						prediction and analysis.
					</p>
				{:else if open_section === 'methodology'}
					<p>Orbits are propagated forward in time using standard SGP4 orbital models.</p>
					<p>
						Positions are computed in an Earth-centered inertial reference frame and rendered in
						real time.
					</p>
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- Quiet disclaimer -->
<div
	class="
			absolute bottom-4 left-1/2 -translate-x-1/2
			text-[10px] text-cyan-200/50
		"
>
	For visualization and educational use only
</div>

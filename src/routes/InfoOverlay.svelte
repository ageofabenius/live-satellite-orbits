<script lang="ts">
	import WhatIsThis from '$lib/content/what-is-this.md';
	import About from '$lib/content/about.md';
	import Data from '$lib/content/data.md';
	import Methodology from '$lib/content/methodology.md';

	type InfoSection = 'About' | 'Data' | 'Methodology' | 'What is this?' | null;
	let open_section: InfoSection = null;

	function toggle(section: InfoSection) {
		open_section = open_section === section ? null : section;
	}

	function close() {
		open_section = null;
	}
</script>

<!-- Identity + buttons -->
<div class="absolute top-0 left-0 p-2">
	<div class="menu-panel">
		<div class="flex flex-wrap items-center gap-2">
			<!-- Title -->
			<h1 class="text-sm font-semibold tracking-wide">Live Satellite Orbits</h1>

			<!-- Info buttons -->

			<button
				class="info-btn"
				data-selected={open_section === 'What is this?'}
				on:click={() => toggle('What is this?')}
			>
				What is this?
			</button>

			<button
				class="info-btn"
				data-selected={open_section === 'Data'}
				on:click={() => toggle('Data')}
			>
				Data
			</button>

			<button
				class="info-btn"
				data-selected={open_section === 'Methodology'}
				on:click={() => toggle('Methodology')}
			>
				Methodology
			</button>

			<button
				class="info-btn"
				data-selected={open_section === 'About'}
				on:click={() => toggle('About')}
			>
				About
			</button>
		</div>

		<!-- Anchored info panel -->
		{#if open_section}
			<!-- absolute top-full mt-3 left-1/2 -translate-x-1/2 -->
			<div
				class="
                absolute top-full mt-2 left-0
                w-104 max-w-full max-h-[60vh]
                info-panel
				overflow-y-auto
				flex flex-col
            "
			>
				<!-- Content -->
				<div class="info-content overflow-y-auto">
					{#if open_section === 'About'}
						<About />
					{:else if open_section === 'Data'}
						<Data />
					{:else if open_section === 'Methodology'}
						<Methodology />
					{:else if open_section === 'What is this?'}
						<WhatIsThis />
					{/if}
				</div>
			</div>
		{/if}
	</div>
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

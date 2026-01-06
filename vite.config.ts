import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

const build_time = new Date().toISOString();

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		fs: {
			allow: [
				path.resolve(process.cwd(), 'test/test_data'),
				path.resolve(process.cwd(), 'static/textures'),
				path.resolve(process.cwd(), 'config')
			]
		},
		allowedHosts: [
			"devserver-main--live-satellite-orbits.netlify.app"
		]
	},
	define: {
		__BUILD_TIME__: JSON.stringify(build_time)
	}
});

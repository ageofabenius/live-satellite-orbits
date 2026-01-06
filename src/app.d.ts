// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
	const __BUILD_TIME__: string;

	module '*.md' {
		import type { ComponentType } from 'svelte';

		const component: ComponentType;
		export default component;

	}
}

export { };

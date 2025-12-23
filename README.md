# Live Satellite Orbits

This is the repository for
[livesatelliteorbits.com](https://livesatelliteorbits.com), an interactive 3D
visualization of real-time satellite orbits around the Earth.

# Features
- **Interactive 3D Scene**: Mobile-friendly rotate and zoom around the Earth
- **Real-time Satellite locations**: All ~14,000 publicly-available satellites from Celestrak's "active" catalogue
- **Satellite Orbit Visualization**: Hover over or select satellites to render their full orbit
- **Cached TLEs**: TLEs cached in our backend and in-browser for fast loading with 1-hour time-to-live

# Stack

- **Frontend**: [Svelte 5](https://svelte.dev) and [SvelteKit](https://kit.svelte.dev)
- **3D Graphics**: [Three.js](https://threejs.org)
- **Styling**: [Tailwind CSS](https://tailwindcss.com)
- **Orbital Mechanics**: [satellite.js](https://github.com/shashwatak/satellite-js) for TLE propagation
- **Hosting**: [Netlify](https://netlify.com)
- **TLE Caching**: [Netlify
  Functions](https://docs.netlify.com/functions/overview/) and [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)

# Getting Started

```bash
# Install Netlify CLI
pnpm install netlify-cli

# Install dependencies
pnpm install

# Run full environment
# (including Netlify serverless functions and Blob storage)
netlify dev
```

```bash
# In a separate terminal
# Invoke Netlify function to create a mirror of the TLEs from Celestrak
netlify functions:invoke --port 8888 mirror_celestrak_tles
```

# How It Works

## Orbital Propagation

The application uses **Two-Line Element (TLE)** data to calculate satellite positions. TLEs are fetched from [CelesTrak](https://celestrak.org) and processed using the `satellite.js` library, which implements the SGP4/SDP4 propagation model.

### TLE Caching

1. **Browser localStorage**: TLEs are cached in `localStorage` with an expiration of 1-hour.
2. **Netlify Mirror**: A Netlify Function runs hourly, fetching TLEs from Celestrak and caching them in a Netlify Blob.

The browser never fetches directly from Celestrak so as to not trigger API rate limits.

### Simulation Tick Rate

The simulation runs at a default tick rate of 5 seconds.  Testing on an Intel® Core™ i5-1334U shows an average computation time of ~30ms to propagate all satellites, this is fast enough to allow for a relatively low tick rate but still slow enough to prevent propagation in every frame.

In between ticks, satellite positions are linearly interpolated to provide smooth motion.

# TO-DO:

- Time controls (set time, rewind, fast-forward)
- Satellite filters
- Satellite catalog with deeper info
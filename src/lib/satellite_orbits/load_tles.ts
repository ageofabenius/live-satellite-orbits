import { twoline2satrec, type SatRec } from 'satellite.js';
import { orbital_regime, type OrbitalRegime } from './orbital_regime';

async function fetch_tles_from_celestrak_netlify_mirror(): Promise<string> {
    console.log("Fetching TLEs from Netlify mirror of Celestrak...")
    console.time("Fetched TLEs from Netlify mirror of Celestrak...")
    let res = await fetch("/.netlify/functions/fetch_mirrored_tles")
    const str = await res.text()

    console.timeEnd("Fetched TLEs from Celestrak...")

    return str
}

// TLEs are cached using browser localStorage, this proved significantly faster
// to load compared to response caching with either compressed or uncompressed
// data
const LOCAL_STORAGE_KEY = "tles"
const LOCAL_STORAGE_AGE_KEY = "tles_cached_at"
const MAXIMUM_ALLOWABLE_CACHE_AGE_MS = 1 * 3600 * 1000

function cache_tles(tles: string) {
    localStorage.setItem(LOCAL_STORAGE_KEY, tles)
    localStorage.setItem(LOCAL_STORAGE_AGE_KEY, new Date().toISOString())
}

function expunge_cached_tles() {
    localStorage.removeItem(LOCAL_STORAGE_KEY)
    localStorage.removeItem(LOCAL_STORAGE_AGE_KEY)
}

function load_tles_from_cache(): [string, SatRec, OrbitalRegime][] | null {
    const cached_time_string = localStorage.getItem(LOCAL_STORAGE_AGE_KEY)
    if (!cached_time_string) {
        return null
    }
    const cached_time = new Date(cached_time_string)
    const now = new Date()
    const cache_age_ms = now.getTime() - cached_time.getTime()
    if (cache_age_ms > MAXIMUM_ALLOWABLE_CACHE_AGE_MS) {
        expunge_cached_tles()
        return null
    }

    let tles_str = localStorage.getItem(LOCAL_STORAGE_KEY)

    if (tles_str === null) {
        expunge_cached_tles()
        return null
    }

    try {
        let tles = initialize_tles(tles_str)
        return tles
    } catch (error) {
        console.error("Error initializing TLEs from cache", error)
        expunge_cached_tles()
        return null
    }
}


function initialize_tles(tles_str: string): [string, SatRec, OrbitalRegime][] {
    console.time("Initialized TLEs")
    const lines = tles_str
        // Trim any trailing newlines
        .trim()
        // Split on newlines
        .split("\n");

    let tles: [string, SatRec, OrbitalRegime][] = []
    for (let i = 0; i < lines!.length; i += 3) {
        const line_0 = lines![i]
        const line_1 = lines![i + 1]
        const line_2 = lines![i + 2]

        const satrec = twoline2satrec(line_1, line_2);

        const orbit = orbital_regime(satrec)

        tles.push([line_0, satrec, orbit])
    }
    console.timeEnd("Initialized TLEs")

    return tles
}

export async function load_tles(): Promise<[string, SatRec, OrbitalRegime][]> {
    console.time("Loaded TLEs")

    // First, try loading from localStorage cache
    console.time("Loaded cached TLEs from localStorage")
    const cached_tles = load_tles_from_cache()
    if (cached_tles) {
        console.timeEnd("Loaded cached TLEs from localStorage")
        return cached_tles
    }

    console.time("Fetched TLEs from Celestrak mirror")
    let tles_str = await fetch_tles_from_celestrak_netlify_mirror()
    console.timeEnd("Fetched TLEs from Celestrak mirror")
    console.log(`Fetched TLEs from Celestrak Mirror: ${tles_str.length} Bytes`)

    let tles;
    try {
        console.time("Initialized TLEs")
        tles = initialize_tles(tles_str)
        console.timeEnd("Initialized TLEs")

    } catch (error) {
        console.error("Error initializing TLEs from Celestrak mirror", error)
        return []
    }

    console.time(`Caching TLEs for ${MAXIMUM_ALLOWABLE_CACHE_AGE_MS / 1000} seconds`)
    cache_tles(tles_str)
    console.timeEnd(`Caching TLEs for ${MAXIMUM_ALLOWABLE_CACHE_AGE_MS / 1000} seconds`)

    console.timeEnd("Loaded TLEs")
    console.log(`Ingested ${tles.length} satellite TLEs`)

    return tles
}

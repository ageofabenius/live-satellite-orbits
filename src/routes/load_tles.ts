import { propagate, twoline2satrec, type EciVec3, type Kilometer, type KilometerPerSecond, type PositionAndVelocity, type SatRec } from 'satellite.js';
import { Vector3 } from 'three';

export const SIDEREAL_DAY_SECONDS = 86164.0905
export const EARTH_MU = 398600.4418; // km^3 / s^2
export const EARTH_RADIUS_KM = 6378.137;


async function fetch_tles_from_celestrak_netlify_mirror(): Promise<string> {
    console.log("Fetching TLEs from Netlify mirror of Celestrak...")
    console.time("Fetched TLEs from Netlify mirror of Celestrak...")
    let res = await fetch("/.netlify/functions/fetch_mirrored_tles")
    const str = await res.text()

    console.timeEnd("Fetched TLEs from Celestrak...")

    return str
}

const LOCAL_STORAGE_KEY = "tles"
const LOCAL_STORAGE_AGE_KEY = "tles_cached_at"
const MAXIMUM_ALLOWABLE_CACHE_AGE_MS = 6 * 3600 * 1000

function cache_tles(tles: string) {
    localStorage.setItem(LOCAL_STORAGE_KEY, tles)
    localStorage.setItem(LOCAL_STORAGE_AGE_KEY, new Date().toISOString())
}

function load_tles_from_cache(): string | null {
    const cached_time_string = localStorage.getItem(LOCAL_STORAGE_AGE_KEY)
    if (!cached_time_string) {
        return null
    }
    const cached_time = new Date(cached_time_string)
    const now = new Date()
    const cache_age_ms = now.getTime() - cached_time.getTime()
    if (cache_age_ms > MAXIMUM_ALLOWABLE_CACHE_AGE_MS) {
        // Expunge cache
        localStorage.removeItem(LOCAL_STORAGE_KEY)
        localStorage.removeItem(LOCAL_STORAGE_AGE_KEY)

        return null
    }

    return localStorage.getItem(LOCAL_STORAGE_KEY)
}

async function fetch_tles(): Promise<string> {
    // First, try loading from localStorage cache
    console.time("Loaded cached TLEs from localStorage")
    const cached_tles = load_tles_from_cache()
    if (cached_tles) {
        console.timeEnd("Loaded cached TLEs from localStorage")
        return cached_tles
    }

    console.time("Fetched TLEs from Celestrak mirror")
    const celestrak_tles = await fetch_tles_from_celestrak_netlify_mirror()
    console.timeEnd("Fetched TLEs from Celestrak mirror")

    console.time(`Caching TLEs for ${MAXIMUM_ALLOWABLE_CACHE_AGE_MS / 1000} seconds`)
    cache_tles(celestrak_tles)
    console.timeEnd(`Caching TLEs for ${MAXIMUM_ALLOWABLE_CACHE_AGE_MS / 1000} seconds`)

    return celestrak_tles
}


export async function load_tles(): Promise<[string, SatRec, OrbitalRegime][]> {
    console.time("Loaded TLEs")

    let tles_str = await fetch_tles()

    console.time("Parsed TLEs")
    const lines = tles_str
        // Trim any trailing newlines
        .trim()
        // Split on newlines
        .split("\n"); console.timeEnd("Parsed TLEs")

    console.time("Initialized TLEs")
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
    console.timeEnd("Loaded TLEs")
    console.log(`Ingested ${tles.length} satellite TLEs`)

    return tles
}

export enum OrbitalRegime {
    LEO, // Low Earth Orbit
    MEO, // Medium Earth Orbit
    GEO, // Geostationary Earth Orbit
    Other, // Other
}


export function orbital_regime(satrec: SatRec): OrbitalRegime {
    const mean_motion_rad_per_sec = satrec.no / 60
    const mean_motion_rev_per_day = (satrec.no * 1440) / (2 * Math.PI)
    const inclination_deg = satrec.inclo * 180 / Math.PI;
    const eccentricity = satrec.ecco

    const semi_major_axis = Math.cbrt(EARTH_MU / (mean_motion_rad_per_sec * mean_motion_rad_per_sec))

    const period = 86400 / mean_motion_rev_per_day

    if (semi_major_axis - EARTH_RADIUS_KM <= 2_000) {
        return OrbitalRegime.LEO
    } else if (semi_major_axis - EARTH_RADIUS_KM <= 34_000) {
        return OrbitalRegime.MEO
    } else if (
        // Period is within 5-minute buffer of 24 hours
        Math.abs(period - 86400) <= 300
        // Is equitorial
        && Math.abs(inclination_deg) < 0.5
        // Is circular
        && eccentricity <= 0.001
    ) {
        return OrbitalRegime.GEO
    }

    return OrbitalRegime.Other
}

export function propagate_tles_to_target_time(tles: [string, SatRec, OrbitalRegime][], target_time: Date): [string, PositionAndVelocity | null][] {
    console.log('Propagating TLEs...')
    console.time("Propagated TLEs")

    let target_time_cloned = new Date(target_time.getTime())

    let positions_and_velocities: [string, PositionAndVelocity | null][] = []
    // let n = 0
    let successful_propagations = []
    let failed_propagations = []
    for (const [name, satrec] of tles) {
        // if (n % 100 == 0) {
        //     console.log(`Propagating ${n}th TLE`)
        // }
        const position_and_velocity: PositionAndVelocity = propagate(satrec, target_time_cloned)!
        if (!position_and_velocity) {
            // console.warn("Unable to propagate satellite", name)
            failed_propagations.push(name)
            positions_and_velocities.push([name, null])
        } else {
            positions_and_velocities.push([name, position_and_velocity])
            successful_propagations.push(name)
        }

        // n += 1
    }

    if (failed_propagations.length > 0) {
        console.warn(`Failed to propagate ${failed_propagations.length}/${successful_propagations.length} satellites`)
    }

    console.timeEnd("Propagated TLEs")

    return positions_and_velocities
}

export function eci_to_three(eci: EciVec3<Kilometer> | EciVec3<KilometerPerSecond>): Vector3 {
    return new Vector3(eci.x, eci.z, -eci.y)
}

const STEPS_PER_ORBIT = 512
export function propagate_one_orbit(satrec: SatRec, current_simulated_time: Date): Vector3[] | null {
    // console.time("Propagated one orbital period")
    // console.log("propagate_one_orbit", satrec.satnum)

    const mean_motion_rev_per_day = (satrec.no * 1440) / (2 * Math.PI)
    const period_ms = (86400 / mean_motion_rev_per_day) * 1000

    // Center propagation on the current time so that the two ends which don't
    // line up perfectly are on the other side of the globe from the satellite
    // point itself
    const start_time = new Date(current_simulated_time.getTime() - period_ms / 2)
    const end_time = new Date(current_simulated_time.getTime() + period_ms / 2)
    const step_size_ms = ((end_time.getTime() - start_time.getTime()) / STEPS_PER_ORBIT)

    // console.log("period_seconds", period_seconds,
    //     "start_time", start_time.toISOString(),
    //     "end_time", end_time.toISOString(),
    //     "step_size_ms", step_size_ms,)

    let positions: Vector3[] = []
    for (let i = start_time.getTime(); i <= end_time.getTime(); i += step_size_ms) {
        const t = new Date(i)
        const position_and_velocity: PositionAndVelocity | null = propagate(satrec, t)
        if (!position_and_velocity) { return null }

        const position = eci_to_three(position_and_velocity.position)
        positions.push(position)
    }

    // console.timeEnd("Propagated one orbital period")

    return positions
}
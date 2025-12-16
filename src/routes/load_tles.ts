import { propagate, twoline2satrec, type EciVec3, type Kilometer, type KilometerPerSecond, type PositionAndVelocity, type SatRec } from 'satellite.js';
import { Vector3 } from 'three';

const CELESTRAK_ACTIVE_TLES_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"

const DEV_LIMIT = 10000000
const DEV = true


const SIDEREAL_DAY_SECONDS = 86164.0905
const EARTH_MU = 398600.4418; // km^3 / s^2
const EARTH_RADIUS_KM = 6378.137;


async function load_test_tles(): Promise<String> {
    const text = await import('../../test/test_data/active.txt?raw').then(m => m.default);
    return text;
}

// TO-DO: Add browser local storage caching of active.txt from Celestrak

async function fetch_tles(): Promise<string> {
    console.log("Fetching TLEs from Celestrak...")
    console.time("Fetched TLEs")
    const res = await fetch(CELESTRAK_ACTIVE_TLES_URL)
    const str = (await res.text())

    console.timeEnd("Fetched TLEs")

    return str
}

export async function load_tles(): Promise<[string, SatRec, OrbitalRegime][]> {
    console.time("Loaded TLEs")

    console.time("Fetched TLEs")
    let tles_str;
    if (DEV) {
        tles_str = (await load_test_tles())
    } else {
        tles_str = (await fetch_tles())
    }
    console.timeEnd("Fetched TLEs")

    console.time("Parsed TLEs")
    const lines = tles_str
        // Trim any trailing newlines
        .trim()
        // Split on newlines
        .split("\n"); console.timeEnd("Parsed TLEs")

    console.time("Initialized TLEs")
    let tles: [string, SatRec, OrbitalRegime][] = []
    for (let i = 0; i < Math.min(lines!.length, DEV_LIMIT); i += 3) {
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


function orbital_regime(satrec: SatRec): OrbitalRegime {
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
import { propagate, twoline2satrec, type EciVec3, type Kilometer, type KilometerPerSecond, type PositionAndVelocity, type SatRec } from 'satellite.js';
import { Vector3 } from 'three';

const CELESTRAK_ACTIVE_TLES_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"

const DEV_LIMIT = 10000000
const DEV = true


async function load_test_tles(): Promise<String> {
    const text = await import('../../test/test_data/active.txt?raw').then(m => m.default);
    return text;
}

async function fetch_tles(): Promise<string> {
    console.log("Fetching TLEs from Celestrak...")
    console.time("Fetched TLEs")
    const res = await fetch(CELESTRAK_ACTIVE_TLES_URL)
    const str = (await res.text())

    console.timeEnd("Fetched TLEs")

    return str
}

export async function load_tles(): Promise<Map<string, SatRec>> {
    console.time("Loaded TLEs")

    let tles_str;
    if (DEV) {
        tles_str = (await load_test_tles())
    } else {
        tles_str = (await fetch_tles())
    }

    const lines = tles_str
        // Trim any trailing newlines
        .trim()
        // Split on newlines
        .split("\n");

    console.time("Initialized TLEs")
    let tles: Map<string, SatRec> = new Map()
    for (let i = 0; i < Math.min(lines!.length, DEV_LIMIT); i += 3) {
        const line_0 = lines![i]
        const line_1 = lines![i + 1]
        const line_2 = lines![i + 2]

        const satrec = twoline2satrec(line_1, line_2);

        tles.set(line_0, satrec)
    }
    console.timeEnd("Initialized TLEs")
    console.timeEnd("Loaded TLEs")
    console.log(`Ingested ${tles.size} satellite TLEs`)

    return tles
}

export function propagate_tles_to_now(tles: Map<string, SatRec>): Map<string, PositionAndVelocity> {
    console.time("Propagated TLEs")
    const now = new Date()

    let positions_and_velocities = new Map()
    for (const [name, satrec] of tles) {
        const position_and_velocity: PositionAndVelocity = propagate(satrec, now)!
        if (!position_and_velocity) {
            console.warn("Unable to propagate satellite", name, position_and_velocity)
        } else {
            positions_and_velocities.set(name, position_and_velocity)
        }
    }

    console.timeEnd("Propagated TLEs")

    return positions_and_velocities
}

export function eci_to_three(eci: EciVec3<Kilometer> | EciVec3<KilometerPerSecond>): Vector3 {
    return new Vector3(eci.x, eci.z, -eci.y)
}

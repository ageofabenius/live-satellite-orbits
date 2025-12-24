import { propagate, type PositionAndVelocity, type SatRec } from 'satellite.js';
import { Vector3 } from 'three';
import { type OrbitalRegime } from './orbital_regime';
import { eci_to_three } from './coordinate_transforms';

export function propagate_tles_to_target_time(tles: [string, SatRec, OrbitalRegime][], target_time: Date): [string, PositionAndVelocity | null][] {
    console.log(`Propagating TLEs to ${target_time.toISOString()}`)
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
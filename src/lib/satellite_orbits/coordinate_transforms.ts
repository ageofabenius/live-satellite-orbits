import { type EciVec3, type Kilometer, type KilometerPerSecond, } from 'satellite.js';
import { Vector3 } from 'three';

/** Convert Earth-Centered-Inertial coordinates to Three scene world coordinates.*/
export function eci_to_three(eci: EciVec3<Kilometer> | EciVec3<KilometerPerSecond>): Vector3 {
    return new Vector3(eci.x, eci.z, -eci.y)
}
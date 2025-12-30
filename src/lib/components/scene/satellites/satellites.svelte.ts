import { BufferGeometry, Vector3, type BufferAttribute } from "three";

export class SatellitesComp {
    /**
     * Contains all data and logic related to computing satellites' positions
     * and updating them imperatively.
     */

    satellites_geometry: BufferGeometry = $state(new BufferGeometry());
    satellites_position_attribute: BufferAttribute | null = null;

    point_sizes: Float32Array | null = null;

    colors: Float32Array | null = null;

    transparencies: Float32Array | null = null;
    satellites_transparency_attribute: BufferAttribute | null = null;


    start_satellite_positions: [string, Vector3][] = [];
    target_satellite_positions: [string, Vector3][] = [];
    interpolated_elapsed_seconds = 0;
}


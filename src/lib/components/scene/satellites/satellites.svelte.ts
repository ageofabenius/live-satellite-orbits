import { eci_to_three } from "$lib/satellite_orbits/coordinate_transforms";
import { load_tles } from "$lib/satellite_orbits/load_tles";
import { EARTH_MU, type OrbitalRegime } from "$lib/satellite_orbits/orbital_regime";
import { propagate_tles_to_target_time } from "$lib/satellite_orbits/propagate_tles";
import { format_duration } from "$lib/time";
import type { PositionAndVelocity, SatRec } from "satellite.js";
import { BufferAttribute, BufferGeometry, Vector3 } from "three";

export class SatellitesComp {
    /**
     * Contains all data and logic related to computing satellites' positions
     * and updating them imperatively.
     */

    simulated_time: Date
    tick_rate_seconds: number
    loading_started: (name: string) => void
    loading_complete: (name: string) => void
    loading_message: (name: string) => void

    SATELLITE_BASE_SIZE: number
    SATELLITE_HIGHLIGHTED_SIZE: number
    RAYCASTER_PADDING: number
    BASE_TRANSPARENCY: number
    SATELLITE_POINTS_COLOR: [number, number, number]

    tles: [string, SatRec, OrbitalRegime][] = [];

    satellites_geometry: BufferGeometry = $state(new BufferGeometry());
    satellites_position_attribute: BufferAttribute | null = null;

    point_sizes: Float32Array | null = null;

    colors: Float32Array | null = null;

    transparencies: Float32Array | null = null;
    satellites_transparency_attribute: BufferAttribute | null = null;

    start_satellite_positions: [string, Vector3][] = [];
    target_satellite_positions: [string, Vector3][] = [];
    interpolated_elapsed_seconds = 0;

    constructor(
        initial_simulated_time: Date,
        initial_tick_rate_seconds: number,
        loading_started: (name: string) => void,
        loading_complete: (name: string) => void,
        loading_message: (name: string) => void,
        SATELLITE_BASE_SIZE: number,
        SATELLITE_HIGHLIGHTED_SIZE: number,
        RAYCASTER_PADDING: number,
        BASE_TRANSPARENCY: number,
        SATELLITE_POINTS_COLOR: [number, number, number]
    ) {

        this.simulated_time = initial_simulated_time
        this.tick_rate_seconds = initial_tick_rate_seconds
        this.loading_started = loading_started
        this.loading_complete = loading_complete
        this.loading_message = loading_message

        this.SATELLITE_BASE_SIZE = SATELLITE_BASE_SIZE
        this.SATELLITE_HIGHLIGHTED_SIZE = SATELLITE_HIGHLIGHTED_SIZE
        this.RAYCASTER_PADDING = RAYCASTER_PADDING
        this.BASE_TRANSPARENCY = BASE_TRANSPARENCY
        this.SATELLITE_POINTS_COLOR = SATELLITE_POINTS_COLOR
    }

    set_tick_rate(tick_rate_seconds: number) {
        console.log(`Setting tick rate to ${tick_rate_seconds}`);
        this.tick_rate_seconds = tick_rate_seconds
    }

    tick(simulated_time: Date) {
        console.log(`Ticking to ${simulated_time.toISOString()}`);
        this.simulated_time = simulated_time

        if (this.tles.length == 0) {
            // Don't start propagating before TLEs are loaded
            return;
        }
        this.propagate_target_positions(simulated_time);
    }

    async on_mount() {
        // Load TLEs
        this.loading_message('loading satellite state vectors');
        this.tles = await load_tles();

        this.loading_message('initializing satellite geometry');
        // Initialize size array and set base point sizes
        this.point_sizes = new Float32Array(this.tles.length).fill(this.SATELLITE_BASE_SIZE);
        this.satellites_geometry.setAttribute('size', new BufferAttribute(this.point_sizes, 1));

        // Initialize color array and set point this.colors
        this.colors = new Float32Array(this.tles.length * 3).fill(1);
        const satellite_color = this.SATELLITE_POINTS_COLOR;
        this.tles.forEach(([_name, _satrec, _orbital_regime], i) => {
            this.colors![i * 3] = satellite_color[0];
            this.colors![i * 3 + 1] = satellite_color[1];
            this.colors![i * 3 + 2] = satellite_color[2];
        });
        this.satellites_geometry.setAttribute('color', new BufferAttribute(this.colors, 3));

        this.transparencies = new Float32Array(this.tles.length).fill(1);
        this.satellites_transparency_attribute = this.satellites_geometry.getAttribute(
            'transparency'
        ) as BufferAttribute;
        this.satellites_geometry.setAttribute(
            'transparency',
            new BufferAttribute(this.transparencies, this.BASE_TRANSPARENCY)
        );

        // Initialize position array and set initial point positions
        this.satellites_geometry.setAttribute(
            'position',
            new BufferAttribute(new Float32Array(this.tles.length * 3), 3)
        );

        this.satellites_position_attribute = this.satellites_geometry.getAttribute(
            'position'
        ) as BufferAttribute;

        this.loading_message('propagating satellite orbits to current time');
        this.start_satellite_positions = propagate_to_time(this.tles, this.simulated_time);
        this.target_satellite_positions = this.start_satellite_positions;

        for (let i = 0; i < this.start_satellite_positions.length; i++) {
            // Set start positions
            const [name, position] = this.start_satellite_positions[i];
            this.satellites_position_attribute.setXYZ(i, position.x, position.y, position.z);
        }

        this.loading_complete('Satellites');
    }

    propagate_target_positions(
        target_time: Date
    ) {
        // Set start positions to previous target positions
        this.start_satellite_positions = this.target_satellite_positions;
        this.target_satellite_positions = propagate_to_time(this.tles, target_time);
        // Reset interpolated seconds
        this.interpolated_elapsed_seconds = 0;
    }

    interpolate_positions(delta_seconds: number) {
        if (!this.satellites_position_attribute) {
            return;
        }
        if (this.interpolated_elapsed_seconds >= this.tick_rate_seconds) {
            return;
        }

        this.interpolated_elapsed_seconds += delta_seconds;
        // Bound to tick rate
        const t = Math.min(this.interpolated_elapsed_seconds / this.tick_rate_seconds, 1);
        for (let i = 0; i < this.start_satellite_positions.length; i++) {
            const start = this.start_satellite_positions[i][1];
            const target = this.target_satellite_positions[i][1];

            const x = start.x + (target.x - start.x) * t;
            const y = start.y + (target.y - start.y) * t;
            const z = start.z + (target.z - start.z) * t;

            this.satellites_position_attribute.setXYZ(i, x, y, z);
        }
        this.satellites_position_attribute.needsUpdate = true;
        this.satellites_geometry.computeBoundingSphere();
        this.satellites_geometry.computeBoundingBox();
    }
}


function propagate_to_time(
    tles: [string, SatRec, OrbitalRegime][],
    target_time: Date
): [string, Vector3][] {
    let positions_and_velocities: [string, PositionAndVelocity | null][] =
        propagate_tles_to_target_time(tles, target_time);

    return positions_and_velocities.map(([name, pos_and_vel]) => {
        const position = pos_and_vel ? eci_to_three(pos_and_vel.position) : new Vector3(0, 0, 0);
        return [name, position];
    });
}


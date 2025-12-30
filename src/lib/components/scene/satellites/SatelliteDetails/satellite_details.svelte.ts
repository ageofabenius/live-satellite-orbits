import { eci_to_three } from "$lib/satellite_orbits/coordinate_transforms";
import { EARTH_MU, type OrbitalRegime } from "$lib/satellite_orbits/orbital_regime";
import { propagate_one_orbit, propagate_tles_to_target_time } from "$lib/satellite_orbits/propagate_tles";
import { format_duration } from "$lib/time";
import type { PositionAndVelocity, SatRec } from "satellite.js";
import { BufferAttribute, BufferGeometry, Vector3, WebGLRenderer } from "three";
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { extend } from '@threlte/core';
extend({
    Line2,
    LineGeometry,
    LineMaterial
});


export class SatellitesDetailsComp {
    simulated_time: Date
    tick_rate_seconds: number

    show_tooltip: boolean = false
    tooltip: SatelliteTooltip | null = $state(null);

    tle: [string, SatRec, OrbitalRegime]

    renderer: WebGLRenderer

    SATELLITE_HIGHLIGHTED_SIZE: number
    SATELLITE_POINTS_COLOR: [number, number, number]
    HIGHLIGHTED_TRANSPARENCY: number

    satellites_geometry: BufferGeometry = $state(new BufferGeometry());
    satellites_position_attribute: BufferAttribute | null = null;

    point_sizes: Float32Array | null = null;

    colors: Float32Array | null = null;

    transparencies: Float32Array | null = null;
    satellites_transparency_attribute: BufferAttribute | null = null;

    start_satellite_position: Vector3 = new Vector3()
    target_satellite_position: Vector3 = new Vector3()
    interpolated_elapsed_seconds = 0;


    orbit_line: Line2 | null = $state(null);
    orbit_line_material: LineMaterial | null = $state(null);

    constructor(
        tle: [string, SatRec, OrbitalRegime],
        renderer: WebGLRenderer,
        initial_simulated_time: Date,
        initial_tick_rate_seconds: number,
        SATELLITE_HIGHLIGHTED_SIZE: number,
        SATELLITE_POINTS_COLOR: [number, number, number],
        HIGHLIGHTED_TRANSPARENCY: number,
        show_tooltip: boolean
    ) {
        this.tle = tle

        this.renderer = renderer

        this.simulated_time = initial_simulated_time
        this.tick_rate_seconds = initial_tick_rate_seconds

        this.SATELLITE_HIGHLIGHTED_SIZE = SATELLITE_HIGHLIGHTED_SIZE
        this.SATELLITE_POINTS_COLOR = SATELLITE_POINTS_COLOR
        this.HIGHLIGHTED_TRANSPARENCY = HIGHLIGHTED_TRANSPARENCY

        this.show_tooltip = show_tooltip
    }

    set_tick_rate(tick_rate_seconds: number) {
        console.log(`Setting tick rate to ${tick_rate_seconds}`);
        this.tick_rate_seconds = tick_rate_seconds
    }

    set_tle(tle: [string, SatRec, OrbitalRegime]) {
        this.tle = tle
    }

    tick(simulated_time: Date) {
        console.log(`Ticking to ${simulated_time.toISOString()}`);
        this.simulated_time = simulated_time


        this.propagate_target_position(simulated_time);
    }

    async on_mount() {
        console.log("SatelliteDetails on_mount called");
        // Initialize size array and set base point sizes
        this.point_sizes = new Float32Array(1).fill(this.SATELLITE_HIGHLIGHTED_SIZE);
        this.satellites_geometry.setAttribute('size', new BufferAttribute(this.point_sizes, 1));

        // Initialize color array and set point this.colors
        this.colors = new Float32Array(1 * 3).fill(1);
        const satellite_color = this.SATELLITE_POINTS_COLOR;
        this.colors![0] = satellite_color[0];
        this.colors![1] = satellite_color[1];
        this.colors![2] = satellite_color[2];

        this.satellites_geometry.setAttribute('color', new BufferAttribute(this.colors, 3));

        this.transparencies = new Float32Array(1).fill(1);
        this.satellites_transparency_attribute = this.satellites_geometry.getAttribute(
            'transparency'
        ) as BufferAttribute;
        this.satellites_geometry.setAttribute(
            'transparency',
            new BufferAttribute(this.transparencies, this.HIGHLIGHTED_TRANSPARENCY)
        );

        // Initialize position array and set initial point positions
        this.satellites_geometry.setAttribute(
            'position',
            new BufferAttribute(new Float32Array(1 * 3), 3)
        );

        this.satellites_position_attribute = this.satellites_geometry.getAttribute(
            'position'
        ) as BufferAttribute;

        this.start_satellite_position = propagate_to_time(this.tle, this.simulated_time)[1];
        this.target_satellite_position = this.start_satellite_position;

        // Set start position
        this.satellites_position_attribute.setXYZ(0, this.start_satellite_position.x, this.start_satellite_position.y, this.start_satellite_position.z);

        this.show_orbit()

        if (this.show_tooltip) {
            this.tooltip = this.satellite_tooltip();
        }

        this.update_line_resolution();

        window.addEventListener('resize', this.update_line_resolution);
        return () => window.removeEventListener('resize', this.update_line_resolution);
    }

    propagate_target_position(
        target_time: Date
    ) {
        // Set start positions to previous target positions
        this.start_satellite_position = this.target_satellite_position;
        this.target_satellite_position = propagate_to_time(this.tle, target_time)[1];
        // Reset interpolated seconds
        this.interpolated_elapsed_seconds = 0;
    }

    interpolate_position(delta_seconds: number) {
        if (!this.satellites_position_attribute) {
            return;
        }
        if (this.interpolated_elapsed_seconds >= this.tick_rate_seconds) {
            return;
        }

        this.interpolated_elapsed_seconds += delta_seconds;
        // Bound to tick rate

        const t = Math.min(this.interpolated_elapsed_seconds / this.tick_rate_seconds, 1);
        const start = this.start_satellite_position;
        const target = this.target_satellite_position;

        const x = start.x + (target.x - start.x) * t;
        const y = start.y + (target.y - start.y) * t;
        const z = start.z + (target.z - start.z) * t;

        this.satellites_position_attribute.setXYZ(0, x, y, z);

        this.satellites_position_attribute.needsUpdate = true;
        this.satellites_geometry.computeBoundingSphere();
        this.satellites_geometry.computeBoundingBox();
    }

    update_line_resolution() {
        if (!this.orbit_line_material || !this.renderer) return;

        const canvas = this.renderer.domElement;

        this.orbit_line_material.resolution.set(canvas.clientWidth, canvas.clientHeight);
    }

    show_orbit() {
        const orbit_positions = propagate_one_orbit(this.tle[1], this.simulated_time);
        if (orbit_positions) {
            this.orbit_line!.geometry.setPositions(orbit_positions.flatMap((p) => [p.x, p.y, p.z]));
            this.orbit_line!.computeLineDistances();
        }
    }

    satellite_tooltip(): SatelliteTooltip {
        const satrec = this.tle[1];

        const mean_motion_rad_per_sec = satrec.no / 60;
        const mean_motion_rev_per_day = (satrec.no * 1440) / (2 * Math.PI);
        const inclination_deg = (satrec.inclo * 180) / Math.PI;
        const eccentricity = satrec.ecco;

        const semi_major_axis = Math.cbrt(
            EARTH_MU / (mean_motion_rad_per_sec * mean_motion_rad_per_sec)
        );

        const period_seconds = 86400 / mean_motion_rev_per_day;

        return {
            name: this.tle[0],
            position: this.target_satellite_position,
            orbital_regime: this.tle[2],
            period: format_duration(period_seconds),
            semi_major_axis: `${semi_major_axis.toFixed(0)} km`,
            eccentricity: `${eccentricity.toFixed(6)}`,
            inclination_deg: `${inclination_deg.toFixed(1)}°`
        };
    }
}

function propagate_to_time(
    tle: [string, SatRec, OrbitalRegime],
    target_time: Date
): [string, Vector3] {
    let [name, pos_and_vel]: [string, PositionAndVelocity | null] =
        propagate_tles_to_target_time([tle], target_time)[0];

    const position = pos_and_vel ? eci_to_three(pos_and_vel.position) : new Vector3(0, 0, 0);
    return [name, position];
}

export type SatelliteTooltip = {
    position: Vector3;
    name: string;
    orbital_regime: OrbitalRegime;
    period: string;
    semi_major_axis: string;
    eccentricity: string;
    inclination_deg: string;
};
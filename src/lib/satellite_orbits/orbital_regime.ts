import { type SatRec, } from 'satellite.js';

export const EARTH_MU = 398600.4418; // km^3 / s^2
export const EARTH_RADIUS_KM = 6378.137;


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


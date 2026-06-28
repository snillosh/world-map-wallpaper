import type {City} from "../models/City.ts";

export function lerp(start: number, end: number, amount: number): number {
    return start + (end - start) * amount;
}

export function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), maximum);
}

export function distanceBetweenCities(
    cityA: City,
    cityB: City,
) : number
{
    const earthRadius = 6371;

    const lat1 = toRadians(cityA.lat);
    const lat2 = toRadians(cityB.lat);

    const deltaLat = toRadians(cityB.lat - cityA.lat);
    const deltaLon = toRadians(cityB.lng - cityA.lng);

    const a =
        Math.sin(deltaLat / 2) ** 2 +
        Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLon / 2) ** 2;

    const c = 2 * Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a),
    );

    return earthRadius * c;
}

export function toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
}
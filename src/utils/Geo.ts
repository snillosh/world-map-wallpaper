export interface GeographicPoint {
    readonly lat: number;
    readonly lng: number;
}

export function distanceKm(
    first: GeographicPoint,
    second: GeographicPoint,
): number {
    const earthRadiusKm = 6_371;
    const latitude1 = toRadians(first.lat);
    const latitude2 = toRadians(second.lat);
    const latitudeDelta = toRadians(second.lat - first.lat);
    const longitudeDelta = toRadians(second.lng - first.lng);
    const haversine =
        Math.sin(latitudeDelta / 2) ** 2 +
        Math.cos(latitude1) *
            Math.cos(latitude2) *
            Math.sin(longitudeDelta / 2) ** 2;
    return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
}

export function shortestLongitudeDelta(
    fromLongitude: number,
    toLongitude: number,
): number {
    return ((toLongitude - fromLongitude + 540) % 360) - 180;
}

export function unwrapLongitudeNear(
    referenceLongitude: number,
    longitude: number,
): number {
    return referenceLongitude + shortestLongitudeDelta(
        referenceLongitude,
        longitude,
    );
}

function toRadians(degrees: number): number {
    return degrees * Math.PI / 180;
}

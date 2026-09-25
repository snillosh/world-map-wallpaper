import type { City } from "./City";

export type FlightPhaseKind =
    | "takeoff"
    | "climb"
    | "cruise"
    | "descent"
    | "landing";

export interface FlightPhase {
    readonly kind: FlightPhaseKind;
    readonly distanceKm: number;
    readonly durationMs: number;
    readonly startSpeedKmPerSecond: number;
    readonly endSpeedKmPerSecond: number;
    readonly startAltitudeKm: number;
    readonly endAltitudeKm: number;
}

export interface FlightPlan {
    readonly from: City;
    readonly to: City;
    readonly totalDistanceKm: number;
    readonly maximumAltitudeKm: number;
    readonly phases: readonly FlightPhase[];
}

export interface FlightState {
    readonly phase: FlightPhaseKind;
    readonly phaseProgress: number;
    readonly distanceTravelledKm: number;
    readonly routeProgress: number;
    readonly speedKmPerSecond: number;
    readonly altitudeKm: number;
    readonly completed: boolean;
}

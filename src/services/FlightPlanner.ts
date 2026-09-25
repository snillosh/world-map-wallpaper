import { Config } from "../config/Config";
import type { City } from "../models/City";
import type {
    FlightPhase,
    FlightPhaseKind,
    FlightPlan,
} from "../models/Flight";
import { distanceKm } from "../utils/Geo";

interface PhaseDefinition {
    readonly kind: FlightPhaseKind;
    readonly fullDistanceKm: number;
    readonly startSpeedRatio: number;
    readonly endSpeedRatio: number;
    readonly startAltitudeRatio: number;
    readonly endAltitudeRatio: number;
}

const transitionPhases: readonly PhaseDefinition[] = [
    {
        kind: "takeoff",
        fullDistanceKm: 400,
        startSpeedRatio: 0,
        endSpeedRatio: 0.45,
        startAltitudeRatio: 0,
        endAltitudeRatio: 0.08,
    },
    {
        kind: "climb",
        fullDistanceKm: 1_600,
        startSpeedRatio: 0.45,
        endSpeedRatio: 1,
        startAltitudeRatio: 0.08,
        endAltitudeRatio: 1,
    },
    {
        kind: "descent",
        fullDistanceKm: 1_600,
        startSpeedRatio: 1,
        endSpeedRatio: 0.4,
        startAltitudeRatio: 1,
        endAltitudeRatio: 0.08,
    },
    {
        kind: "landing",
        fullDistanceKm: 400,
        startSpeedRatio: 0.4,
        endSpeedRatio: 0,
        startAltitudeRatio: 0.08,
        endAltitudeRatio: 0,
    },
];

const fullTransitionDistanceKm = transitionPhases.reduce(
    (total, phase) => total + phase.fullDistanceKm,
    0,
);

export class FlightPlanner {
    public createPlan(from: City, to: City): FlightPlan {
        const totalDistanceKm = distanceKm(from, to);

        if (totalDistanceKm <= 0) {
            throw new Error("A flight needs two different locations.");
        }

        const transitionScale = Math.min(
            1,
            totalDistanceKm / fullTransitionDistanceKm,
        );

        // Short routes fly lower and slower instead of overlapping fixed phases.
        const maximumAltitudeKm =
            Config.flight.cruiseAltitudeKm * transitionScale;
        const speedScale = Math.max(0.25, Math.sqrt(transitionScale));
        const maximumSpeedKmPerSecond =
            Config.flight.cruiseSpeedKmPerSecond * speedScale;

        const phases: FlightPhase[] = [];

        for (const definition of transitionPhases.slice(0, 2)) {
            phases.push(this.createTransitionPhase(
                definition,
                transitionScale,
                maximumSpeedKmPerSecond,
                maximumAltitudeKm,
            ));
        }

        const transitionDistanceKm =
            fullTransitionDistanceKm * transitionScale;
        const cruiseDistanceKm = totalDistanceKm - transitionDistanceKm;

        if (cruiseDistanceKm > 0.001) {
            phases.push({
                kind: "cruise",
                distanceKm: cruiseDistanceKm,
                durationMs:
                    (cruiseDistanceKm / maximumSpeedKmPerSecond) * 1000,
                startSpeedKmPerSecond: maximumSpeedKmPerSecond,
                endSpeedKmPerSecond: maximumSpeedKmPerSecond,
                startAltitudeKm: maximumAltitudeKm,
                endAltitudeKm: maximumAltitudeKm,
            });
        }

        for (const definition of transitionPhases.slice(2)) {
            phases.push(this.createTransitionPhase(
                definition,
                transitionScale,
                maximumSpeedKmPerSecond,
                maximumAltitudeKm,
            ));
        }

        return {
            from,
            to,
            totalDistanceKm,
            maximumAltitudeKm,
            phases,
        };
    }

    private createTransitionPhase(
        definition: PhaseDefinition,
        distanceScale: number,
        maximumSpeedKmPerSecond: number,
        maximumAltitudeKm: number,
    ): FlightPhase {
        const distanceKm = definition.fullDistanceKm * distanceScale;
        const startSpeedKmPerSecond =
            maximumSpeedKmPerSecond * definition.startSpeedRatio;
        const endSpeedKmPerSecond =
            maximumSpeedKmPerSecond * definition.endSpeedRatio;
        const averageSpeedKmPerSecond =
            (startSpeedKmPerSecond + endSpeedKmPerSecond) / 2;

        return {
            kind: definition.kind,
            distanceKm,
            durationMs: (distanceKm / averageSpeedKmPerSecond) * 1000,
            startSpeedKmPerSecond,
            endSpeedKmPerSecond,
            startAltitudeKm:
                maximumAltitudeKm * definition.startAltitudeRatio,
            endAltitudeKm:
                maximumAltitudeKm * definition.endAltitudeRatio,
        };
    }
}

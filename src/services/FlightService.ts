import { Config } from "../config/Config";
import type {
    FlightPhase,
    FlightPhaseKind,
    FlightPlan,
    FlightState,
} from "../models/Flight";
import {
    clamp,
    lerp,
    smoothstep,
    smoothstepIntegral,
} from "../utils/Math";
import { MapService } from "./MapService";

type PhaseChangeHandler = (phase: FlightPhaseKind) => void;

export class FlightService {
    private readonly mapService: MapService;
    private speedMultiplier = 1;
    private targetFps = 30;

    constructor(mapService: MapService) {
        this.mapService = mapService;
    }

    public fly(
        plan: FlightPlan,
        onPhaseChange?: PhaseChangeHandler,
        signal?: AbortSignal,
    ): Promise<void> {
        let previousFrameTime = performance.now();
        let previousRenderTime = Number.NEGATIVE_INFINITY;
        let elapsedMs = 0;
        let activePhase: FlightPhaseKind | undefined;

        return new Promise((resolve) => {
            let animationFrame = 0;
            let finished = false;

            const finish = (): void => {
                if (finished) {
                    return;
                }
                finished = true;
                cancelAnimationFrame(animationFrame);
                signal?.removeEventListener("abort", finish);
                resolve();
            };

            if (signal?.aborted) {
                finish();
                return;
            }

            signal?.addEventListener("abort", finish, { once: true });

            const frame = (now: number): void => {
                if (signal?.aborted) {
                    finish();
                    return;
                }

                const wallTimeDeltaMs = Math.min(now - previousFrameTime, 100);
                previousFrameTime = now;
                elapsedMs += wallTimeDeltaMs * this.speedMultiplier;

                const state = this.getState(plan, elapsedMs);
                const minimumFrameTimeMs = 1000 / this.targetFps;
                const shouldRender =
                    state.completed ||
                    now - previousRenderTime >= minimumFrameTimeMs;

                if (!shouldRender) {
                    animationFrame = requestAnimationFrame(frame);
                    return;
                }

                previousRenderTime = now;

                if (state.phase !== activePhase) {
                    activePhase = state.phase;
                    onPhaseChange?.(state.phase);
                }

                const longitude = lerp(
                    plan.from.lng,
                    plan.to.lng,
                    state.routeProgress,
                );
                const latitude = lerp(
                    plan.from.lat,
                    plan.to.lat,
                    state.routeProgress,
                );
                const altitudeProgress =
                    state.altitudeKm / Config.flight.cruiseAltitudeKm;
                const zoom = lerp(
                    Config.flight.cityZoom,
                    Config.flight.cruiseZoom,
                    clamp(altitudeProgress, 0, 1),
                );

                this.mapService.setCamera(longitude, latitude, zoom);

                if (state.completed) {
                    finish();
                } else {
                    animationFrame = requestAnimationFrame(frame);
                }
            };

            animationFrame = requestAnimationFrame(frame);
        });
    }

    public setSpeedMultiplier(speedMultiplier: number): void {
        this.speedMultiplier = speedMultiplier;
    }

    public setTargetFps(targetFps: number): void {
        this.targetFps = targetFps;
    }

    private getState(plan: FlightPlan, elapsedMs: number): FlightState {
        let phaseStartTimeMs = 0;
        let phaseStartDistanceKm = 0;

        for (let index = 0; index < plan.phases.length; index += 1) {
            const phase = plan.phases[index];
            const phaseEndTimeMs = phaseStartTimeMs + phase.durationMs;
            const isFinalPhase = index === plan.phases.length - 1;

            if (elapsedMs < phaseEndTimeMs || isFinalPhase) {
                const phaseProgress = clamp(
                    (elapsedMs - phaseStartTimeMs) / phase.durationMs,
                    0,
                    1,
                );
                const easedProgress = smoothstep(phaseProgress);
                const phaseDistanceKm = this.getPhaseDistance(
                    phase,
                    phaseProgress,
                );
                const distanceTravelledKm = Math.min(
                    plan.totalDistanceKm,
                    phaseStartDistanceKm + phaseDistanceKm,
                );
                const completed = isFinalPhase && phaseProgress >= 1;

                return {
                    phase: phase.kind,
                    phaseProgress,
                    distanceTravelledKm,
                    routeProgress: completed
                        ? 1
                        : distanceTravelledKm / plan.totalDistanceKm,
                    speedKmPerSecond: lerp(
                        phase.startSpeedKmPerSecond,
                        phase.endSpeedKmPerSecond,
                        easedProgress,
                    ),
                    altitudeKm: lerp(
                        phase.startAltitudeKm,
                        phase.endAltitudeKm,
                        easedProgress,
                    ),
                    completed,
                };
            }

            phaseStartTimeMs = phaseEndTimeMs;
            phaseStartDistanceKm += phase.distanceKm;
        }

        throw new Error("Flight plan does not contain any phases.");
    }

    private getPhaseDistance(
        phase: FlightPhase,
        progress: number,
    ): number {
        const durationSeconds = phase.durationMs / 1000;
        const speedDifference =
            phase.endSpeedKmPerSecond - phase.startSpeedKmPerSecond;

        return durationSeconds * (
            phase.startSpeedKmPerSecond * progress +
            speedDifference * smoothstepIntegral(progress)
        );
    }
}

import { lerp, smoothstep } from "../utils/Math";
import { unwrapLongitudeNear } from "../utils/Geo";

export type ExploreStageKind =
    | "selecting-destination"
    | "moving"
    | "zooming-in"
    | "viewing"
    | "zooming-out";

export interface ExploreCameraState {
    readonly longitude: number;
    readonly latitude: number;
    readonly zoom: number;
}

export type ExploreCameraStage =
    | {
        readonly kind: "moving";
        readonly durationMs: number;
        readonly fromLongitude: number;
        readonly fromLatitude: number;
        readonly toLongitude: number;
        readonly toLatitude: number;
        readonly zoom: number;
    }
    | {
        readonly kind: "zooming-in" | "zooming-out";
        readonly durationMs: number;
        readonly longitude: number;
        readonly latitude: number;
        readonly fromZoom: number;
        readonly toZoom: number;
    }
    | {
        readonly kind: "viewing";
        readonly durationMs: number;
        readonly longitude: number;
        readonly latitude: number;
        readonly zoom: number;
    };

const minimumMoveDurationMs = 1_500;
const maximumMoveDurationMs = 8_000;
const moveMillisecondsPerKm = 0.8;

export function createMoveStage(
    from: ExploreCameraState,
    to: Pick<ExploreCameraState, "longitude" | "latitude">,
    durationMs: number,
): ExploreCameraStage {
    return {
        kind: "moving",
        durationMs,
        fromLongitude: from.longitude,
        fromLatitude: from.latitude,
        toLongitude: unwrapLongitudeNear(from.longitude, to.longitude),
        toLatitude: to.latitude,
        zoom: from.zoom,
    };
}

export function createZoomStage(
    kind: "zooming-in" | "zooming-out",
    position: Pick<ExploreCameraState, "longitude" | "latitude">,
    fromZoom: number,
    toZoom: number,
    durationMs: number,
): ExploreCameraStage {
    return {
        kind,
        durationMs,
        longitude: position.longitude,
        latitude: position.latitude,
        fromZoom,
        toZoom,
    };
}

export function createViewingStage(
    state: ExploreCameraState,
    durationMs: number,
): ExploreCameraStage {
    return { kind: "viewing", durationMs, ...state };
}

export function sampleExploreStage(
    stage: ExploreCameraStage,
    progress: number,
): ExploreCameraState {
    const easedProgress = smoothstep(progress);

    switch (stage.kind) {
        case "moving":
            return {
                longitude: lerp(
                    stage.fromLongitude,
                    stage.toLongitude,
                    easedProgress,
                ),
                latitude: lerp(
                    stage.fromLatitude,
                    stage.toLatitude,
                    easedProgress,
                ),
                zoom: stage.zoom,
            };
        case "zooming-in":
        case "zooming-out":
            return {
                longitude: stage.longitude,
                latitude: stage.latitude,
                zoom: lerp(stage.fromZoom, stage.toZoom, easedProgress),
            };
        case "viewing":
            return {
                longitude: stage.longitude,
                latitude: stage.latitude,
                zoom: stage.zoom,
            };
    }
}

export function getMoveDurationMs(distanceKm: number): number {
    return Math.min(
        maximumMoveDurationMs,
        Math.max(
            minimumMoveDurationMs,
            minimumMoveDurationMs + distanceKm * moveMillisecondsPerKm,
        ),
    );
}

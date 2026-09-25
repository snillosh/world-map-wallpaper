import type { ExploreCameraStage } from "../models/Explore";
import { sampleExploreStage } from "../models/Explore";
import { clamp } from "../utils/Math";
import { MapService } from "./MapService";

export class ExploreAnimator {
    private readonly mapService: MapService;

    constructor(mapService: MapService) {
        this.mapService = mapService;
    }

    public animate(
        stage: ExploreCameraStage,
        targetFps: number,
        signal: AbortSignal,
    ): Promise<void> {
        const startTime = performance.now();
        let previousRenderTime = Number.NEGATIVE_INFINITY;

        return new Promise((resolve) => {
            let animationFrame = 0;
            let finished = false;

            const finish = (): void => {
                if (finished) {
                    return;
                }
                finished = true;
                cancelAnimationFrame(animationFrame);
                signal.removeEventListener("abort", finish);
                resolve();
            };

            if (signal.aborted) {
                finish();
                return;
            }

            signal.addEventListener("abort", finish, { once: true });

            const frame = (now: number): void => {
                if (signal.aborted) {
                    finish();
                    return;
                }

                const progress = stage.durationMs <= 0
                    ? 1
                    : clamp((now - startTime) / stage.durationMs, 0, 1);
                const minimumFrameTimeMs = 1_000 / targetFps;

                if (
                    progress >= 1 ||
                    now - previousRenderTime >= minimumFrameTimeMs
                ) {
                    previousRenderTime = now;
                    const state = sampleExploreStage(stage, progress);
                    this.mapService.setCamera(
                        state.longitude,
                        state.latitude,
                        state.zoom,
                    );
                }

                if (progress >= 1) {
                    finish();
                } else {
                    animationFrame = requestAnimationFrame(frame);
                }
            };

            animationFrame = requestAnimationFrame(frame);
        });
    }
}

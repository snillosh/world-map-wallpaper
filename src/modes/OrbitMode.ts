import type { WallpaperSettings } from "../models/WallpaperSettings";
import { defaultWallpaperSettings } from "../models/WallpaperSettings";
import { MapService } from "../services/MapService";
import { RouteLabel } from "../ui/RouteLabel";
import type { WallpaperMode } from "./WallpaperMode";

const orbitPitch = 26;
const latitudeChangePerSecond = 4;
const zoomChangePerSecond = 0.4;

export class OrbitMode implements WallpaperMode {
    public readonly kind = "orbit";

    private readonly mapService: MapService;
    private readonly routeLabel: RouteLabel;
    private settings = defaultWallpaperSettings;

    constructor(mapService: MapService, routeLabel: RouteLabel) {
        this.mapService = mapService;
        this.routeLabel = routeLabel;
    }

    public updateSettings(settings: WallpaperSettings): void {
        this.settings = settings;
    }

    public start(signal: AbortSignal): Promise<void> {
        this.routeLabel.setVisible(false);

        let longitude = this.settings.orbit.startingLongitude;
        let latitude = this.settings.orbit.latitude;
        let zoom = this.settings.orbit.zoom;
        let previousFrameTime = performance.now();
        let previousRenderTime = Number.NEGATIVE_INFINITY;

        this.mapService.setCamera(
            longitude,
            latitude,
            zoom,
            orbitPitch,
        );

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

                const elapsedSeconds = Math.min(
                    (now - previousFrameTime) / 1000,
                    0.1,
                );
                previousFrameTime = now;

                const direction = this.settings.orbit.direction === "east"
                    ? 1
                    : -1;
                longitude += direction *
                    this.settings.orbit.speedDegreesPerMinute *
                    elapsedSeconds / 60;

                latitude = moveTowards(
                    latitude,
                    this.settings.orbit.latitude,
                    latitudeChangePerSecond * elapsedSeconds,
                );
                zoom = moveTowards(
                    zoom,
                    this.settings.orbit.zoom,
                    zoomChangePerSecond * elapsedSeconds,
                );

                const minimumFrameTimeMs =
                    1000 / this.settings.performance.targetFps;

                if (now - previousRenderTime >= minimumFrameTimeMs) {
                    previousRenderTime = now;

                    // Keep longitude unwrapped. MapLibre's world copies make
                    // crossing +180/-180 continuous without a camera reset.
                    this.mapService.setCamera(
                        longitude,
                        latitude,
                        zoom,
                        orbitPitch,
                    );
                }

                animationFrame = requestAnimationFrame(frame);
            };

            animationFrame = requestAnimationFrame(frame);
        });
    }
}

function moveTowards(current: number, target: number, maximumDelta: number): number {
    if (Math.abs(target - current) <= maximumDelta) {
        return target;
    }
    return current + Math.sign(target - current) * maximumDelta;
}

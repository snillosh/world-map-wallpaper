import { Config } from "../config/Config";
import type { City } from "../models/City";
import {clamp, distanceBetweenCities, lerp} from "../utils/Math";
import { MapService } from "./MapService";

export class FlightService {

    private readonly mapService: MapService;

    constructor(mapService: MapService) {
        this.mapService = mapService;
    }

    public fly(from: City, to: City): Promise<void> {
        const startTime = performance.now();

        return new Promise((resolve) => {

            const distance = distanceBetweenCities(from, to);
            const duration = (distance / Config.flight.cruiseSpeed) * 1000;

            const frame = (now: number): void => {
                const progress = clamp(
                    (now - startTime) / duration,
                    0,
                    1,
                );

                const longitude = lerp(from.lng, to.lng, progress);
                const latitude = lerp(from.lat, to.lat, progress);
                const zoom = this.getZoom(progress, duration);

                this.mapService.setCamera(longitude, latitude, zoom);

                if (progress < 1) {
                    requestAnimationFrame(frame);
                } else {
                    resolve();
                }
            };

            requestAnimationFrame(frame);
        });
    }

    private getZoom(progress: number, duration: number): number {

        const maxTakeoffPortion = 0.4;
        const maxLandingPortion = 0.4;

        const takeoffPortion = Math.min(
            Config.flight.takeoffDurationMs / duration,
            maxTakeoffPortion,
        );

        const landingPortion = Math.min(
            Config.flight.landingDurationMs / duration,
            maxLandingPortion,
        );

        const landingStartsAt = 1 - landingPortion;


        if (progress < takeoffPortion) {
            return lerp(
                Config.flight.cityZoom,
                Config.flight.cruiseZoom,
                progress / takeoffPortion,
            );
        }

        if (progress > landingStartsAt) {
            return lerp(
                Config.flight.cruiseZoom,
                Config.flight.cityZoom,
                (progress - landingStartsAt) / landingPortion
            );
        }

        return Config.flight.cruiseZoom;
    }
}
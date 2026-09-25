import type { City } from "../models/City";
import type {
    ExploreCameraState,
    ExploreCameraStage,
    ExploreStageKind,
} from "../models/Explore";
import {
    createMoveStage,
    createViewingStage,
    createZoomStage,
    getMoveDurationMs,
} from "../models/Explore";
import type {
    ExploreSettings,
    WallpaperSettings,
} from "../models/WallpaperSettings";
import { defaultWallpaperSettings } from "../models/WallpaperSettings";
import { CityService } from "../services/CityService";
import { DestinationEligibility } from "../services/DestinationEligibility";
import { ExploreAnimator } from "../services/ExploreAnimator";
import { ExploreDestinationPicker } from "../services/ExploreDestinationPicker";
import { MapService } from "../services/MapService";
import { RouteLabel } from "../ui/RouteLabel";
import { distanceKm, unwrapLongitudeNear } from "../utils/Geo";
import { sleep } from "../utils/Time";
import type { WallpaperMode } from "./WallpaperMode";

const minimumMeaningfulMoveKm = 0.1;

export class ExploreMode implements WallpaperMode {
    public readonly kind = "explore";

    private readonly mapService: MapService;
    private readonly cityService: CityService;
    private readonly routeLabel: RouteLabel;
    private readonly eligibility = new DestinationEligibility();
    private readonly animator: ExploreAnimator;
    private settings = defaultWallpaperSettings;
    private phase: ExploreStageKind = "selecting-destination";

    constructor(
        mapService: MapService,
        cityService: CityService,
        routeLabel: RouteLabel,
    ) {
        this.mapService = mapService;
        this.cityService = cityService;
        this.routeLabel = routeLabel;
        this.animator = new ExploreAnimator(mapService);
    }

    public updateSettings(settings: WallpaperSettings): void {
        this.settings = settings;
    }

    public async start(signal: AbortSignal): Promise<void> {
        const initialCities = await this.waitForEligibleCities(signal);
        if (initialCities === undefined) {
            return;
        }

        let picker = new ExploreDestinationPicker(initialCities);
        let appliedConstraints = this.getConstraintsKey();
        let currentCity = picker.pickInitialCity();
        let sequenceSettings = { ...this.settings.explore };
        let cameraState: ExploreCameraState = {
            longitude: currentCity.lng,
            latitude: currentCity.lat,
            zoom: sequenceSettings.zoomedOutLevel,
        };

        this.routeLabel.setVisible(true);
        this.mapService.setCamera(
            cameraState.longitude,
            cameraState.latitude,
            cameraState.zoom,
        );

        while (!signal.aborted) {
            cameraState = await this.inspectDestination(
                currentCity,
                cameraState,
                sequenceSettings,
                signal,
            );
            if (signal.aborted) {
                return;
            }

            const currentConstraints = this.getConstraintsKey();
            if (currentConstraints !== appliedConstraints) {
                const eligibleCities = await this.waitForEligibleCities(signal);
                if (eligibleCities === undefined) {
                    return;
                }
                picker = new ExploreDestinationPicker(eligibleCities);
                appliedConstraints = currentConstraints;
            }

            this.setPhase("selecting-destination", currentCity);
            const nextCity = picker.pickNextCity(currentCity);
            const nextSettings = { ...this.settings.explore };

            if (cameraState.zoom !== nextSettings.zoomedOutLevel) {
                const adjustmentKind = cameraState.zoom < nextSettings.zoomedOutLevel
                    ? "zooming-in"
                    : "zooming-out";
                const adjustment = createZoomStage(
                    adjustmentKind,
                    cameraState,
                    cameraState.zoom,
                    nextSettings.zoomedOutLevel,
                    1_000,
                );
                cameraState = await this.animate(
                    adjustment,
                    currentCity,
                    signal,
                );
            }

            cameraState = await this.moveToDestination(
                currentCity,
                nextCity,
                cameraState,
                signal,
            );
            currentCity = nextCity;
            sequenceSettings = nextSettings;
        }
    }

    public get activePhase(): ExploreStageKind {
        return this.phase;
    }

    private async inspectDestination(
        city: City,
        state: ExploreCameraState,
        settings: ExploreSettings,
        signal: AbortSignal,
    ): Promise<ExploreCameraState> {
        let cameraState = await this.animate(
            createZoomStage(
                "zooming-in",
                state,
                state.zoom,
                settings.zoomedInLevel,
                settings.zoomInDurationSeconds * 1_000,
            ),
            city,
            signal,
        );
        if (signal.aborted) {
            return cameraState;
        }

        cameraState = await this.animate(
            createViewingStage(
                cameraState,
                settings.viewDurationSeconds * 1_000,
            ),
            city,
            signal,
        );
        if (signal.aborted) {
            return cameraState;
        }

        return this.animate(
            createZoomStage(
                "zooming-out",
                cameraState,
                cameraState.zoom,
                settings.zoomedOutLevel,
                settings.zoomOutDurationSeconds * 1_000,
            ),
            city,
            signal,
        );
    }

    private async moveToDestination(
        fromCity: City,
        toCity: City,
        state: ExploreCameraState,
        signal: AbortSignal,
    ): Promise<ExploreCameraState> {
        const journeyDistanceKm = distanceKm(fromCity, toCity);
        const targetLongitude = unwrapLongitudeNear(state.longitude, toCity.lng);
        const target = { longitude: targetLongitude, latitude: toCity.lat };

        if (journeyDistanceKm < minimumMeaningfulMoveKm) {
            const nextState = { ...target, zoom: state.zoom };
            this.mapService.setCamera(
                nextState.longitude,
                nextState.latitude,
                nextState.zoom,
            );
            return nextState;
        }

        return this.animate(
            createMoveStage(state, target, getMoveDurationMs(journeyDistanceKm)),
            toCity,
            signal,
        );
    }

    private async animate(
        stage: ExploreCameraStage,
        city: City,
        signal: AbortSignal,
    ): Promise<ExploreCameraState> {
        this.setPhase(stage.kind, city);
        await this.animator.animate(
            stage,
            this.settings.performance.targetFps,
            signal,
        );

        switch (stage.kind) {
            case "moving":
                return {
                    longitude: stage.toLongitude,
                    latitude: stage.toLatitude,
                    zoom: stage.zoom,
                };
            case "zooming-in":
            case "zooming-out":
                return {
                    longitude: stage.longitude,
                    latitude: stage.latitude,
                    zoom: stage.toZoom,
                };
            case "viewing":
                return {
                    longitude: stage.longitude,
                    latitude: stage.latitude,
                    zoom: stage.zoom,
                };
        }
    }

    private getEligibleCities(): City[] {
        return this.eligibility.filter(this.cityService.all, {
            minimumPopulation: 0,
            continent: this.settings.destinations.continent,
            countryIso2: this.settings.destinations.countryIso2,
        });
    }

    private async waitForEligibleCities(
        signal: AbortSignal,
    ): Promise<City[] | undefined> {
        while (!signal.aborted) {
            const cities = this.getEligibleCities();
            if (cities.length >= 2) {
                return cities;
            }
            this.routeLabel.setVisible(true);
            this.routeLabel.setText(
                "No places match the current Explore destination filters",
            );
            await sleep(1_000, signal);
        }
        return undefined;
    }

    private getConstraintsKey(): string {
        return `${this.settings.destinations.continent ?? "*"}:` +
            `${this.settings.destinations.countryIso2 ?? "*"}`;
    }

    private setPhase(phase: ExploreStageKind, city: City): void {
        this.phase = phase;
        const status = phase
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
        this.routeLabel.setText(`${city.city}, ${city.country} · ${status}`);
    }
}

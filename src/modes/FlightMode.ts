import { Config } from "../config/Config";
import type { City } from "../models/City";
import type { WallpaperSettings } from "../models/WallpaperSettings";
import { defaultWallpaperSettings } from "../models/WallpaperSettings";
import { CityService } from "../services/CityService";
import { DestinationEligibility } from "../services/DestinationEligibility";
import { DestinationPicker } from "../services/DestinationPicker";
import { FlightPlanner } from "../services/FlightPlanner";
import { FlightService } from "../services/FlightService";
import { MapService } from "../services/MapService";
import { RouteLabel } from "../ui/RouteLabel";
import { sleep } from "../utils/Time";
import type { WallpaperMode } from "./WallpaperMode";

export class FlightMode implements WallpaperMode {
    public readonly kind = "flight";

    private readonly mapService: MapService;
    private readonly cityService: CityService;
    private readonly routeLabel: RouteLabel;
    private readonly destinationEligibility = new DestinationEligibility();
    private readonly flightPlanner = new FlightPlanner();
    private readonly flightService: FlightService;
    private settings = defaultWallpaperSettings;

    constructor(
        mapService: MapService,
        cityService: CityService,
        routeLabel: RouteLabel,
    ) {
        this.mapService = mapService;
        this.cityService = cityService;
        this.routeLabel = routeLabel;
        this.flightService = new FlightService(mapService);
    }

    public updateSettings(settings: WallpaperSettings): void {
        this.settings = settings;
        this.flightService.setSpeedMultiplier(settings.flight.speedMultiplier);
        this.flightService.setTargetFps(settings.performance.targetFps);
        this.routeLabel.setVisible(settings.flight.showRouteLabel);
    }

    public async start(signal: AbortSignal): Promise<void> {
        const initialCities = await this.waitForEligibleCities(signal);
        if (initialCities === undefined) {
            return;
        }

        let destinationPicker = new DestinationPicker(initialCities);
        let appliedConstraints = this.getConstraintsKey();
        let currentCity = destinationPicker.pickInitialCity();

        this.routeLabel.setVisible(this.settings.flight.showRouteLabel);
        this.routeLabel.setLoading(initialCities.length);
        this.mapService.setCamera(
            currentCity.lng,
            currentCity.lat,
            Config.flight.cityZoom,
        );

        await sleep(Config.flight.initialPauseMs, signal);

        while (!signal.aborted) {
            const currentConstraints = this.getConstraintsKey();
            if (appliedConstraints !== currentConstraints) {
                const eligibleCities = await this.waitForEligibleCities(signal);
                if (eligibleCities === undefined) {
                    return;
                }

                destinationPicker = new DestinationPicker(eligibleCities);
                appliedConstraints = currentConstraints;
            }

            const nextCity = destinationPicker.pickNextCity(currentCity);

            this.routeLabel.setRoute(
                currentCity.city,
                currentCity.country,
                nextCity.city,
                nextCity.country,
            );

            const flightPlan = this.flightPlanner.createPlan(currentCity, nextCity);

            await this.flightService.fly(
                flightPlan,
                (phase) => this.routeLabel.setPhase(phase),
                signal,
            );

            if (signal.aborted) {
                return;
            }

            currentCity = nextCity;
            await sleep(Config.flight.pauseBetweenFlightsMs, signal);
        }
    }

    private getEligibleCities(): City[] {
        return this.destinationEligibility.filter(this.cityService.all, {
            minimumPopulation: this.settings.flight.minimumPopulation,
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

            this.routeLabel.setVisible(this.settings.flight.showRouteLabel);
            this.routeLabel.setText(
                "No routes match the current Flight destination filters",
            );
            await sleep(1_000, signal);
        }

        return undefined;
    }

    private getConstraintsKey(): string {
        return `${this.settings.destinations.continent ?? "*"}:` +
            `${this.settings.destinations.countryIso2 ?? "*"}:` +
            this.settings.flight.minimumPopulation;
    }
}

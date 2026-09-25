import "./styles/style.css";

import { Config } from "./config/Config";
import { DestinationPicker } from "./services/DestinationPicker";
import { CityService } from "./services/CityService";
import { FlightService } from "./services/FlightService";
import { FlightPlanner } from "./services/FlightPlanner";
import { MapService } from "./services/MapService";
import { RouteLabel } from "./ui/RouteLabel";
import { sleep } from "./utils/Time";

async function main(): Promise<void> {
    const routeLabel = new RouteLabel();
    const mapService = new MapService();
    const cityService = new CityService();

    try {
        routeLabel.setText("Loading map…");
        await mapService.initialise();

        routeLabel.setText("Loading cities…");
        await cityService.initialise();

        routeLabel.setLoading(cityService.count);

        const destinationPicker = new DestinationPicker(cityService.all);
        const flightPlanner = new FlightPlanner();
        const flightService = new FlightService(mapService);

        let currentCity = destinationPicker.pickInitialCity();

        mapService.setCamera(
            currentCity.lng,
            currentCity.lat,
            Config.flight.cityZoom,
        );

        await sleep(Config.flight.initialPauseMs);

        while (true) {
            const nextCity = destinationPicker.pickNextCity(currentCity);

            routeLabel.setRoute(
                currentCity.city,
                currentCity.country,
                nextCity.city,
                nextCity.country,
            );

            const flightPlan = flightPlanner.createPlan(currentCity, nextCity);

            await flightService.fly(
                flightPlan,
                (phase) => routeLabel.setPhase(phase),
            );

            currentCity = nextCity;

            await sleep(Config.flight.pauseBetweenFlightsMs);
        }
    } catch (error) {
        console.error(error);

        routeLabel.setError(
            error instanceof Error ? error.message : "Something went wrong.",
        );
    }
}

void main();

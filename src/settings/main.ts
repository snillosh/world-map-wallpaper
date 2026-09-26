import "./settings.css";

import { Config } from "../config/Config";
import type {
    BehaviourModeKind,
    DestinationCountryId,
    DestinationContinent,
    MapStyle,
    OrbitDirection,
    TargetFps,
    WallpaperSettings,
} from "../models/WallpaperSettings";
import {
    defaultWallpaperSettings,
    destinationContinents,
    settingsLimits,
} from "../models/WallpaperSettings";
import type { Country } from "../models/Country";
import {
    filterCountryOptions,
    getCountryDestinationId,
    loadCountryOptions,
} from "../services/CountryCatalog";
import { SearchableSelect } from "./SearchableSelect";
import type { ConnectionState } from "./SettingsClient";
import { SettingsClient } from "./SettingsClient";

const behaviourMode = getElement<HTMLSelectElement>("behaviour-mode");
const mapStyle = getElement<HTMLSelectElement>("map-style");
const targetFps = getElement<HTMLSelectElement>("target-fps");
const showRouteLabel = getElement<HTMLInputElement>("show-route-label");
const continentSelect = getElement<HTMLSelectElement>("destination-continent");
const countryContainer = getElement<HTMLElement>("destination-country");
const destinationPanel = document.querySelector<HTMLElement>(
    "[data-destination-settings]",
);
const orbitDirection = getElement<HTMLSelectElement>("orbit-direction");
const orbitStartingLongitude = getElement<HTMLInputElement>(
    "orbit-starting-longitude",
);
const connectionDot = getElement<HTMLElement>("connection-dot");
const connectionState = getElement<HTMLElement>("connection-state");
const connectionDetail = getElement<HTMLElement>("connection-detail");
const modePanels = Array.from(
    document.querySelectorAll<HTMLElement>("[data-mode-settings]"),
);
const destinationModes: readonly BehaviourModeKind[] = ["flight", "explore"];
let countries: readonly Country[] = [];
let currentSettings = defaultWallpaperSettings;

for (const continent of destinationContinents) {
    const option = document.createElement("option");
    option.value = continent;
    option.textContent = continent;
    continentSelect.append(option);
}

const client = new SettingsClient({
    url: Config.settings.webSocketUrl,
    role: "settings",
    onSettings: renderSettings,
    onConnectionChange: renderConnection,
    onError: (message) => {
        connectionDetail.textContent = message;
    },
});

const countrySelect = new SearchableSelect<DestinationCountryId | null>(
    countryContainer,
    defaultWallpaperSettings.destinations.countryIso2,
    {
        inputId: "destination-country-input",
        placeholder: "Search or select a country…",
        options: [{ value: null, label: "All Countries" }],
        onChange: (countryIso2) => client.update({
            destinations: { countryIso2 },
        }),
    },
);

void loadCountryOptions(Config.cities.countriesUrl)
    .then((loadedCountries) => {
        countries = loadedCountries;
        renderCountryOptions(
            currentSettings.destinations.continent,
            currentSettings.destinations.countryIso2,
        );
    })
    .catch((error: unknown) => {
        console.error("Could not load the country list.", error);
    });

const flightSpeed = bindRangeControl({
    inputId: "flight-speed",
    outputId: "flight-speed-value",
    minimum: settingsLimits.flight.speedMultiplier.minimum,
    maximum: settingsLimits.flight.speedMultiplier.maximum,
    format: (value) => `${value.toFixed(2)}×`,
    onInput: (value) => client.update({
        flight: { speedMultiplier: value },
    }),
});

const minimumPopulation = bindRangeControl({
    inputId: "minimum-population",
    outputId: "minimum-population-value",
    minimum: settingsLimits.flight.minimumPopulation.minimum,
    maximum: settingsLimits.flight.minimumPopulation.maximum,
    format: (value) => value.toLocaleString(),
    onInput: (value) => client.update({
        flight: { minimumPopulation: value },
    }),
});

const orbitSpeed = bindRangeControl({
    inputId: "orbit-speed",
    outputId: "orbit-speed-value",
    minimum: settingsLimits.orbit.speedDegreesPerMinute.minimum,
    maximum: settingsLimits.orbit.speedDegreesPerMinute.maximum,
    format: (value) => `${value.toFixed(1)}°/min`,
    onInput: (value) => client.update({
        orbit: { speedDegreesPerMinute: value },
    }),
});

const orbitLatitude = bindRangeControl({
    inputId: "orbit-latitude",
    outputId: "orbit-latitude-value",
    minimum: settingsLimits.orbit.latitude.minimum,
    maximum: settingsLimits.orbit.latitude.maximum,
    format: formatLatitude,
    onInput: (value) => client.update({ orbit: { latitude: value } }),
});

const orbitZoom = bindRangeControl({
    inputId: "orbit-zoom",
    outputId: "orbit-zoom-value",
    minimum: settingsLimits.orbit.zoom.minimum,
    maximum: settingsLimits.orbit.zoom.maximum,
    format: (value) => value.toFixed(1),
    onInput: (value) => client.update({ orbit: { zoom: value } }),
});

const exploreZoomedOut = bindRangeControl({
    inputId: "explore-zoomed-out",
    outputId: "explore-zoomed-out-value",
    minimum: settingsLimits.explore.zoomedOutLevel.minimum,
    maximum: settingsLimits.explore.zoomedOutLevel.maximum,
    format: (value) => value.toFixed(1),
    onInput: (value) => client.update({
        explore: { zoomedOutLevel: value },
    }),
});

const exploreZoomedIn = bindRangeControl({
    inputId: "explore-zoomed-in",
    outputId: "explore-zoomed-in-value",
    minimum: settingsLimits.explore.zoomedInLevel.minimum,
    maximum: settingsLimits.explore.zoomedInLevel.maximum,
    format: (value) => value.toFixed(1),
    onInput: (value) => client.update({
        explore: { zoomedInLevel: value },
    }),
});

const exploreZoomInDuration = bindRangeControl({
    inputId: "explore-zoom-in-duration",
    outputId: "explore-zoom-in-duration-value",
    minimum: settingsLimits.explore.zoomInDurationSeconds.minimum,
    maximum: settingsLimits.explore.zoomInDurationSeconds.maximum,
    format: formatSeconds,
    onInput: (value) => client.update({
        explore: { zoomInDurationSeconds: value },
    }),
});

const exploreViewDuration = bindRangeControl({
    inputId: "explore-view-duration",
    outputId: "explore-view-duration-value",
    minimum: settingsLimits.explore.viewDurationSeconds.minimum,
    maximum: settingsLimits.explore.viewDurationSeconds.maximum,
    format: formatSeconds,
    onInput: (value) => client.update({
        explore: { viewDurationSeconds: value },
    }),
});

const exploreZoomOutDuration = bindRangeControl({
    inputId: "explore-zoom-out-duration",
    outputId: "explore-zoom-out-duration-value",
    minimum: settingsLimits.explore.zoomOutDurationSeconds.minimum,
    maximum: settingsLimits.explore.zoomOutDurationSeconds.maximum,
    format: formatSeconds,
    onInput: (value) => client.update({
        explore: { zoomOutDurationSeconds: value },
    }),
});

behaviourMode.addEventListener("change", () => {
    client.update({ behaviourMode: behaviourMode.value as BehaviourModeKind });
});

mapStyle.addEventListener("change", () => {
    client.update({ visual: { mapStyle: mapStyle.value as MapStyle } });
});

targetFps.addEventListener("change", () => {
    client.update({
        performance: { targetFps: Number(targetFps.value) as TargetFps },
    });
});

showRouteLabel.addEventListener("change", () => {
    client.update({
        flight: { showRouteLabel: showRouteLabel.checked },
    });
});

continentSelect.addEventListener("change", () => {
    client.update({
        destinations: {
            continent: continentSelect.value === ""
                ? null
                : continentSelect.value as DestinationContinent,
        },
    });
});

orbitDirection.addEventListener("change", () => {
    client.update({
        orbit: { direction: orbitDirection.value as OrbitDirection },
    });
});

orbitStartingLongitude.addEventListener("change", () => {
    if (
        orbitStartingLongitude.value === "" ||
        !orbitStartingLongitude.validity.valid
    ) {
        return;
    }

    client.update({
        orbit: { startingLongitude: Number(orbitStartingLongitude.value) },
    });
});

renderSettings(defaultWallpaperSettings);
client.start();

function renderSettings(settings: WallpaperSettings): void {
    currentSettings = settings;
    behaviourMode.value = settings.behaviourMode;
    mapStyle.value = settings.visual.mapStyle;
    targetFps.value = settings.performance.targetFps.toString();
    showRouteLabel.checked = settings.flight.showRouteLabel;
    orbitDirection.value = settings.orbit.direction;
    orbitStartingLongitude.value = settings.orbit.startingLongitude.toString();
    continentSelect.value = settings.destinations.continent ?? "";
    renderCountryOptions(
        settings.destinations.continent,
        settings.destinations.countryIso2,
    );

    flightSpeed.set(settings.flight.speedMultiplier);
    minimumPopulation.set(settings.flight.minimumPopulation);
    orbitSpeed.set(settings.orbit.speedDegreesPerMinute);
    orbitLatitude.set(settings.orbit.latitude);
    orbitZoom.set(settings.orbit.zoom);
    exploreZoomedOut.set(settings.explore.zoomedOutLevel);
    exploreZoomedIn.set(settings.explore.zoomedInLevel);
    exploreZoomInDuration.set(settings.explore.zoomInDurationSeconds);
    exploreViewDuration.set(settings.explore.viewDurationSeconds);
    exploreZoomOutDuration.set(settings.explore.zoomOutDurationSeconds);

    for (const panel of modePanels) {
        panel.hidden = panel.dataset.modeSettings !== settings.behaviourMode;
    }
    if (destinationPanel !== null) {
        destinationPanel.hidden = !destinationModes.includes(
            settings.behaviourMode,
        );
    }
}

function renderCountryOptions(
    continent: DestinationContinent | null,
    selectedCountry: DestinationCountryId | null,
): void {
    const availableCountries = filterCountryOptions(countries, continent);
    countrySelect.setOptions([
        { value: null, label: "All Countries" },
        ...availableCountries.map((country) => ({
            value: getCountryDestinationId(country),
            label: country.name,
        })),
    ]);
    countrySelect.setValue(selectedCountry);
}

function renderConnection(state: ConnectionState): void {
    connectionDot.dataset.state = state;

    switch (state) {
        case "connected":
            connectionState.textContent = "Connected";
            connectionDetail.textContent = "Changes are updating the wallpaper live";
            break;
        case "connecting":
            connectionState.textContent = "Connecting…";
            connectionDetail.textContent = "Looking for the local wallpaper host";
            break;
        case "disconnected":
            connectionState.textContent = "Host unavailable";
            connectionDetail.textContent = "Changes will be sent when it reconnects";
            break;
    }
}

interface RangeControlOptions {
    readonly inputId: string;
    readonly outputId: string;
    readonly minimum: number;
    readonly maximum: number;
    readonly format: (value: number) => string;
    readonly onInput: (value: number) => void;
}

interface RangeControl {
    set(value: number): void;
}

function bindRangeControl(options: RangeControlOptions): RangeControl {
    const input = getElement<HTMLInputElement>(options.inputId);
    const output = getElement<HTMLOutputElement>(options.outputId);

    const set = (value: number): void => {
        input.value = value.toString();
        output.value = options.format(value);
        const progress =
            ((value - options.minimum) / (options.maximum - options.minimum)) *
            100;
        input.style.setProperty("--range-progress", `${progress}%`);
    };

    input.addEventListener("input", () => {
        const value = Number(input.value);
        set(value);
        options.onInput(value);
    });

    return { set };
}

function formatLatitude(value: number): string {
    if (value === 0) {
        return "Equator";
    }
    return `${Math.abs(value)}° ${value > 0 ? "N" : "S"}`;
}

function formatSeconds(value: number): string {
    return `${value} sec`;
}

function getElement<ElementType extends HTMLElement>(id: string): ElementType {
    const element = document.getElementById(id);
    if (!(element instanceof HTMLElement)) {
        throw new Error(`Could not find #${id}.`);
    }
    return element as ElementType;
}

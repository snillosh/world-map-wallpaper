export const Config = {
    map: {
        // custom-map-night.json is the canonical style; this is an experiment.
        styleUrl: new URL(
            "../../custom-map-night-density-experiment.json",
            import.meta.url,
        ).href,
        initialCenter: [0, 20] as [number, number],
        initialZoom: 2.2,
        interactive: false,
    },

    cities: {
        dataUrl: new URL("../../cities.json", import.meta.url).href,
        minimumPopulation: 250_000,
    },

    flight: {
        pauseBetweenFlightsMs: 5_000,
        initialPauseMs: 5_000,

        cruiseSpeedKmPerSecond: 75,
        cruiseAltitudeKm: 11,

        cityZoom: 10,
        cruiseZoom: 5.0,
    },
} as const;

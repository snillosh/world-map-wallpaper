export const Config = {
    map: {
        styleUrl: "./custom-map.json",
        initialCenter: [0, 20] as [number, number],
        initialZoom: 2.2,
        interactive: false,
    },

    cities: {
        dataUrl: "./cities.json",
        minimumPopulation: 250_000,
    },

    flight: {
        pauseBetweenFlightsMs: 5_000,
        initialPauseMs: 5_000,

        cruiseSpeed: 300,
        takeoffDurationMs: 6000,
        landingDurationMs: 8000,

        cityZoom: 10,
        cruiseZoom: 5.0,
    },
} as const;
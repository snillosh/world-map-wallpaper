export const Config = {
    map: {
        styleUrls: {
            "night-flight": new URL(
                "../../custom-map-night.json",
                import.meta.url,
            ).href,
            "night-density": new URL(
                "../../custom-map-night-density-experiment.json",
                import.meta.url,
            ).href,
            "muted-orange": new URL(
                "../../custom-map-orange.json",
                import.meta.url,
            ).href,
            classic: new URL("../../custom-map.json", import.meta.url).href,
        },
        initialCenter: [0, 20] as [number, number],
        initialZoom: 2.2,
        interactive: false,
    },

    cities: {
        dataUrl: new URL("../../cities.json", import.meta.url).href,
        countriesUrl: new URL("../../countries.json", import.meta.url).href,
    },

    flight: {
        pauseBetweenFlightsMs: 5_000,
        initialPauseMs: 5_000,

        cruiseSpeedKmPerSecond: 75,
        cruiseAltitudeKm: 11,

        cityZoom: 10,
        cruiseZoom: 5.0,
    },

    settings: {
        webSocketUrl: "ws://127.0.0.1:47631",
    },
} as const;

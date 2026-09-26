export const Config = {
    map: {
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
        wallpaperWebSocketUrl: getSettingsWebSocketUrl("settings"),
        controlPanelWebSocketUrl: getSettingsWebSocketUrl("settings-admin"),
    },
} as const;

function getSettingsWebSocketUrl(productionPath: string): string {
    if (import.meta.env?.DEV) {
        return "ws://127.0.0.1:47631";
    }

    const protocol = globalThis.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${globalThis.location.host}/${productionPath}`;
}

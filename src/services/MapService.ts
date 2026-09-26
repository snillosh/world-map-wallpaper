import { Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

import { Config } from "../config/Config";
import { buildLocalStyle } from "../map/LocalStyle";
import {
    getConfiguredMapTilerApiKey,
    isSatelliteMapStyle,
    loadSatelliteStyle,
} from "../map/SatelliteStyle";
import type { MapStyle } from "../models/WallpaperSettings";

// MapLibre 6 ships its renderer as a separate ES-module worker. Vite must
// bundle it explicitly; otherwise a production build looks for an unbundled
// sibling file and the map remains on its grey loading screen.
setWorkerUrl(mapLibreWorkerUrl);

export class MapService {
    private readonly map: MapLibreMap;
    private mapStyle: MapStyle;
    private requestedStyle: MapStyle;
    private styleRequest = 0;
    private styleAbortController: AbortController | undefined;
    private reportedSatelliteError = false;
    private readonly onError?: (error: Error) => void;

    constructor(initialStyle: MapStyle, onError?: (error: Error) => void) {
        if (isSatelliteMapStyle(initialStyle)) {
            throw new Error("The initial map style must be locally available.");
        }

        this.mapStyle = initialStyle;
        this.requestedStyle = initialStyle;
        this.onError = onError;
        this.map = new MapLibreMap({
            container: "map",
            style: buildLocalStyle(
                initialStyle,
                getConfiguredMapTilerApiKey(),
            ),
            center: Config.map.initialCenter,
            zoom: Config.map.initialZoom,
            interactive: Config.map.interactive,
            // Unwrapped longitudes let Orbit cross the antimeridian seamlessly.
            renderWorldCopies: true,
            attributionControl: { compact: true },
        });

        this.map.on("error", (event) => {
            if (
                !isSatelliteMapStyle(this.mapStyle) ||
                this.reportedSatelliteError
            ) {
                return;
            }

            this.reportedSatelliteError = true;
            const detail = event.error instanceof Error
                ? redactApiKey(event.error.message)
                : "Map content could not be loaded.";
            this.onError?.(new Error(
                `The satellite map could not finish loading. ${detail}`,
            ));
        });
    }

    public async initialise(): Promise<void> {
        if (this.map.loaded()) {
            return;
        }

        return new Promise((resolve) => {
            this.map.once("load", () => resolve());
        });
    }

    public setCamera(
        longitude: number,
        latitude: number,
        zoom: number,
        pitch = 0,
        bearing = 0,
    ): void {
        this.map.jumpTo({
            center: [longitude, latitude],
            zoom,
            pitch,
            bearing,
        });
    }

    public async setStyle(mapStyle: MapStyle): Promise<void> {
        if (mapStyle === this.requestedStyle) {
            return;
        }

        const request = ++this.styleRequest;
        this.requestedStyle = mapStyle;
        this.styleAbortController?.abort();
        this.styleAbortController = undefined;

        try {
            if (isSatelliteMapStyle(mapStyle)) {
                const abortController = new AbortController();
                this.styleAbortController = abortController;
                const style = await loadSatelliteStyle(
                    mapStyle,
                    getConfiguredMapTilerApiKey(),
                    fetch,
                    abortController.signal,
                );

                if (request !== this.styleRequest) {
                    return;
                }

                this.map.setStyle(style);
            } else {
                this.map.setStyle(buildLocalStyle(
                    mapStyle,
                    getConfiguredMapTilerApiKey(),
                ));
            }

            if (request === this.styleRequest) {
                this.mapStyle = mapStyle;
                this.reportedSatelliteError = false;
            }
        } catch (error) {
            if (request !== this.styleRequest || isAbortError(error)) {
                return;
            }

            // Leave the last working map visible and allow an explicit retry.
            this.requestedStyle = this.mapStyle;
            throw error;
        }
    }

    public get instance(): MapLibreMap {
        return this.map;
    }
}

function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === "AbortError";
}

function redactApiKey(message: string): string {
    return message.replace(/([?&]key=)[^&\s]+/giu, "$1…");
}

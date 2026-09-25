import maplibregl from "maplibre-gl";

import { Config } from "../config/Config";
import type { MapStyle } from "../models/WallpaperSettings";

export class MapService {
    private readonly map: maplibregl.Map;
    private mapStyle: MapStyle;

    constructor(initialStyle: MapStyle) {
        this.mapStyle = initialStyle;
        this.map = new maplibregl.Map({
            container: "map",
            style: Config.map.styleUrls[initialStyle],
            center: Config.map.initialCenter,
            zoom: Config.map.initialZoom,
            interactive: Config.map.interactive,
            // Unwrapped longitudes let Orbit cross the antimeridian seamlessly.
            renderWorldCopies: true,
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

    public setStyle(mapStyle: MapStyle): void {
        if (mapStyle === this.mapStyle) {
            return;
        }

        this.mapStyle = mapStyle;
        this.map.setStyle(Config.map.styleUrls[mapStyle]);
    }

    public get instance(): maplibregl.Map {
        return this.map;
    }
}

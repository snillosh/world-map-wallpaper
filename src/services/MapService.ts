import maplibregl from "maplibre-gl";

import { Config } from "../config/Config";

export class MapService {
    private readonly map: maplibregl.Map;

    constructor() {
        this.map = new maplibregl.Map({
            container: "map",
            style: Config.map.styleUrl,
            center: Config.map.initialCenter,
            zoom: Config.map.initialZoom,
            interactive: Config.map.interactive,
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
    ): void {
        this.map.jumpTo({
            center: [longitude, latitude],
            zoom,
        });
    }

    public get instance(): maplibregl.Map {
        return this.map;
    }
}
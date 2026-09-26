import type { StyleSpecification } from "maplibre-gl";

import classicStyle from "../../custom-map.json";
import nightDensityStyle from "../../custom-map-night-density-experiment.json";
import nightStyle from "../../custom-map-night.json";
import mutedOrangeStyle from "../../custom-map-orange.json";
import type { MapStyle } from "../models/WallpaperSettings";
import {
    MapTilerConfigurationError,
    normalizeMapTilerApiKey,
    requireStyleSpecification,
} from "./SatelliteStyle";

export const localMapStyles = [
    "night-flight",
    "night-density",
    "muted-orange",
    "classic",
] as const satisfies readonly MapStyle[];

export type LocalMapStyle = typeof localMapStyles[number];

const mapTilerSampleKey = "get_your_own_OpIi9ZULNHzrESv6T2vL";
const styles: Readonly<Record<LocalMapStyle, unknown>> = {
    "night-flight": nightStyle,
    "night-density": nightDensityStyle,
    "muted-orange": mutedOrangeStyle,
    classic: classicStyle,
};

export function buildLocalStyle(
    mapStyle: LocalMapStyle,
    apiKey: string | undefined,
): StyleSpecification {
    const key = normalizeMapTilerApiKey(apiKey);
    if (key === undefined) {
        throw new MapTilerConfigurationError();
    }

    const escapedKey = JSON.stringify(key).slice(1, -1);
    const styleJson = JSON.stringify(styles[mapStyle])
        .split(mapTilerSampleKey)
        .join(escapedKey);

    return requireStyleSpecification(JSON.parse(styleJson));
}

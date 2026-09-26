import type {
    LayerSpecification,
    SourceSpecification,
    StyleSpecification,
} from "maplibre-gl";

import type { MapStyle } from "../models/WallpaperSettings";

export const satelliteMapStyles = [
    "satellite-light",
    "satellite-dark",
    "satellite-hybrid-light",
    "satellite-hybrid-dark",
] as const satisfies readonly MapStyle[];

export type SatelliteMapStyle = typeof satelliteMapStyles[number];

interface SatelliteStyleDefinition {
    readonly appearance: "light" | "dark";
    readonly variant: "minimal" | "hybrid";
    readonly mapTilerStyleId: string;
}

interface StyleResponse {
    readonly ok: boolean;
    readonly status: number;
    json(): Promise<unknown>;
}

export type SatelliteStyleFetcher = (
    input: string,
    init?: RequestInit,
) => Promise<StyleResponse>;

const contextSourceId = "wallpaper-satellite-context";
const terrainSourceId = "wallpaper-satellite-terrain";

const definitions: Readonly<Record<
    SatelliteMapStyle,
    SatelliteStyleDefinition
>> = {
    "satellite-light": {
        appearance: "light",
        variant: "minimal",
        mapTilerStyleId: "satellite-v4",
    },
    "satellite-dark": {
        appearance: "dark",
        variant: "minimal",
        mapTilerStyleId: "satellite-v4-dark",
    },
    "satellite-hybrid-light": {
        appearance: "light",
        variant: "hybrid",
        mapTilerStyleId: "hybrid-v4",
    },
    "satellite-hybrid-dark": {
        appearance: "dark",
        variant: "hybrid",
        mapTilerStyleId: "hybrid-v4-dark",
    },
};

export class MapTilerConfigurationError extends Error {
    constructor() {
        super(
            "Map styles need a MapTiler API key. Add " +
            "VITE_MAPTILER_API_KEY to a local .env file, then restart the wallpaper.",
        );
        this.name = "MapTilerConfigurationError";
    }
}

export function isSatelliteMapStyle(
    mapStyle: MapStyle,
): mapStyle is SatelliteMapStyle {
    return (satelliteMapStyles as readonly string[]).includes(mapStyle);
}

export function normalizeMapTilerApiKey(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }

    const key = value.trim();
    return key.length > 0 ? key : undefined;
}

export function getConfiguredMapTilerApiKey(): string | undefined {
    return normalizeMapTilerApiKey(import.meta.env?.VITE_MAPTILER_API_KEY);
}

export function getMapTilerStyleUrl(
    mapStyle: SatelliteMapStyle,
    apiKey: string,
): string {
    const key = normalizeMapTilerApiKey(apiKey);
    if (key === undefined) {
        throw new MapTilerConfigurationError();
    }

    const styleId = definitions[mapStyle].mapTilerStyleId;
    const url = new URL(`https://api.maptiler.com/maps/${styleId}/style.json`);
    url.searchParams.set("key", key);
    return url.href;
}

export async function loadSatelliteStyle(
    mapStyle: SatelliteMapStyle,
    apiKey: string | undefined,
    fetcher: SatelliteStyleFetcher = fetch,
    signal?: AbortSignal,
): Promise<StyleSpecification> {
    if (apiKey === undefined) {
        throw new MapTilerConfigurationError();
    }

    const response = await fetcher(getMapTilerStyleUrl(mapStyle, apiKey), {
        cache: "default",
        signal,
    });

    if (!response.ok) {
        throw new Error(
            `MapTiler could not load the selected satellite style (HTTP ${response.status}). ` +
            "Check VITE_MAPTILER_API_KEY and its allowed URL restrictions.",
        );
    }

    const style = requireStyleSpecification(await response.json());
    return buildSatelliteStyle(style, mapStyle, apiKey);
}

export function buildSatelliteStyle(
    providerStyle: StyleSpecification,
    mapStyle: SatelliteMapStyle,
    apiKey: string,
): StyleSpecification {
    const definition = definitions[mapStyle];
    const sources: Record<string, SourceSpecification> = {
        ...providerStyle.sources,
        [contextSourceId]: {
            type: "vector",
            url: mapTilerTilesUrl("v4", apiKey),
        },
        [terrainSourceId]: {
            type: "raster-dem",
            url: mapTilerTilesUrl("terrain-rgb-v2", apiKey),
            tileSize: 256,
        },
    };

    return {
        ...providerStyle,
        name: satelliteStyleName(mapStyle),
        sources,
        glyphs: mapTilerFontsUrl(apiKey),
        terrain: {
            source: terrainSourceId,
            // Enough depth to read mountains at Orbit's pitch without turning
            // the wallpaper into an exaggerated 3D relief map.
            exaggeration: 0.35,
        },
        layers: [
            ...imageryLayers(providerStyle),
            ...createSatelliteOverlayLayers(mapStyle),
        ],
        metadata: {
            ...styleMetadata(providerStyle.metadata),
            "wallpaper:satellite-variant": definition.variant,
            "wallpaper:satellite-appearance": definition.appearance,
        },
    };
}

export function createSatelliteOverlayLayers(
    mapStyle: SatelliteMapStyle,
): LayerSpecification[] {
    const definition = definitions[mapStyle];
    const hybrid = definition.variant === "hybrid";

    // The plain Satellite pair is deliberately just provider imagery. All
    // cartographic context belongs to the Hybrid pair.
    if (!hybrid) {
        return [];
    }

    const palette = labelPalette(definition.appearance);

    const layers: LayerSpecification[] = [
        lineLayer({
            id: "satellite-country-borders",
            sourceLayer: "country_border",
            minzoom: 0,
            color: palette.countryBorder,
            opacity: 0.66,
            width: [
                "interpolate",
                ["linear"],
                ["zoom"],
                0,
                0.45,
                6,
                0.85,
                12,
                1.15,
            ],
        }),
        lineLayer({
            id: "satellite-disputed-borders",
            sourceLayer: "country_border_disputed",
            minzoom: 2,
            color: palette.countryBorder,
            opacity: 0.48,
            width: 0.8,
            dasharray: [2, 2],
        }),
    ];

    layers.push(lineLayer({
        id: "satellite-regional-borders",
        sourceLayer: "sub_border",
        minzoom: 4,
        color: palette.regionalBorder,
        opacity: 0.3,
        width: 0.6,
        dasharray: [2, 3],
    }));

    layers.push(
        symbolLayer({
            id: "satellite-ocean-labels",
            sourceLayer: "water_centroid",
            minzoom: 0,
            maxzoom: 7,
            filter: [
                "match",
                ["get", "class"],
                ["ocean", "sea", "strait", "bay"],
                true,
                false,
            ],
            size: ["interpolate", ["linear"], ["zoom"], 0, 10, 5, 15],
            color: palette.water,
            halo: palette.halo,
            opacity: 0.76,
            italic: true,
            letterSpacing: 0.08,
        }),
        symbolLayer({
            id: "satellite-continent-labels",
            sourceLayer: "continent_label",
            minzoom: 0,
            maxzoom: 2.8,
            size: ["interpolate", ["linear"], ["zoom"], 0, 11, 2.8, 15],
            color: palette.country,
            halo: palette.halo,
            opacity: 0.72,
            uppercase: true,
            letterSpacing: 0.12,
        }),
        symbolLayer({
            id: "satellite-country-labels",
            sourceLayer: "country_label",
            minzoom: 0.8,
            maxzoom: 8,
            size: ["interpolate", ["linear"], ["zoom"], 1, 10, 4, 14, 7, 17],
            color: palette.country,
            halo: palette.halo,
            opacity: 0.9,
            uppercase: true,
            letterSpacing: 0.08,
        }),
    );

    layers.push(
        symbolLayer({
                id: "satellite-state-labels",
                sourceLayer: "state_label",
                minzoom: 3.5,
                maxzoom: 10,
                size: ["interpolate", ["linear"], ["zoom"], 4, 10, 9, 13],
                color: palette.secondary,
                halo: palette.halo,
                opacity: 0.72,
                uppercase: true,
                letterSpacing: 0.06,
            }),
            symbolLayer({
                id: "satellite-archipelago-labels",
                sourceLayer: "archipelago_label",
                minzoom: 3,
                maxzoom: 10,
                size: ["interpolate", ["linear"], ["zoom"], 3, 9, 8, 12],
                color: palette.secondary,
                halo: palette.halo,
                opacity: 0.68,
                italic: true,
            }),
            symbolLayer({
                id: "satellite-island-labels",
                sourceLayer: "island_label",
                minzoom: 5,
                maxzoom: 13,
                size: ["interpolate", ["linear"], ["zoom"], 5, 9, 11, 12],
                color: palette.secondary,
                halo: palette.halo,
                opacity: 0.7,
                italic: true,
        }),
    );

    layers.push(
        symbolLayer({
            id: "satellite-city-labels",
            sourceLayer: "city_label",
            minzoom: 2.5,
            maxzoom: 16,
            filter: ["<=", ["get", "rank"], hybrid ? 7 : 5],
            size: ["interpolate", ["linear"], ["zoom"], 3, 10, 7, 13, 13, 16],
            color: palette.city,
            halo: palette.halo,
            opacity: 0.92,
            sortByRank: true,
        }),
        symbolLayer({
            id: "satellite-town-labels",
            sourceLayer: "town_label",
            minzoom: hybrid ? 5.5 : 7,
            maxzoom: 16,
            filter: ["<=", ["get", "rank"], hybrid ? 9 : 6],
            size: ["interpolate", ["linear"], ["zoom"], 6, 9, 12, 12],
            color: palette.secondary,
            halo: palette.halo,
            opacity: hybrid ? 0.82 : 0.72,
            sortByRank: true,
        }),
    );

    layers.push(
        symbolLayer({
                id: "satellite-local-place-labels",
                sourceLayer: "place_label",
                minzoom: 9,
                maxzoom: 16,
                filter: [
                    "match",
                    ["get", "class"],
                    ["village", "hamlet"],
                    true,
                    false,
                ],
                size: ["interpolate", ["linear"], ["zoom"], 9, 9, 14, 11],
                color: palette.secondary,
                halo: palette.halo,
                opacity: 0.68,
                sortByRank: true,
            }),
            symbolLayer({
                id: "satellite-inland-water-labels",
                sourceLayer: "water_centroid",
                minzoom: 5,
                maxzoom: 16,
                filter: [
                    "match",
                    ["get", "class"],
                    ["lake", "reservoir", "river"],
                    true,
                    false,
                ],
                size: ["interpolate", ["linear"], ["zoom"], 5, 9, 13, 12],
                color: palette.water,
                halo: palette.halo,
                opacity: 0.7,
                italic: true,
                sortByRank: true,
            }),
            symbolLayer({
                id: "satellite-water-line-labels",
                sourceLayer: "water_label",
                minzoom: 6,
                maxzoom: 16,
                size: ["interpolate", ["linear"], ["zoom"], 6, 9, 14, 12],
                color: palette.water,
                halo: palette.halo,
                opacity: 0.64,
                italic: true,
                placement: "line",
        }),
    );

    return layers;
}

export function requireStyleSpecification(value: unknown): StyleSpecification {
    if (
        typeof value !== "object" ||
        value === null ||
        !("version" in value) ||
        value.version !== 8 ||
        !("sources" in value) ||
        typeof value.sources !== "object" ||
        value.sources === null ||
        !("layers" in value) ||
        !Array.isArray(value.layers)
    ) {
        throw new Error("Invalid map style data.");
    }

    return value as StyleSpecification;
}

function imageryLayers(style: StyleSpecification): LayerSpecification[] {
    const imagerySourceIds = new Set(
        Object.entries(style.sources)
            .filter(([, source]) =>
                source.type === "raster" || source.type === "raster-dem"
            )
            .map(([id]) => id),
    );

    return style.layers.filter((layer) => {
        if (layer.type === "background") {
            return true;
        }

        return "source" in layer &&
            typeof layer.source === "string" &&
            imagerySourceIds.has(layer.source);
    });
}

function styleMetadata(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null
        ? value as Record<string, unknown>
        : {};
}

interface LineLayerOptions {
    readonly id: string;
    readonly sourceLayer: string;
    readonly minzoom: number;
    readonly color: string;
    readonly opacity: number;
    readonly width: number | unknown[];
    readonly dasharray?: number[];
}

function lineLayer(options: LineLayerOptions): LayerSpecification {
    return {
        id: options.id,
        type: "line",
        source: contextSourceId,
        "source-layer": options.sourceLayer,
        minzoom: options.minzoom,
        layout: {
            "line-cap": "round",
            "line-join": "round",
        },
        paint: {
            "line-color": options.color,
            "line-opacity": options.opacity,
            "line-width": options.width,
            ...(options.dasharray === undefined
                ? {}
                : { "line-dasharray": options.dasharray }),
        },
    } as LayerSpecification;
}

interface SymbolLayerOptions {
    readonly id: string;
    readonly sourceLayer: string;
    readonly minzoom: number;
    readonly maxzoom: number;
    readonly size: number | unknown[];
    readonly color: string;
    readonly halo: string;
    readonly opacity: number;
    readonly filter?: unknown[];
    readonly uppercase?: boolean;
    readonly italic?: boolean;
    readonly letterSpacing?: number;
    readonly sortByRank?: boolean;
    readonly placement?: "point" | "line";
}

function symbolLayer(options: SymbolLayerOptions): LayerSpecification {
    return {
        id: options.id,
        type: "symbol",
        source: contextSourceId,
        "source-layer": options.sourceLayer,
        minzoom: options.minzoom,
        maxzoom: options.maxzoom,
        ...(options.filter === undefined ? {} : { filter: options.filter }),
        layout: {
            "symbol-placement": options.placement ?? "point",
            "symbol-spacing": options.placement === "line" ? 450 : 250,
            "symbol-sort-key": options.sortByRank
                ? ["coalesce", ["get", "rank"], 99]
                : 0,
            "text-field": [
                "coalesce",
                ["get", "name:en"],
                ["get", "name"],
            ],
            "text-font": [
                options.italic ? "Noto Sans Italic" : "Noto Sans Regular",
            ],
            "text-size": options.size,
            "text-letter-spacing": options.letterSpacing ?? 0.02,
            "text-max-width": 9,
            "text-padding": 8,
            "text-rotation-alignment": options.placement === "line"
                ? "map"
                : "viewport",
            "text-transform": options.uppercase ? "uppercase" : "none",
        },
        paint: {
            "text-color": options.color,
            "text-opacity": options.opacity,
            "text-halo-color": options.halo,
            "text-halo-width": 1.25,
            "text-halo-blur": 0.45,
        },
    } as LayerSpecification;
}

function labelPalette(appearance: "light" | "dark"): {
    readonly country: string;
    readonly city: string;
    readonly secondary: string;
    readonly water: string;
    readonly halo: string;
    readonly countryBorder: string;
    readonly regionalBorder: string;
} {
    return appearance === "dark"
        ? {
            country: "#e8edf0",
            city: "#f3eee3",
            secondary: "#cbd3d6",
            water: "#b8cfdb",
            halo: "rgba(3, 7, 11, 0.92)",
            countryBorder: "rgba(219, 228, 231, 0.72)",
            regionalBorder: "rgba(190, 202, 207, 0.5)",
        }
        : {
            country: "#fff8ec",
            city: "#fff4df",
            secondary: "#eee8dc",
            water: "#d8edf3",
            halo: "rgba(17, 22, 23, 0.88)",
            countryBorder: "rgba(250, 244, 229, 0.72)",
            regionalBorder: "rgba(238, 234, 222, 0.5)",
        };
}

function mapTilerTilesUrl(tilesetId: string, apiKey: string): string {
    const url = new URL(
        `https://api.maptiler.com/tiles/${tilesetId}/tiles.json`,
    );
    url.searchParams.set("key", apiKey);
    return url.href;
}

function mapTilerFontsUrl(apiKey: string): string {
    // Do not pass the path through URL: it percent-encodes MapLibre's required
    // template tokens into %7Bfontstack%7D and %7Brange%7D.
    return "https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=" +
        encodeURIComponent(apiKey);
}

function satelliteStyleName(mapStyle: SatelliteMapStyle): string {
    return mapStyle
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

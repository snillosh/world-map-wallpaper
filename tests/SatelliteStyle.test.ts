import assert from "node:assert/strict";
import { test } from "node:test";

import type { StyleSpecification } from "maplibre-gl";

import {
    buildSatelliteStyle,
    createSatelliteOverlayLayers,
    getMapTilerStyleUrl,
    loadSatelliteStyle,
    MapTilerConfigurationError,
    normalizeMapTilerApiKey,
    satelliteMapStyles,
} from "../src/map/SatelliteStyle";
import {
    defaultWallpaperSettings,
    mapStyles,
    mergeSettings,
    migrateStoredSettings,
    validateSettingsPatch,
} from "../src/models/WallpaperSettings";

const providerStyle: StyleSpecification = {
    version: 8,
    name: "Provider satellite",
    sources: {
        imagery: {
            type: "raster",
            tiles: ["https://example.test/{z}/{x}/{y}.jpg"],
        },
        providerContext: {
            type: "vector",
            tiles: ["https://example.test/{z}/{x}/{y}.pbf"],
        },
    },
    layers: [
        { id: "background", type: "background" },
        { id: "imagery", type: "raster", source: "imagery" },
        {
            id: "provider-road",
            type: "line",
            source: "providerContext",
            "source-layer": "road",
        },
        {
            id: "provider-poi",
            type: "symbol",
            source: "providerContext",
            "source-layer": "poi_shopping",
        },
    ],
};

test("registers and validates all four satellite style IDs", () => {
    for (const mapStyle of satelliteMapStyles) {
        assert.ok(mapStyles.includes(mapStyle));
        assert.deepEqual(
            validateSettingsPatch({ visual: { mapStyle } }),
            { visual: { mapStyle } },
        );
    }
});

test("persisted settings restore every satellite style", () => {
    for (const mapStyle of satelliteMapStyles) {
        const restored = migrateStoredSettings({ visual: { mapStyle } });
        assert.equal(restored.visual.mapStyle, mapStyle);
    }
});

test("behaviour and visual style settings remain independent", () => {
    const satelliteExplore = mergeSettings(defaultWallpaperSettings, {
        behaviourMode: "explore",
        visual: { mapStyle: "satellite-hybrid-dark" },
    });
    const changedStyle = mergeSettings(satelliteExplore, {
        visual: { mapStyle: "satellite-light" },
    });
    const changedMode = mergeSettings(changedStyle, {
        behaviourMode: "orbit",
    });

    assert.equal(changedStyle.behaviourMode, "explore");
    assert.equal(changedMode.visual.mapStyle, "satellite-light");
});

test("uses MapTiler's current provider style IDs and substitutes the API key", () => {
    const expectedStyleIds = new Map([
        ["satellite-light", "satellite-v4"],
        ["satellite-dark", "satellite-v4-dark"],
        ["satellite-hybrid-light", "hybrid-v4"],
        ["satellite-hybrid-dark", "hybrid-v4-dark"],
    ]);

    for (const mapStyle of satelliteMapStyles) {
        const url = new URL(getMapTilerStyleUrl(mapStyle, "key with spaces"));
        assert.equal(
            url.pathname,
            `/maps/${expectedStyleIds.get(mapStyle)}/style.json`,
        );
        assert.equal(url.searchParams.get("key"), "key with spaces");
    }
});

test("missing MapTiler configuration fails before any network request", async () => {
    let fetches = 0;

    await assert.rejects(
        loadSatelliteStyle(
            "satellite-light",
            normalizeMapTilerApiKey("   "),
            async () => {
                fetches += 1;
                throw new Error("should not fetch");
            },
        ),
        MapTilerConfigurationError,
    );
    assert.equal(fetches, 0);
});

test("an invalid or restricted MapTiler key produces a useful error", async () => {
    await assert.rejects(
        loadSatelliteStyle(
            "satellite-dark",
            "invalid-key",
            async () => ({
                ok: false,
                status: 403,
                json: async () => ({}),
            }),
        ),
        /HTTP 403.*allowed URL restrictions/,
    );
});

test("generated styles retain provider imagery but discard provider clutter", () => {
    for (const mapStyle of satelliteMapStyles) {
        const style = buildSatelliteStyle(
            providerStyle,
            mapStyle,
            "test key/+",
        );
        const layerIds = style.layers.map((layer) => layer.id);

        assert.ok(layerIds.includes("background"));
        assert.ok(layerIds.includes("imagery"));
        assert.ok(!layerIds.includes("provider-road"));
        assert.ok(!layerIds.includes("provider-poi"));
        assert.equal(style.terrain?.source, "wallpaper-satellite-terrain");
        assert.ok(style.sources["wallpaper-satellite-context"]);
        assert.equal(
            style.glyphs,
            "https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=" +
            "test%20key%2F%2B",
        );
    }
});

test("satellite overlays contain no roads, street names, POIs, or city glow", () => {
    for (const mapStyle of satelliteMapStyles) {
        const layers = createSatelliteOverlayLayers(mapStyle);
        const searchable = layers
            .flatMap((layer) => [
                layer.id,
                "source-layer" in layer ? layer["source-layer"] : "",
            ])
            .join(" ")
            .toLowerCase();

        assert.doesNotMatch(
            searchable,
            /\b(road|highway|street|transport|transit|poi|shop|glow)/,
        );
    }
});

test("plain styles have no overlays and hybrids add only geographic context", () => {
    for (const appearance of ["light", "dark"] as const) {
        const minimal = createSatelliteOverlayLayers(`satellite-${appearance}`);
        const hybrid = createSatelliteOverlayLayers(
            `satellite-hybrid-${appearance}`,
        );

        assert.deepEqual(minimal, []);
        assert.ok(hybrid.length > 0);
        assert.ok(!hybrid.some((layer) => layer.id.includes("road")));
        assert.ok(hybrid.some((layer) => layer.id === "satellite-state-labels"));
        assert.ok(
            hybrid.some((layer) => layer.id === "satellite-regional-borders"),
        );
    }
});

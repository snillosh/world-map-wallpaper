import assert from "node:assert/strict";
import { test } from "node:test";

import type { Country } from "../src/models/Country";
import {
    defaultWallpaperSettings,
    migrateStoredSettings,
    normalizeDestinationSettings,
} from "../src/models/WallpaperSettings";

const countries: readonly Country[] = [
    { iso2: "FR", name: "France", continent: "Europe" },
    { iso2: "JP", name: "Japan", continent: "Asia" },
    {
        iso2: "GB",
        name: "Scotland",
        continent: "Europe",
        destinationId: "GB-SCT",
        admin1Code: "SCT",
    },
];

test("migrates Flight-owned destination settings into shared destinations", () => {
    const legacy = {
        behaviourMode: "flight",
        visual: defaultWallpaperSettings.visual,
        performance: defaultWallpaperSettings.performance,
        flight: {
            ...defaultWallpaperSettings.flight,
            continent: null,
            countryIso2: "FR",
        },
        orbit: defaultWallpaperSettings.orbit,
    };
    const migrated = migrateStoredSettings(legacy);

    assert.equal(migrated.destinations.continent, null);
    assert.equal(migrated.destinations.countryIso2, "FR");
    assert.deepEqual(migrated.explore, defaultWallpaperSettings.explore);
});

test("changing Worldwide and Japan to Europe resets Country", () => {
    const settings = normalizeDestinationSettings({
        ...defaultWallpaperSettings,
        destinations: { continent: "Europe", countryIso2: "JP" },
    }, countries);

    assert.equal(settings.destinations.continent, "Europe");
    assert.equal(settings.destinations.countryIso2, null);
});

test("changing Worldwide and France to Europe keeps France", () => {
    const settings = normalizeDestinationSettings({
        ...defaultWallpaperSettings,
        destinations: { continent: "Europe", countryIso2: "FR" },
    }, countries);

    assert.equal(settings.destinations.countryIso2, "FR");
});

test("Worldwide permits known countries and rejects unknown country codes", () => {
    const japan = normalizeDestinationSettings({
        ...defaultWallpaperSettings,
        destinations: { continent: null, countryIso2: "JP" },
    }, countries);
    const unknown = normalizeDestinationSettings({
        ...japan,
        destinations: { ...japan.destinations, countryIso2: "ZZ" },
    }, countries);

    assert.equal(japan.destinations.countryIso2, "JP");
    assert.equal(unknown.destinations.countryIso2, null);
});

test("restores persisted Explore settings", () => {
    const restored = migrateStoredSettings({
        explore: {
            zoomedOutLevel: 2.5,
            zoomedInLevel: 9,
            zoomInDurationSeconds: 12,
            viewDurationSeconds: 7,
            zoomOutDurationSeconds: 5,
        },
    });

    assert.deepEqual(restored.explore, {
        zoomedOutLevel: 2.5,
        zoomedInLevel: 9,
        zoomInDurationSeconds: 12,
        viewDurationSeconds: 7,
        zoomOutDurationSeconds: 5,
    });
});

test("accepts the extended Explore zoom ranges", () => {
    const restored = migrateStoredSettings({
        explore: {
            ...defaultWallpaperSettings.explore,
            zoomedOutLevel: 8,
            zoomedInLevel: 16,
        },
    });

    assert.equal(restored.explore.zoomedOutLevel, 8);
    assert.equal(restored.explore.zoomedInLevel, 16);
});

test("restores and normalizes a UK home-nation destination", () => {
    const restored = migrateStoredSettings({
        destinations: { continent: "Europe", countryIso2: "GB-SCT" },
    });
    const normalized = normalizeDestinationSettings(restored, countries);

    assert.equal(normalized.destinations.countryIso2, "GB-SCT");
});

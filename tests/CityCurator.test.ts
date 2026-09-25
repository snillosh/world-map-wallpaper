import assert from "node:assert/strict";
import { test } from "node:test";

import type { City } from "../src/models/City";
import {
    defaultCurationConfig,
    selectCitiesForCountry,
} from "../scripts/city-data/CityCurator";

test("retains national and first-order administrative capitals", () => {
    const cities = [
        createCity(1, "National capital", 0, 0, 10, "primary"),
        createCity(2, "Admin capital", 0, 1, 10, "admin"),
        createCity(3, "Large city", 0, 2, 5_000_000),
        createCity(4, "Second city", 0, 3, 4_000_000),
    ];

    const selected = selectCitiesForCountry(cities, config({ maximumPerCountry: 3 }));

    assert.ok(selected.some((city) => city.id === 1));
    assert.ok(selected.some((city) => city.id === 2));
});

test("respects the country maximum and keeps major cities strongly represented", () => {
    const cities = Array.from({ length: 20 }, (_, index) =>
        createCity(index + 1, `City ${index + 1}`, 0, index, 1_000_000 - index * 25_000));

    const selected = selectCitiesForCountry(cities, config({ maximumPerCountry: 5 }));

    assert.equal(selected.length, 5);
    assert.ok(selected.some((city) => city.id === 1));
});

test("countries below the maximum retain every useful candidate", () => {
    const cities = [
        createCity(1, "One", 0, 0, 50_000),
        createCity(2, "Two", 1, 1, 25_000),
    ];

    assert.deepEqual(
        selectCitiesForCountry(cities).map((city) => city.id).sort(),
        [1, 2],
    );
});

test("geographic diversity can select a substantial remote city", () => {
    const cities = [
        createCity(1, "Capital", 0, 0, 1_000_000, "primary"),
        createCity(2, "Nearby one", 0, 0.1, 900_000),
        createCity(3, "Nearby two", 0, 0.2, 850_000),
        createCity(4, "Remote", 20, 20, 300_000),
    ];

    const selected = selectCitiesForCountry(cities, config({
        maximumPerCountry: 3,
        protectedMajorCityShare: 0,
        maximumProtectedMajorCities: 0,
    }));

    assert.ok(selected.some((city) => city.id === 4));
});

test("distance alone does not let a tiny remote place beat a major city", () => {
    const cities = [
        createCity(1, "Capital", 0, 0, 1_000_000, "primary"),
        createCity(2, "Major", 0, 1, 900_000),
        createCity(3, "Tiny remote", 30, 30, 500),
    ];

    const selected = selectCitiesForCountry(cities, config({
        maximumPerCountry: 2,
        protectedMajorCityShare: 0,
        maximumProtectedMajorCities: 0,
    }));

    assert.deepEqual(selected.map((city) => city.id), [1, 2]);
});

function config(
    overrides: Partial<typeof defaultCurationConfig>,
): typeof defaultCurationConfig {
    return { ...defaultCurationConfig, ...overrides };
}

function createCity(
    id: number,
    city: string,
    lat: number,
    lng: number,
    population: number,
    capital: City["capital"] = "",
): City {
    return {
        id,
        city,
        country: "Testland",
        iso2: "TS",
        continent: "Europe",
        admin1Code: "",
        lat,
        lng,
        population,
        capital,
        featureCode: capital === "primary" ? "PPLC" : "PPL",
        timezone: "Etc/UTC",
    };
}

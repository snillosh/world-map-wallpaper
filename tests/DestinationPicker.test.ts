import assert from "node:assert/strict";
import { test } from "node:test";

import type { City } from "../src/models/City";
import { DestinationPicker } from "../src/services/DestinationPicker";

test("chooses short, medium, and long distance bands from the configured mix", () => {
    const current = createCity(1, "Origin", 0, 0);
    const short = createCity(2, "Short", 0, 5);
    const medium = createCity(3, "Medium", 0, 30);
    const long = createCity(4, "Long", 0, 100);

    assert.equal(pickNext([0.1, 0], current, [short, medium, long]), short);
    assert.equal(pickNext([0.6, 0], current, [short, medium, long]), medium);
    assert.equal(pickNext([0.9, 0], current, [short, medium, long]), long);
});

test("scales distance bands for a geographically small filtered pool", () => {
    const current = createCity(1, "Origin", 51.5, -0.1);
    const local = createCity(2, "Local", 51.6, -0.1);
    const regional = createCity(3, "Regional", 53.5, -1.5);
    const far = createCity(4, "Far", 57.1, -2.1);

    assert.equal(pickNext([0.1, 0], current, [local, regional, far]), local);
    assert.equal(pickNext([0.6, 0], current, [local, regional, far]), regional);
    assert.equal(pickNext([0.9, 0], current, [local, regional, far]), far);
});

test("avoids recently visited cities until the pool needs to relax", () => {
    const cities = [
        createCity(1, "A", 0, 0),
        createCity(2, "B", 0, 1),
        createCity(3, "C", 0, 2),
    ];
    const picker = new DestinationPicker(cities, {
        random: sequenceRandom([0, 0, 0, 0, 0, 0]),
        recentCityLimit: 2,
    });

    const first = picker.pickInitialCity();
    const second = picker.pickNextCity(first);
    const third = picker.pickNextCity(second);

    assert.equal(first.city, "A");
    assert.equal(second.city, "B");
    assert.equal(third.city, "C");
});

test("falls back gracefully when the requested distance band is empty", () => {
    const current = createCity(1, "Origin", 0, 0);
    const nearby = createCity(2, "Nearby", 0, 0);
    const picker = new DestinationPicker([current, nearby], {
        random: sequenceRandom([0.99, 0]),
    });

    assert.equal(picker.pickNextCity(current), nearby);
});

test("uses stable ids rather than object identity to exclude the current city", () => {
    const storedCurrent = createCity(1, "Origin", 0, 0);
    const duplicateObject = { ...storedCurrent };
    const destination = createCity(2, "Destination", 0, 10);
    const picker = new DestinationPicker([storedCurrent, destination], {
        random: sequenceRandom([0, 0]),
    });

    assert.equal(picker.pickNextCity(duplicateObject), destination);
});

test("population influences a choice without excluding a smaller city", () => {
    const current = createCity(1, "Origin", 0, 0);
    const smaller = createCity(2, "Smaller", 0, 10, 5_000);
    const larger = createCity(3, "Larger", 0, 11, 1_000_000);

    assert.equal(pickNext([0, 0.3], current, [smaller, larger]), larger);
    assert.equal(pickNext([0, 0], current, [smaller, larger]), smaller);
});

test("capital status gives an otherwise equal destination a useful bonus", () => {
    const current = createCity(1, "Origin", 0, 0);
    const ordinary = createCity(2, "Ordinary", 0, 10);
    const capital = {
        ...createCity(3, "Capital", 0, 11),
        capital: "primary" as const,
        featureCode: "PPLC",
    };

    assert.equal(pickNext([0, 0.45], current, [ordinary, capital]), capital);
});

test("discourages an adjacent metro record from becoming a trivial flight", () => {
    const current = createCity(1, "Metro centre", 0, 0, 10_000_000);
    const adjacent = createCity(2, "Adjacent district", 0, 0.01, 10_000_000);
    const regional = createCity(3, "Regional city", 0, 1, 100_000);
    const distant = createCity(4, "Distant city", 0, 4, 100_000);

    assert.equal(
        pickNext([0, 0.5], current, [adjacent, regional, distant]),
        regional,
    );
});

function pickNext(
    randomValues: readonly number[],
    current: City,
    destinations: readonly City[],
): City {
    return new DestinationPicker([current, ...destinations], {
        random: sequenceRandom(randomValues),
    }).pickNextCity(current);
}

function sequenceRandom(values: readonly number[]): () => number {
    let index = 0;
    return () => values[Math.min(index++, values.length - 1)];
}

function createCity(
    id: number,
    city: string,
    lat: number,
    lng: number,
    population = 100_000,
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
        capital: "",
        featureCode: "PPL",
        timezone: "Etc/UTC",
    };
}

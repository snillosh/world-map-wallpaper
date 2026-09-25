import assert from "node:assert/strict";
import { test } from "node:test";

import type { City } from "../src/models/City";
import { ExploreDestinationPicker } from "../src/services/ExploreDestinationPicker";

test("normally chooses from the nearest regional candidates", () => {
    const current = city(1, "Current", 0);
    const destinations = [
        city(2, "Nearby", 1),
        ...Array.from({ length: 13 }, (_, index) =>
            city(index + 3, `Far ${index}`, 20 + index * 5)),
    ];
    const picker = new ExploreDestinationPicker([current, ...destinations], {
        random: sequenceRandom([0.9, 0]),
    });

    assert.equal(picker.pickNextCity(current).city, "Nearby");
});

test("can deliberately choose an occasional long relocation", () => {
    const current = city(1, "Current", 0);
    const destinations = Array.from({ length: 14 }, (_, index) =>
        city(index + 2, `Destination ${index}`, 1 + index * 8));
    const picker = new ExploreDestinationPicker([current, ...destinations], {
        random: sequenceRandom([0.1, 0]),
    });

    assert.ok(picker.pickNextCity(current).lng >= 97);
});

test("recent destinations are excluded until a small pool must relax", () => {
    const cities = [city(1, "A", 0), city(2, "B", 1), city(3, "C", 2)];
    const picker = new ExploreDestinationPicker(cities, {
        random: sequenceRandom([0, 0.9, 0, 0.9, 0]),
        recentCityLimit: 2,
    });

    const first = picker.pickInitialCity();
    const second = picker.pickNextCity(first);
    const third = picker.pickNextCity(second);

    assert.deepEqual([first.city, second.city, third.city], ["A", "B", "C"]);
});

function sequenceRandom(values: readonly number[]): () => number {
    let index = 0;
    return () => values[Math.min(index++, values.length - 1)];
}

function city(id: number, name: string, lng: number): City {
    return {
        id,
        city: name,
        country: "Testland",
        iso2: "TS",
        continent: "Europe",
        admin1Code: "",
        lat: 0,
        lng,
        population: 100_000,
        capital: "",
        featureCode: "PPL",
        timezone: "Etc/UTC",
    };
}

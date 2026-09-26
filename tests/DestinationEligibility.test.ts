import assert from "node:assert/strict";
import { test } from "node:test";

import type { City } from "../src/models/City";
import { DestinationEligibility } from "../src/services/DestinationEligibility";
import { DestinationPicker } from "../src/services/DestinationPicker";

const cities: readonly City[] = [
    createCity("Paris", "France", "FR", 2_100_000),
    createCity("Lyon", "France", "FR", 520_000),
    createCity("London", "United Kingdom", "GB", 9_000_000, "Europe", "ENG"),
    createCity("Manchester", "United Kingdom", "GB", 550_000, "Europe", "ENG"),
    createCity("Smallville", "United Kingdom", "GB", 100_000, "Europe", "ENG"),
    createCity("Edinburgh", "United Kingdom", "GB", 515_000, "Europe", "SCT"),
    createCity("Glasgow", "United Kingdom", "GB", 626_000, "Europe", "SCT"),
    createCity("Cardiff", "United Kingdom", "GB", 372_000, "Europe", "WLS"),
    createCity("Swansea", "United Kingdom", "GB", 300_000, "Europe", "WLS"),
    createCity("Tokyo", "Japan", "JP", 14_000_000, "Asia"),
    createCity("Osaka", "Japan", "JP", 2_750_000, "Asia"),
];

const eligibility = new DestinationEligibility();

test("Worldwide returns the normal population-eligible pool", () => {
    const eligible = eligibility.filter(cities, {
        continent: null,
        countryIso2: null,
        minimumPopulation: 250_000,
    });

    assert.deepEqual(
        eligible.map((city) => city.city),
        [
            "Paris",
            "Lyon",
            "London",
            "Manchester",
            "Edinburgh",
            "Glasgow",
            "Cardiff",
            "Swansea",
            "Tokyo",
            "Osaka",
        ],
    );
});

test("FR only returns French cities", () => {
    const eligible = eligibility.filter(cities, {
        continent: null,
        countryIso2: "FR",
        minimumPopulation: 250_000,
    });

    assert.ok(eligible.every((city) => city.iso2 === "FR"));
    assert.deepEqual(eligible.map((city) => city.city), ["Paris", "Lyon"]);
});

test("GB only returns British cities", () => {
    const eligible = eligibility.filter(cities, {
        continent: null,
        countryIso2: "GB",
        minimumPopulation: 250_000,
    });

    assert.ok(eligible.every((city) => city.iso2 === "GB"));
    assert.deepEqual(
        eligible.map((city) => city.city),
        ["London", "Manchester", "Edinburgh", "Glasgow", "Cardiff", "Swansea"],
    );
});

test("GB-SCT and GB-WLS select their home nations independently", () => {
    const scotland = eligibility.filter(cities, {
        continent: "Europe",
        countryIso2: "GB-SCT",
        minimumPopulation: 250_000,
    });
    const wales = eligibility.filter(cities, {
        continent: "Europe",
        countryIso2: "GB-WLS",
        minimumPopulation: 250_000,
    });

    assert.deepEqual(scotland.map((city) => city.city), ["Edinburgh", "Glasgow"]);
    assert.deepEqual(wales.map((city) => city.city), ["Cardiff", "Swansea"]);
});

test("country and minimum population constraints compose", () => {
    const eligible = eligibility.filter(cities, {
        continent: "Europe",
        countryIso2: "FR",
        minimumPopulation: 1_000_000,
    });

    assert.deepEqual(eligible.map((city) => city.city), ["Paris"]);
});

test("filtering does not mutate the complete city collection", () => {
    const before = [...cities];

    const eligible = eligibility.filter(cities, {
        continent: null,
        countryIso2: "FR",
        minimumPopulation: 250_000,
    });

    assert.deepEqual(cities, before);
    assert.notEqual(eligible, cities);
});

test("DestinationPicker receives and returns only eligible cities", () => {
    const eligible = eligibility.filter(cities, {
        continent: null,
        countryIso2: "FR",
        minimumPopulation: 250_000,
    });
    const picker = new DestinationPicker(eligible);

    const destination = picker.pickNextCity(cities[2]);

    assert.equal(destination.iso2, "FR");
});

test("DestinationPicker rejects a pool that cannot form a route", () => {
    assert.throws(
        () => new DestinationPicker([cities[0]]),
        /at least two eligible cities/,
    );
});

test("Europe with All Countries returns only European cities", () => {
    const eligible = eligibility.filter(cities, {
        continent: "Europe",
        countryIso2: null,
        minimumPopulation: 250_000,
    });

    assert.ok(eligible.every((city) => city.continent === "Europe"));
    assert.deepEqual(
        eligible.map((city) => city.city),
        [
            "Paris",
            "Lyon",
            "London",
            "Manchester",
            "Edinburgh",
            "Glasgow",
            "Cardiff",
            "Swansea",
        ],
    );
});

test("Asia with All Countries returns only Asian cities", () => {
    const eligible = eligibility.filter(cities, {
        continent: "Asia",
        countryIso2: null,
        minimumPopulation: 250_000,
    });

    assert.deepEqual(eligible.map((city) => city.city), ["Tokyo", "Osaka"]);
});

test("Worldwide and Japan composes country and population constraints", () => {
    const eligible = eligibility.filter(cities, {
        continent: null,
        countryIso2: "JP",
        minimumPopulation: 3_000_000,
    });

    assert.deepEqual(eligible.map((city) => city.city), ["Tokyo"]);
});

function createCity(
    city: string,
    country: string,
    iso2: string,
    population: number,
    continent: City["continent"] = "Europe",
    admin1Code = "",
): City {
    return {
        id: Math.round(population + city.length),
        city,
        country,
        iso2,
        continent,
        admin1Code,
        population,
        lat: 0,
        lng: 0,
        capital: "",
        featureCode: "PPL",
        timezone: "Europe/London",
    };
}

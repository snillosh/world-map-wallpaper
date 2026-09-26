import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import type { City } from "../src/models/City";
import type { Country } from "../src/models/Country";

interface GeneratedMetadata {
    readonly selectedCityCount: number;
    readonly countryCount: number;
    readonly destinationCount: number;
    readonly curationGroupCount: number;
    readonly maximumPerCountry: number;
}

const cities = JSON.parse(
    readFileSync(new URL("../cities.json", import.meta.url), "utf8"),
) as City[];
const metadata = JSON.parse(
    readFileSync(new URL("../cities.metadata.json", import.meta.url), "utf8"),
) as GeneratedMetadata;
const countries = JSON.parse(
    readFileSync(new URL("../countries.json", import.meta.url), "utf8"),
) as Country[];

test("generated runtime data matches its metadata and country cap", () => {
    const citiesByCountry = Map.groupBy(cities, (city) => city.iso2);
    const citiesByCurationGroup = Map.groupBy(cities, (city) =>
        city.iso2 === "GB" && ["ENG", "NIR", "SCT", "WLS"].includes(
            city.admin1Code,
        )
            ? `${city.iso2}-${city.admin1Code}`
            : city.iso2
    );
    const baseCountries = countries.filter(
        (country) => country.destinationId === undefined,
    );

    assert.equal(cities.length, metadata.selectedCityCount);
    assert.equal(citiesByCountry.size, metadata.countryCount);
    assert.equal(baseCountries.length, metadata.countryCount);
    assert.equal(countries.length, metadata.destinationCount);
    assert.equal(citiesByCurationGroup.size, metadata.curationGroupCount);
    assert.ok(
        [...citiesByCurationGroup.values()].every(
            (countryCities) => countryCities.length <= metadata.maximumPerCountry,
        ),
    );
    assert.equal(new Set(cities.map((city) => city.id)).size, cities.length);
    assert.deepEqual(
        baseCountries.map((country) => country.iso2).toSorted(),
        [...citiesByCountry.keys()].toSorted(),
    );
    assert.equal(
        new Set(
            countries.map((country) => country.destinationId ?? country.iso2),
        ).size,
        countries.length,
    );
});

test("UK home nations are independently curated destination options", () => {
    const expected = new Map([
        ["GB-ENG", "England"],
        ["GB-NIR", "Northern Ireland"],
        ["GB-SCT", "Scotland"],
        ["GB-WLS", "Wales"],
    ]);

    for (const [destinationId, name] of expected) {
        const option = countries.find(
            (country) => country.destinationId === destinationId,
        );
        const admin1Code = destinationId.slice(3);
        const nationCities = cities.filter(
            (city) => city.iso2 === "GB" && city.admin1Code === admin1Code,
        );

        assert.equal(option?.name, name);
        assert.equal(option?.continent, "Europe");
        assert.ok(nationCities.length >= 40);
        assert.ok(nationCities.length <= metadata.maximumPerCountry);
    }
});

test("generated runtime records contain the enriched fields Flight needs", () => {
    assert.ok(cities.every((city) => Number.isSafeInteger(city.id)));
    assert.ok(cities.every((city) => /^[A-Z]{2}$/.test(city.iso2)));
    assert.ok(cities.every((city) => city.country.length > 0));
    assert.ok(cities.every((city) => city.continent.length > 0));
    assert.ok(cities.every((city) => Number.isFinite(city.lat)));
    assert.ok(cities.every((city) => Number.isFinite(city.lng)));
    assert.ok(cities.every((city) => city.population >= 0));
    assert.ok(cities.every((city) => city.featureCode.length > 0));
    assert.ok(cities.every((city) => city.timezone.length > 0));
});

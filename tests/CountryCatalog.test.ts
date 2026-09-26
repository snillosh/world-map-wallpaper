import assert from "node:assert/strict";
import { test } from "node:test";

import type { Country } from "../src/models/Country";
import {
    filterCountryOptions,
    getCountryDestinationId,
} from "../src/services/CountryCatalog";

const countries: readonly Country[] = [
    { iso2: "FR", name: "France", continent: "Europe" },
    { iso2: "JP", name: "Japan", continent: "Asia" },
    { iso2: "GB", name: "United Kingdom", continent: "Europe" },
    {
        iso2: "GB",
        name: "Scotland",
        continent: "Europe",
        destinationId: "GB-SCT",
        admin1Code: "SCT",
    },
    { iso2: "US", name: "United States", continent: "North America" },
];

test("Worldwide exposes every country in the generated catalogue", () => {
    assert.deepEqual(filterCountryOptions(countries, null), countries);
});

test("country options only contain countries in the selected continent", () => {
    assert.deepEqual(filterCountryOptions(countries, "Europe"), [
        { iso2: "FR", name: "France", continent: "Europe" },
        { iso2: "GB", name: "United Kingdom", continent: "Europe" },
        {
            iso2: "GB",
            name: "Scotland",
            continent: "Europe",
            destinationId: "GB-SCT",
            admin1Code: "SCT",
        },
    ]);
    assert.deepEqual(filterCountryOptions(countries, "Asia"), [
        { iso2: "JP", name: "Japan", continent: "Asia" },
    ]);
});

test("home nations use their subdivision destination IDs", () => {
    assert.equal(getCountryDestinationId(countries[2]), "GB");
    assert.equal(getCountryDestinationId(countries[3]), "GB-SCT");
});

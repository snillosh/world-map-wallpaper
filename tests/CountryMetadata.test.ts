import assert from "node:assert/strict";
import { test } from "node:test";

import { getCountryMetadata } from "../scripts/city-data/CountryMetadata";

test("provides stable country names and continent metadata", () => {
    assert.deepEqual(getCountryMetadata("FR"), {
        iso2: "FR",
        name: "France",
        continent: "Europe",
    });
    assert.equal(getCountryMetadata("US")?.continent, "North America");
    assert.equal(getCountryMetadata("BR")?.continent, "South America");
    assert.equal(getCountryMetadata("AU")?.continent, "Oceania");
    assert.equal(getCountryMetadata("ZA")?.continent, "Africa");
    assert.equal(getCountryMetadata("JP")?.continent, "Asia");
    assert.equal(getCountryMetadata("AQ")?.continent, "Antarctica");
    assert.equal(getCountryMetadata("ZZ"), undefined);
});

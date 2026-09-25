import assert from "node:assert/strict";
import { test } from "node:test";

import { parseGeoNamesLine } from "../scripts/city-data/GeoNamesParser";

test("parses the documented tab-separated GeoNames fields", () => {
    const record = parseGeoNamesLine(geoNamesLine({
        id: "2643743",
        name: "London",
        latitude: "51.50853",
        longitude: "-0.12574",
        featureCode: "PPLC",
        countryCode: "GB",
        admin1Code: "ENG",
        population: "8961989",
        timezone: "Europe/London",
    }));

    assert.deepEqual(record, {
        geonameId: 2_643_743,
        name: "London",
        asciiName: "London",
        latitude: 51.50853,
        longitude: -0.12574,
        featureClass: "P",
        featureCode: "PPLC",
        countryCode: "GB",
        admin1Code: "ENG",
        population: 8_961_989,
        timezone: "Europe/London",
    });
});

test("rejects malformed, non-populated-place, and invalid coordinate rows", () => {
    assert.equal(parseGeoNamesLine("not\ta\tcomplete\trow"), null);
    assert.equal(parseGeoNamesLine(geoNamesLine({ featureClass: "A" })), null);
    assert.equal(parseGeoNamesLine(geoNamesLine({ latitude: "100" })), null);
    assert.equal(parseGeoNamesLine(geoNamesLine({ population: "unknown" })), null);
});

interface GeoNamesLineOverrides {
    readonly id?: string;
    readonly name?: string;
    readonly latitude?: string;
    readonly longitude?: string;
    readonly featureClass?: string;
    readonly featureCode?: string;
    readonly countryCode?: string;
    readonly admin1Code?: string;
    readonly population?: string;
    readonly timezone?: string;
}

function geoNamesLine(overrides: GeoNamesLineOverrides = {}): string {
    return [
        overrides.id ?? "1",
        overrides.name ?? "Example",
        overrides.name ?? "Example",
        "",
        overrides.latitude ?? "10",
        overrides.longitude ?? "20",
        overrides.featureClass ?? "P",
        overrides.featureCode ?? "PPL",
        overrides.countryCode ?? "FR",
        "",
        overrides.admin1Code ?? "11",
        "",
        "",
        "",
        overrides.population ?? "10000",
        "",
        "",
        overrides.timezone ?? "Europe/Paris",
        "2026-01-01",
    ].join("\t");
}

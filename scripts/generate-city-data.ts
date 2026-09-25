import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

import type { City } from "../src/models/City";
import {
    defaultCurationConfig,
    isUsefulCandidate,
    selectCitiesForCountry,
    toRuntimeCity,
} from "./city-data/CityCurator";
import { getCountryMetadata } from "./city-data/CountryMetadata";
import { parseGeoNamesLine } from "./city-data/GeoNamesParser";

const sourcePath = resolve(process.cwd(), "cities500.txt");
const outputPath = resolve(process.cwd(), "cities.json");
const countriesOutputPath = resolve(process.cwd(), "countries.json");
const metadataPath = resolve(process.cwd(), "cities.metadata.json");

const candidatesByCountry = new Map<string, City[]>();
const missingCountryCodes = new Set<string>();

let sourceRecordCount = 0;
let validPopulatedPlaceCount = 0;
let malformedRecordCount = 0;
let usefulCandidateCount = 0;

const lines = createInterface({
    input: createReadStream(sourcePath, { encoding: "utf8" }),
    crlfDelay: Number.POSITIVE_INFINITY,
});

for await (const line of lines) {
    sourceRecordCount += 1;
    const record = parseGeoNamesLine(line);

    if (record === null) {
        malformedRecordCount += 1;
        continue;
    }

    validPopulatedPlaceCount += 1;

    if (!isUsefulCandidate(record)) {
        continue;
    }

    const country = getCountryMetadata(record.countryCode);
    if (country === undefined) {
        missingCountryCodes.add(record.countryCode);
        continue;
    }

    usefulCandidateCount += 1;
    const cities = candidatesByCountry.get(country.iso2) ?? [];
    cities.push(toRuntimeCity(record, country));
    candidatesByCountry.set(country.iso2, cities);
}

if (missingCountryCodes.size > 0) {
    throw new Error(
        `Missing country metadata: ${[...missingCountryCodes].sort().join(", ")}`,
    );
}

const selectedByCountry = new Map<string, City[]>();
const selectedCities: City[] = [];

for (const [countryCode, candidates] of candidatesByCountry) {
    const selected = selectCitiesForCountry(candidates);
    selectedByCountry.set(countryCode, selected);
    selectedCities.push(...selected);
}

selectedCities.sort((left, right) => {
    const countryComparison = left.country.localeCompare(right.country);
    if (countryComparison !== 0) {
        return countryComparison;
    }
    if (right.population !== left.population) {
        return right.population - left.population;
    }
    return left.id - right.id;
});

const selectedCountries = [...selectedByCountry.keys()]
    .map((countryCode) => getCountryMetadata(countryCode))
    .filter((country) => country !== undefined)
    .sort((left, right) => left.name.localeCompare(right.name));

const metadata = {
    generatedAt: new Date().toISOString(),
    source: "GeoNames",
    sourceDataset: "cities500",
    sourceUrl: "https://download.geonames.org/export/dump/",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    sourceRecordCount,
    validPopulatedPlaceCount,
    usefulCandidateCount,
    selectedCityCount: selectedCities.length,
    countryCount: selectedByCountry.size,
    maximumPerCountry: defaultCurationConfig.maximumPerCountry,
};

await writeFile(outputPath, `${JSON.stringify(selectedCities)}\n`, "utf8");
await writeFile(
    countriesOutputPath,
    `${JSON.stringify(selectedCountries, null, 2)}\n`,
    "utf8",
);
await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

console.log(`GeoNames records read:       ${sourceRecordCount.toLocaleString()}`);
console.log(`Valid populated places:     ${validPopulatedPlaceCount.toLocaleString()}`);
console.log(`Malformed records skipped:  ${malformedRecordCount.toLocaleString()}`);
console.log(`Useful curation candidates: ${usefulCandidateCount.toLocaleString()}`);
console.log(`Countries represented:      ${selectedByCountry.size.toLocaleString()}`);
console.log(`Cities selected:            ${selectedCities.length.toLocaleString()}`);
console.log(
    `Cities discarded:           ${(sourceRecordCount - selectedCities.length).toLocaleString()}`,
);

console.log("\nSelection examples:");
for (const countryCode of ["GB", "IN", "CN", "US", "FR", "AU"]) {
    const candidates = candidatesByCountry.get(countryCode) ?? [];
    const selected = selectedByCountry.get(countryCode) ?? [];
    const countryName = getCountryMetadata(countryCode)?.name ?? countryCode;
    console.log(
        `${countryName.padEnd(20)} ${selected.length.toLocaleString().padStart(3)} / ` +
        `${candidates.length.toLocaleString()} candidates`,
    );
}

console.log(`\nWrote ${outputPath}`);
console.log(`Wrote ${countriesOutputPath}`);
console.log(`Wrote ${metadataPath}`);

import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

import type { City } from "../src/models/City";
import type { Country } from "../src/models/Country";
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

const ukHomeNations = [
    { destinationId: "GB-ENG", admin1Code: "ENG", name: "England" },
    { destinationId: "GB-NIR", admin1Code: "NIR", name: "Northern Ireland" },
    { destinationId: "GB-SCT", admin1Code: "SCT", name: "Scotland" },
    { destinationId: "GB-WLS", admin1Code: "WLS", name: "Wales" },
] as const;
const ukHomeNationAdminCodes: ReadonlySet<string> = new Set(
    ukHomeNations.map((nation) => nation.admin1Code),
);

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

const selectedByCurationGroup = new Map<string, City[]>();
const selectedCities: City[] = [];

for (const [countryCode, candidates] of candidatesByCountry) {
    const curationGroups = new Map<string, City[]>();
    for (const city of candidates) {
        const groupId = getCurationGroupId(countryCode, city.admin1Code);
        const group = curationGroups.get(groupId) ?? [];
        group.push(city);
        curationGroups.set(groupId, group);
    }

    for (const [groupId, groupCandidates] of curationGroups) {
        const selected = selectCitiesForCountry(groupCandidates);
        selectedByCurationGroup.set(groupId, selected);
        selectedCities.push(...selected);
    }
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

const selectedCountries: Country[] = [...candidatesByCountry.keys()]
    .map((countryCode) => getCountryMetadata(countryCode))
    .filter((country) => country !== undefined)
    .map((country) => ({ ...country }));

const unitedKingdom = getCountryMetadata("GB");
if (unitedKingdom !== undefined) {
    for (const nation of ukHomeNations) {
        if (selectedByCurationGroup.has(nation.destinationId)) {
            selectedCountries.push({
                iso2: unitedKingdom.iso2,
                name: nation.name,
                continent: unitedKingdom.continent,
                destinationId: nation.destinationId,
                admin1Code: nation.admin1Code,
            });
        }
    }
}

selectedCountries.sort((left, right) => left.name.localeCompare(right.name));

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
    countryCount: candidatesByCountry.size,
    destinationCount: selectedCountries.length,
    curationGroupCount: selectedByCurationGroup.size,
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
console.log(`Countries represented:      ${candidatesByCountry.size.toLocaleString()}`);
console.log(`Destination options:        ${selectedCountries.length.toLocaleString()}`);
console.log(`Cities selected:            ${selectedCities.length.toLocaleString()}`);
console.log(
    `Cities discarded:           ${(sourceRecordCount - selectedCities.length).toLocaleString()}`,
);

console.log("\nSelection examples:");
for (const countryCode of ["GB", "IN", "CN", "US", "FR", "AU"]) {
    const candidates = candidatesByCountry.get(countryCode) ?? [];
    const selected = selectedCities.filter((city) => city.iso2 === countryCode);
    const countryName = getCountryMetadata(countryCode)?.name ?? countryCode;
    console.log(
        `${countryName.padEnd(20)} ${selected.length.toLocaleString().padStart(3)} / ` +
        `${candidates.length.toLocaleString()} candidates`,
    );
}

console.log("\nUnited Kingdom home nations:");
for (const nation of ukHomeNations) {
    const candidates = candidatesByCountry.get("GB")?.filter(
        (city) => city.admin1Code === nation.admin1Code,
    ) ?? [];
    const selected = selectedByCurationGroup.get(nation.destinationId) ?? [];
    console.log(
        `${nation.name.padEnd(20)} ${selected.length.toLocaleString().padStart(3)} / ` +
        `${candidates.length.toLocaleString()} candidates`,
    );
}

console.log(`\nWrote ${outputPath}`);
console.log(`Wrote ${countriesOutputPath}`);
console.log(`Wrote ${metadataPath}`);

function getCurationGroupId(countryIso2: string, admin1Code: string): string {
    if (countryIso2 === "GB" && ukHomeNationAdminCodes.has(admin1Code)) {
        return `${countryIso2}-${admin1Code}`;
    }
    return countryIso2;
}

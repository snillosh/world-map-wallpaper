import type { CapitalType, City } from "../../src/models/City";
import type { CountryMetadata } from "./CountryMetadata";
import type { GeoNamesCityRecord } from "./GeoNamesParser";

export interface CurationConfig {
    readonly maximumPerCountry: number;
    readonly minimumGeneralPopulation: number;
    readonly minimumAdmin2Population: number;
    readonly minimumLowerAdminPopulation: number;
    readonly protectedMajorCityShare: number;
    readonly maximumProtectedMajorCities: number;
    readonly populationWeight: number;
    readonly geographicWeight: number;
}

export const defaultCurationConfig: CurationConfig = {
    maximumPerCountry: 250,
    minimumGeneralPopulation: 5_000,
    minimumAdmin2Population: 1_000,
    minimumLowerAdminPopulation: 2_500,
    protectedMajorCityShare: 0.08,
    maximumProtectedMajorCities: 20,
    populationWeight: 0.62,
    geographicWeight: 0.38,
};

const supportedFeatureCodes = new Set([
    "PPL",
    "PPLC",
    "PPLA",
    "PPLA2",
    "PPLA3",
    "PPLA4",
    "PPLA5",
    "PPLG",
]);

export function isUsefulCandidate(
    record: GeoNamesCityRecord,
    config = defaultCurationConfig,
): boolean {
    if (!supportedFeatureCodes.has(record.featureCode)) {
        return false;
    }

    switch (record.featureCode) {
        case "PPLC":
        case "PPLA":
        case "PPLG":
            return true;
        case "PPLA2":
            return record.population >= config.minimumAdmin2Population;
        case "PPLA3":
        case "PPLA4":
        case "PPLA5":
            return record.population >= config.minimumLowerAdminPopulation;
        default:
            return record.population >= config.minimumGeneralPopulation;
    }
}

export function toRuntimeCity(
    record: GeoNamesCityRecord,
    country: CountryMetadata,
): City {
    return {
        id: record.geonameId,
        city: record.name,
        country: country.name,
        iso2: country.iso2,
        continent: country.continent,
        admin1Code: record.admin1Code,
        lat: record.latitude,
        lng: record.longitude,
        population: record.population,
        capital: getCapitalType(record.featureCode),
        featureCode: record.featureCode,
        timezone: record.timezone,
    };
}

export function selectCitiesForCountry(
    cities: readonly City[],
    config = defaultCurationConfig,
): City[] {
    const targetCount = Math.min(config.maximumPerCountry, cities.length);
    if (cities.length <= targetCount) {
        return [...cities].sort(compareImportance);
    }

    const importanceSorted = [...cities].sort(compareImportance);
    const selected: City[] = [];
    const selectedIds = new Set<number>();

    const protect = (city: City): void => {
        if (selected.length < targetCount && !selectedIds.has(city.id)) {
            selected.push(city);
            selectedIds.add(city.id);
        }
    };

    importanceSorted
        .filter((city) => city.capital === "primary")
        .forEach(protect);
    importanceSorted
        .filter((city) => city.capital === "admin")
        .forEach(protect);

    const protectedMajorCount = Math.min(
        config.maximumProtectedMajorCities,
        Math.ceil(targetCount * config.protectedMajorCityShare),
    );
    importanceSorted.slice(0, protectedMajorCount).forEach(protect);

    if (selected.length === 0) {
        protect(importanceSorted[0]);
    }

    const maximumPopulation = Math.max(...cities.map((city) => city.population), 1);
    const anchor = importanceSorted[0];
    const countrySpanKm = Math.max(
        ...cities.map((city) => distanceKm(anchor, city)),
        100,
    );
    const diversityScaleKm = Math.max(100, countrySpanKm * 0.35);
    const minimumDistanceById = new Map<number, number>();

    for (const city of cities) {
        minimumDistanceById.set(
            city.id,
            minimumDistanceToSelected(city, selected),
        );
    }

    while (selected.length < targetCount) {
        let bestCity: City | undefined;
        let bestScore = Number.NEGATIVE_INFINITY;

        for (const city of cities) {
            if (selectedIds.has(city.id)) {
                continue;
            }

            const populationScore = Math.pow(
                city.population / maximumPopulation,
                0.3,
            );
            const geographicScore = Math.min(
                (minimumDistanceById.get(city.id) ?? 0) / diversityScaleKm,
                1,
            );
            const score =
                populationScore * config.populationWeight +
                geographicScore * config.geographicWeight +
                administrativeBonus(city.capital);

            if (
                score > bestScore ||
                (score === bestScore &&
                    bestCity !== undefined &&
                    compareImportance(city, bestCity) < 0)
            ) {
                bestCity = city;
                bestScore = score;
            }
        }

        if (bestCity === undefined) {
            break;
        }

        protect(bestCity);

        for (const city of cities) {
            if (selectedIds.has(city.id)) {
                continue;
            }
            const distance = distanceKm(city, bestCity);
            minimumDistanceById.set(
                city.id,
                Math.min(minimumDistanceById.get(city.id) ?? distance, distance),
            );
        }
    }

    return selected.sort(compareImportance);
}

export function distanceKm(
    first: Pick<City, "lat" | "lng">,
    second: Pick<City, "lat" | "lng">,
): number {
    const earthRadiusKm = 6_371;
    const latitude1 = degreesToRadians(first.lat);
    const latitude2 = degreesToRadians(second.lat);
    const latitudeDelta = degreesToRadians(second.lat - first.lat);
    const longitudeDelta = degreesToRadians(second.lng - first.lng);
    const haversine =
        Math.sin(latitudeDelta / 2) ** 2 +
        Math.cos(latitude1) *
            Math.cos(latitude2) *
            Math.sin(longitudeDelta / 2) ** 2;
    return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
}

function getCapitalType(featureCode: string): CapitalType {
    if (featureCode === "PPLC") {
        return "primary";
    }
    if (featureCode === "PPLA") {
        return "admin";
    }
    if (/^PPLA[2-5]$/.test(featureCode) || featureCode === "PPLG") {
        return "minor";
    }
    return "";
}

function minimumDistanceToSelected(city: City, selected: readonly City[]): number {
    return selected.reduce(
        (minimum, selectedCity) => Math.min(
            minimum,
            distanceKm(city, selectedCity),
        ),
        Number.POSITIVE_INFINITY,
    );
}

function administrativeBonus(capital: CapitalType): number {
    switch (capital) {
        case "primary":
            return 0.3;
        case "admin":
            return 0.16;
        case "minor":
            return 0.07;
        default:
            return 0;
    }
}

function compareImportance(left: City, right: City): number {
    const capitalDifference = capitalRank(right.capital) - capitalRank(left.capital);
    if (capitalDifference !== 0) {
        return capitalDifference;
    }
    if (right.population !== left.population) {
        return right.population - left.population;
    }
    return left.id - right.id;
}

function capitalRank(capital: CapitalType): number {
    switch (capital) {
        case "primary":
            return 3;
        case "admin":
            return 2;
        case "minor":
            return 1;
        default:
            return 0;
    }
}

function degreesToRadians(degrees: number): number {
    return degrees * Math.PI / 180;
}

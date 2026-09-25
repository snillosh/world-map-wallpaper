import type { City } from "../models/City";
import { distanceKm } from "../utils/Geo";

export type RandomSource = () => number;

export interface DestinationPickerOptions {
    readonly random?: RandomSource;
    readonly recentCityLimit?: number;
    readonly recentCountryLimit?: number;
}

type DistanceBand = "short" | "medium" | "long";

interface Candidate {
    readonly city: City;
    readonly distanceKm: number;
    readonly band: DistanceBand;
}

const distanceBandChances: readonly [DistanceBand, number][] = [
    ["short", 0.45],
    ["medium", 0.35],
    ["long", 0.20],
];
const maximumShortDistanceKm = 1_500;
const maximumMediumDistanceKm = 5_000;
const smallAreaShortFraction = 0.3;
const smallAreaMediumFraction = 0.7;

export class DestinationPicker {
    private readonly cities: readonly City[];
    private readonly random: RandomSource;
    private readonly recentCityLimit: number;
    private readonly recentCountryLimit: number;

    private recentCityIds: number[] = [];
    private recentCountryCodes: string[] = [];
    private readonly visitCounts = new Map<number, number>();

    constructor(
        cities: readonly City[],
        options: DestinationPickerOptions = {},
    ) {
        if (cities.length < 2) {
            throw new Error("DestinationPicker needs at least two eligible cities.");
        }

        this.cities = cities;
        this.random = options.random ?? Math.random;
        this.recentCityLimit = Math.max(0, options.recentCityLimit ?? 16);
        this.recentCountryLimit = Math.max(0, options.recentCountryLimit ?? 4);
    }

    public pickInitialCity(): City {
        const maximumPopulation = this.maximumPopulation(this.cities);
        const city = this.weightedRandom(
            this.cities,
            (candidate) => this.cityWeight(candidate, maximumPopulation),
        );
        this.remember(city);
        return city;
    }

    public pickNextCity(currentCity: City): City {
        const nonCurrentCities = this.cities.filter(
            (city) => city.id !== currentCity.id,
        );
        const freshCities = nonCurrentCities.filter(
            (city) => !this.recentCityIds.includes(city.id),
        );
        const availableCities = freshCities.length > 0
            ? freshCities
            : nonCurrentCities;

        const candidates = this.classifyByDistance(currentCity, availableCities);
        const requestedBand = this.pickDistanceBand();
        const bandPool = this.getBandPool(candidates, requestedBand);
        const maximumPopulation = this.maximumPopulation(availableCities);
        const nextCity = this.weightedRandom(
            bandPool,
            (candidate) => this.destinationWeight(candidate, maximumPopulation),
        ).city;

        this.remember(nextCity);
        return nextCity;
    }

    private classifyByDistance(
        currentCity: City,
        cities: readonly City[],
    ): Candidate[] {
        const distances = cities.map((city) => ({
            city,
            distanceKm: distanceKm(currentCity, city),
        }));
        const maximumDistance = Math.max(
            ...distances.map((candidate) => candidate.distanceKm),
        );

        // Absolute bands work for worldwide routes. Scaling them down to the
        // current pool also gives a country-only journey meaningful variety.
        const shortBoundary = Math.min(
            maximumShortDistanceKm,
            maximumDistance * smallAreaShortFraction,
        );
        const mediumBoundary = Math.min(
            maximumMediumDistanceKm,
            maximumDistance * smallAreaMediumFraction,
        );

        return distances.map((candidate) => ({
            ...candidate,
            band: candidate.distanceKm <= shortBoundary
                ? "short"
                : candidate.distanceKm <= mediumBoundary
                    ? "medium"
                    : "long",
        }));
    }

    private pickDistanceBand(): DistanceBand {
        let target = this.random();

        for (const [band, chance] of distanceBandChances) {
            target -= chance;
            if (target < 0) {
                return band;
            }
        }

        return "long";
    }

    private getBandPool(
        candidates: readonly Candidate[],
        requestedBand: DistanceBand,
    ): readonly Candidate[] {
        const fallbackOrder: Readonly<Record<DistanceBand, readonly DistanceBand[]>> = {
            short: ["short", "medium", "long"],
            medium: ["medium", "short", "long"],
            long: ["long", "medium", "short"],
        };

        for (const band of fallbackOrder[requestedBand]) {
            const matching = candidates.filter((candidate) => candidate.band === band);
            if (matching.length > 0) {
                return matching;
            }
        }

        throw new Error("No destination is available outside the current city.");
    }

    private destinationWeight(
        candidate: Candidate,
        maximumPopulation: number,
    ): number {
        const { city, distanceKm: journeyDistanceKm } = candidate;
        const recentCountryPenalty = this.recentCountryCodes.includes(city.iso2)
            ? 0.55
            : 1;
        const visits = this.visitCounts.get(city.id) ?? 0;
        const noveltyWeight = 1 / Math.sqrt(1 + visits);
        const adjacentPlacePenalty = journeyDistanceKm < 50
            ? 0.08
            : journeyDistanceKm < 150
                ? 0.45
                : 1;

        return this.cityWeight(city, maximumPopulation) *
            recentCountryPenalty *
            noveltyWeight *
            adjacentPlacePenalty;
    }

    private cityWeight(city: City, maximumPopulation: number): number {
        const relativePopulation = city.population / maximumPopulation;
        const populationWeight = 0.2 + Math.pow(relativePopulation, 0.35) * 0.8;
        const importanceBonus = city.capital === "primary"
            ? 1.5
            : city.capital === "admin"
                ? 1.25
                : city.capital === "minor"
                    ? 1.1
                    : 1;

        return populationWeight * importanceBonus;
    }

    private maximumPopulation(cities: readonly City[]): number {
        return Math.max(...cities.map((city) => city.population), 1);
    }

    private weightedRandom<T>(
        items: readonly T[],
        getWeight: (item: T) => number,
    ): T {
        const weightedItems = items.map((item) => ({
            item,
            weight: getWeight(item),
        }));
        const totalWeight = weightedItems.reduce(
            (sum, item) => sum + item.weight,
            0,
        );
        let target = this.random() * totalWeight;

        for (const item of weightedItems) {
            target -= item.weight;
            if (target <= 0) {
                return item.item;
            }
        }

        return weightedItems[weightedItems.length - 1].item;
    }

    private remember(city: City): void {
        this.visitCounts.set(city.id, (this.visitCounts.get(city.id) ?? 0) + 1);
        this.recentCityIds.push(city.id);
        this.recentCountryCodes.push(city.iso2);

        if (this.recentCityIds.length > this.recentCityLimit) {
            this.recentCityIds.shift();
        }
        if (this.recentCountryCodes.length > this.recentCountryLimit) {
            this.recentCountryCodes.shift();
        }
    }
}

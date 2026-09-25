import type { City } from "../models/City";
import { distanceKm } from "../utils/Geo";
import type { RandomSource } from "./DestinationPicker";

export interface ExploreDestinationPickerOptions {
    readonly random?: RandomSource;
    readonly recentCityLimit?: number;
    readonly longRelocationChance?: number;
}

interface Candidate {
    readonly city: City;
    readonly distanceKm: number;
}

const localRadiusKm = 650;
const minimumLocalCandidates = 12;

export class ExploreDestinationPicker {
    private readonly cities: readonly City[];
    private readonly random: RandomSource;
    private readonly recentCityLimit: number;
    private readonly longRelocationChance: number;
    private recentCityIds: number[] = [];

    constructor(
        cities: readonly City[],
        options: ExploreDestinationPickerOptions = {},
    ) {
        if (cities.length < 2) {
            throw new Error(
                "ExploreDestinationPicker needs at least two eligible cities.",
            );
        }
        this.cities = cities;
        this.random = options.random ?? Math.random;
        this.recentCityLimit = Math.max(0, options.recentCityLimit ?? 14);
        this.longRelocationChance = options.longRelocationChance ?? 0.15;
    }

    public pickInitialCity(): City {
        const city = this.weightedRandom(
            this.cities.map((candidate) => ({ city: candidate, distanceKm: 0 })),
            (candidate) => this.importanceWeight(candidate.city),
        ).city;
        this.remember(city);
        return city;
    }

    public pickNextCity(currentCity: City): City {
        const nonCurrent = this.cities.filter((city) => city.id !== currentCity.id);
        const fresh = nonCurrent.filter(
            (city) => !this.recentCityIds.includes(city.id),
        );
        const available = fresh.length > 0 ? fresh : nonCurrent;
        const candidates = available
            .map((city) => ({ city, distanceKm: distanceKm(currentCity, city) }))
            .sort((left, right) => left.distanceKm - right.distanceKm);
        const localCandidates = this.getLocalCandidates(candidates);
        const localIds = new Set(localCandidates.map((candidate) => candidate.city.id));
        const longCandidates = candidates.filter(
            (candidate) => !localIds.has(candidate.city.id),
        );
        const chooseLong = this.random() < this.longRelocationChance;
        const pool = chooseLong && longCandidates.length > 0
            ? longCandidates
            : localCandidates.length > 0
                ? localCandidates
                : candidates;
        const maximumDistance = Math.max(
            ...pool.map((candidate) => candidate.distanceKm),
            1,
        );
        const next = this.weightedRandom(pool, (candidate) => {
            const distanceWeight = chooseLong && longCandidates.length > 0
                ? 0.35 + 0.65 * Math.sqrt(candidate.distanceKm / maximumDistance)
                : 1 / (1 + Math.pow(candidate.distanceKm / 180, 1.35));
            return distanceWeight * this.importanceWeight(candidate.city);
        }).city;

        this.remember(next);
        return next;
    }

    private getLocalCandidates(candidates: readonly Candidate[]): Candidate[] {
        const withinRadius = candidates.filter(
            (candidate) => candidate.distanceKm <= localRadiusKm,
        );
        if (withinRadius.length >= minimumLocalCandidates) {
            return withinRadius;
        }
        return candidates.slice(0, Math.min(minimumLocalCandidates, candidates.length));
    }

    private importanceWeight(city: City): number {
        const populationWeight = 0.35 + Math.pow(
            Math.max(city.population, 1) / 1_000_000,
            0.18,
        );
        const importanceBonus = city.capital === "primary"
            ? 1.35
            : city.capital === "admin"
                ? 1.18
                : city.capital === "minor"
                    ? 1.08
                    : 1;
        return populationWeight * importanceBonus;
    }

    private weightedRandom(
        candidates: readonly Candidate[],
        getWeight: (candidate: Candidate) => number,
    ): Candidate {
        const weighted = candidates.map((candidate) => ({
            candidate,
            weight: getWeight(candidate),
        }));
        const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
        let target = this.random() * totalWeight;

        for (const item of weighted) {
            target -= item.weight;
            if (target <= 0) {
                return item.candidate;
            }
        }
        return weighted[weighted.length - 1].candidate;
    }

    private remember(city: City): void {
        this.recentCityIds.push(city.id);
        if (this.recentCityIds.length > this.recentCityLimit) {
            this.recentCityIds.shift();
        }
    }
}

import type { City } from "../models/City";

export class DestinationPicker {
    private readonly cities: readonly City[];
    private readonly recentLimit: number;

    private recentCities: City[] = [];

    constructor(
        cities: readonly City[],
        recentLimit = 10,
    ) {
        this.cities = cities;
        this.recentLimit = recentLimit;
    }

    public pickInitialCity(): City {
        const city = this.randomCity();
        this.remember(city);
        return city;
    }

    public pickNextCity(currentCity: City): City {
        const candidates = this.cities.filter((city) => {
            return city !== currentCity && !this.recentCities.includes(city);
        });

        const pool = candidates.length > 0 ? candidates : this.cities;

        const nextCity = this.weightedRandom(pool, currentCity);

        this.remember(nextCity);

        return nextCity;
    }

    private weightedRandom(cities: readonly City[], currentCity: City): City {
        const weightedCities = cities.map((city) => {
            return {
                city,
                weight: this.getWeight(city, currentCity),
            };
        });

        const totalWeight = weightedCities.reduce(
            (sum, item) => sum + item.weight,
            0,
        );

        let target = Math.random() * totalWeight;

        for (const item of weightedCities) {
            target -= item.weight;

            if (target <= 0) {
                return item.city;
            }
        }

        return weightedCities[weightedCities.length - 1].city;
    }

    private getWeight(city: City, currentCity: City): number {
        const populationWeight = Math.sqrt(city.population);

        const distance = this.distanceKm(currentCity, city);

        const distanceWeight =
            distance < 500
                ? 0.4
                : distance < 2_000
                    ? 1.5
                    : distance < 6_000
                        ? 1.0
                        : 0.35;

        const sameCountryPenalty = city.iso2 === currentCity.iso2 ? 0.4 : 1.0;

        const capitalBonus =
            city.capital === "primary" ? 1.6 :
                city.capital === "admin" ? 1.2 :
                    1.0;

        return populationWeight * distanceWeight * sameCountryPenalty * capitalBonus;
    }

    private distanceKm(a: City, b: City): number {
        const earthRadiusKm = 6371;

        const lat1 = this.toRadians(a.lat);
        const lat2 = this.toRadians(b.lat);
        const deltaLat = this.toRadians(b.lat - a.lat);
        const deltaLng = this.toRadians(b.lng - a.lng);

        const h =
            Math.sin(deltaLat / 2) ** 2 +
            Math.cos(lat1) *
            Math.cos(lat2) *
            Math.sin(deltaLng / 2) ** 2;

        return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
    }

    private toRadians(degrees: number): number {
        return degrees * Math.PI / 180;
    }

    private randomCity(): City {
        return this.cities[Math.floor(Math.random() * this.cities.length)];
    }

    private remember(city: City): void {
        this.recentCities.push(city);

        if (this.recentCities.length > this.recentLimit) {
            this.recentCities.shift();
        }
    }
}
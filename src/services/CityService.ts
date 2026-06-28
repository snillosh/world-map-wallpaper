import { Config } from "../config/Config";
import type { City } from "../models/City";

export class CityService {
    private cities: City[] = [];

    public async initialise(): Promise<void> {
        const response = await fetch(Config.cities.dataUrl);

        if (!response.ok) {
            throw new Error(
                `Failed to load cities (${response.status} ${response.statusText})`,
            );
        }

        const data = (await response.json()) as City[];

        this.cities = data.filter(
            (city) => city.population >= Config.cities.minimumPopulation,
        );

        if (this.cities.length === 0) {
            throw new Error("No cities matched the configured filters.");
        }
    }

    public random(): City {
        return this.cities[Math.floor(Math.random() * this.cities.length)];
    }

    public next(current: City): City {
        let city = this.random();

        while (city === current) {
            city = this.random();
        }

        return city;
    }

    public get count(): number {
        return this.cities.length;
    }

    public get all(): readonly City[] {
        return this.cities;
    }
}
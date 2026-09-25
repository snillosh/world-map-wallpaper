import type { City } from "../models/City";
import { Config } from "../config/Config";

export class CityService {
    private cities: City[] = [];

    public async initialise(): Promise<void> {
        const response = await fetch(Config.cities.dataUrl);

        if (!response.ok) {
            throw new Error(
                `Failed to load cities (${response.status} ${response.statusText})`,
            );
        }

        this.cities = (await response.json()) as City[];

        if (this.cities.length < 2) {
            throw new Error("The city dataset needs at least two cities.");
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

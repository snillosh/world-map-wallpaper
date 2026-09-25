import type { City } from "../models/City";
import type { DestinationContinent } from "../models/WallpaperSettings";

export interface DestinationConstraints {
    readonly minimumPopulation: number;
    readonly continent: DestinationContinent | null;
    readonly countryIso2: string | null;
}

export class DestinationEligibility {
    public filter(
        cities: readonly City[],
        constraints: DestinationConstraints,
    ): City[] {
        return cities.filter((city) => {
            return (
                constraints.continent === null ||
                city.continent === constraints.continent
            ) &&
                city.population >= constraints.minimumPopulation &&
                (
                    constraints.countryIso2 === null ||
                    city.iso2 === constraints.countryIso2
                );
        });
    }
}

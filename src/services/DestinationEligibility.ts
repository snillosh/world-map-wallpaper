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
                matchesDestination(city, constraints.countryIso2);
        });
    }
}

function matchesDestination(
    city: City,
    destinationId: string | null,
): boolean {
    if (destinationId === null) {
        return true;
    }

    const [countryIso2, admin1Code] = destinationId.split("-", 2);
    return city.iso2 === countryIso2 &&
        (admin1Code === undefined || city.admin1Code === admin1Code);
}

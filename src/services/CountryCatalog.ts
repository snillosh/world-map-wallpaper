import type { Country } from "../models/Country";
import type { DestinationContinent } from "../models/WallpaperSettings";

export async function loadCountryOptions(
    dataUrl: string,
): Promise<readonly Country[]> {
    const response = await fetch(dataUrl);

    if (!response.ok) {
        throw new Error(
            `Failed to load countries (${response.status} ${response.statusText})`,
        );
    }

    return (await response.json() as Country[])
        .toSorted((left, right) => left.name.localeCompare(right.name));
}

export function filterCountryOptions(
    countries: readonly Country[],
    continent: DestinationContinent | null,
): readonly Country[] {
    if (continent === null) {
        return countries;
    }

    return countries.filter((country) => country.continent === continent);
}

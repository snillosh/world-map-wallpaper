export interface City {
    id: number;
    city: string;
    country: string;
    iso2: string;
    continent: Continent;
    admin1Code: string;
    lat: number;
    lng: number;
    population: number;
    capital: CapitalType;
    featureCode: string;
    timezone: string;
}

export type CapitalType = "primary" | "admin" | "minor" | "";

export type Continent =
    | "Africa"
    | "Asia"
    | "Europe"
    | "North America"
    | "South America"
    | "Oceania"
    | "Antarctica";

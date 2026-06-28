export interface City {
    city: string;
    country: string;
    iso2: string;
    lat: number;
    lng: number;
    population: number;
    capital: CapitalType;
}

export type CapitalType = "primary" | "admin" | "minor" | "";
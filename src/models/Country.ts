import type { Continent } from "./City.js";

export interface Country {
    readonly iso2: string;
    readonly name: string;
    readonly continent: Continent;
    /** ISO 3166-2-style selector value for a subdivision, otherwise `iso2`. */
    readonly destinationId?: string;
    readonly admin1Code?: string;
}

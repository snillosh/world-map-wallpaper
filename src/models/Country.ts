import type { Continent } from "./City";

export interface Country {
    readonly iso2: string;
    readonly name: string;
    readonly continent: Continent;
}

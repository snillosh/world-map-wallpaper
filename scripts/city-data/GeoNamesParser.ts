export interface GeoNamesCityRecord {
    readonly geonameId: number;
    readonly name: string;
    readonly asciiName: string;
    readonly latitude: number;
    readonly longitude: number;
    readonly featureClass: string;
    readonly featureCode: string;
    readonly countryCode: string;
    readonly admin1Code: string;
    readonly population: number;
    readonly timezone: string;
}

const fieldCount = 19;

export function parseGeoNamesLine(line: string): GeoNamesCityRecord | null {
    const fields = line.split("\t");

    if (fields.length !== fieldCount) {
        return null;
    }

    const geonameId = Number(fields[0]);
    const name = fields[1].trim();
    const asciiName = fields[2].trim();
    const latitude = Number(fields[4]);
    const longitude = Number(fields[5]);
    const featureClass = fields[6].trim();
    const featureCode = fields[7].trim();
    const countryCode = fields[8].trim().toUpperCase();
    const admin1Code = fields[10].trim();
    const population = fields[14] === "" ? 0 : Number(fields[14]);
    const timezone = fields[17].trim();

    if (
        !Number.isSafeInteger(geonameId) ||
        geonameId <= 0 ||
        (name === "" && asciiName === "") ||
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90 ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180 ||
        featureClass !== "P" ||
        featureCode === "" ||
        !/^[A-Z]{2}$/.test(countryCode) ||
        !Number.isSafeInteger(population) ||
        population < 0
    ) {
        return null;
    }

    return {
        geonameId,
        name: name || asciiName,
        asciiName,
        latitude,
        longitude,
        featureClass,
        featureCode,
        countryCode,
        admin1Code,
        population,
        timezone,
    };
}

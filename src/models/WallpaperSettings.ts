import type { Continent } from "./City";
import type { Country } from "./Country";

export const behaviourModes = ["flight", "orbit", "explore"] as const;
export type BehaviourModeKind = typeof behaviourModes[number];

export const mapStyles = [
    "night-flight",
    "night-density",
    "muted-orange",
    "classic",
] as const;
export type MapStyle = typeof mapStyles[number];

export const targetFpsOptions = [15, 30, 60] as const;
export type TargetFps = typeof targetFpsOptions[number];

export const orbitDirections = ["east", "west"] as const;
export type OrbitDirection = typeof orbitDirections[number];

export type CountryIso2 = string;

export const destinationContinents = [
    "Africa",
    "Asia",
    "Europe",
    "North America",
    "South America",
    "Oceania",
] as const satisfies readonly Continent[];
export type DestinationContinent = typeof destinationContinents[number];

export interface VisualSettings {
    readonly mapStyle: MapStyle;
}

export interface PerformanceSettings {
    readonly targetFps: TargetFps;
}

export interface DestinationSettings {
    readonly continent: DestinationContinent | null;
    readonly countryIso2: CountryIso2 | null;
}

export interface FlightSettings {
    readonly speedMultiplier: number;
    readonly minimumPopulation: number;
    readonly showRouteLabel: boolean;
}

export interface OrbitSettings {
    readonly speedDegreesPerMinute: number;
    readonly direction: OrbitDirection;
    readonly startingLongitude: number;
    readonly latitude: number;
    readonly zoom: number;
}

export interface ExploreSettings {
    readonly zoomedOutLevel: number;
    readonly zoomedInLevel: number;
    readonly zoomInDurationSeconds: number;
    readonly viewDurationSeconds: number;
    readonly zoomOutDurationSeconds: number;
}

export interface WallpaperSettings {
    readonly behaviourMode: BehaviourModeKind;
    readonly visual: VisualSettings;
    readonly performance: PerformanceSettings;
    readonly destinations: DestinationSettings;
    readonly flight: FlightSettings;
    readonly orbit: OrbitSettings;
    readonly explore: ExploreSettings;
}

export interface WallpaperSettingsPatch {
    readonly behaviourMode?: BehaviourModeKind;
    readonly visual?: Partial<VisualSettings>;
    readonly performance?: Partial<PerformanceSettings>;
    readonly destinations?: Partial<DestinationSettings>;
    readonly flight?: Partial<FlightSettings>;
    readonly orbit?: Partial<OrbitSettings>;
    readonly explore?: Partial<ExploreSettings>;
}

export const defaultWallpaperSettings: WallpaperSettings = {
    behaviourMode: "flight",
    visual: {
        mapStyle: "night-flight",
    },
    performance: {
        targetFps: 30,
    },
    destinations: {
        continent: null,
        countryIso2: null,
    },
    flight: {
        speedMultiplier: 1,
        minimumPopulation: 250_000,
        showRouteLabel: true,
    },
    orbit: {
        speedDegreesPerMinute: 2,
        direction: "east",
        startingLongitude: 0,
        latitude: 20,
        zoom: 3.6,
    },
    explore: {
        zoomedOutLevel: 3,
        zoomedInLevel: 8,
        zoomInDurationSeconds: 8,
        viewDurationSeconds: 4,
        zoomOutDurationSeconds: 6,
    },
};

export const settingsLimits = {
    flight: {
        speedMultiplier: { minimum: 0.1, maximum: 2 },
        minimumPopulation: { minimum: 0, maximum: 5_000_000 },
    },
    orbit: {
        speedDegreesPerMinute: { minimum: 0.5, maximum: 10 },
        startingLongitude: { minimum: -180, maximum: 180 },
        latitude: { minimum: -55, maximum: 55 },
        zoom: { minimum: 2, maximum: 6 },
    },
    explore: {
        zoomedOutLevel: { minimum: 1.5, maximum: 8 },
        zoomedInLevel: { minimum: 6, maximum: 16 },
        zoomInDurationSeconds: { minimum: 1, maximum: 30 },
        viewDurationSeconds: { minimum: 0, maximum: 30 },
        zoomOutDurationSeconds: { minimum: 1, maximum: 30 },
    },
} as const;

export function validateSettingsPatch(value: unknown): WallpaperSettingsPatch {
    const root = requireRecord(value, "Settings update");
    requireOnlyKeys(root, [
        "behaviourMode",
        "visual",
        "performance",
        "destinations",
        "flight",
        "orbit",
        "explore",
    ]);

    const patch: Mutable<WallpaperSettingsPatch> = {};

    if (root.behaviourMode !== undefined) {
        patch.behaviourMode = requireOption(
            root.behaviourMode,
            behaviourModes,
            "behaviour mode",
        );
    }
    if (root.visual !== undefined) {
        patch.visual = validateVisualPatch(root.visual);
    }
    if (root.performance !== undefined) {
        patch.performance = validatePerformancePatch(root.performance);
    }
    if (root.destinations !== undefined) {
        patch.destinations = validateDestinationPatch(root.destinations);
    }
    if (root.flight !== undefined) {
        patch.flight = validateFlightPatch(root.flight);
    }
    if (root.orbit !== undefined) {
        patch.orbit = validateOrbitPatch(root.orbit);
    }
    if (root.explore !== undefined) {
        patch.explore = validateExplorePatch(root.explore);
    }

    return patch;
}

export function validateSettings(value: unknown): WallpaperSettings {
    const record = requireRecord(value, "Settings");
    const requiredKeys: readonly (keyof WallpaperSettings)[] = [
        "behaviourMode",
        "visual",
        "performance",
        "destinations",
        "flight",
        "orbit",
        "explore",
    ];

    if (requiredKeys.some((key) => record[key] === undefined)) {
        throw new Error("Settings object is incomplete.");
    }

    const requiredNestedKeys: Readonly<Record<
        Exclude<keyof WallpaperSettings, "behaviourMode">,
        readonly string[]
    >> = {
        visual: ["mapStyle"],
        performance: ["targetFps"],
        destinations: ["continent", "countryIso2"],
        flight: ["speedMultiplier", "minimumPopulation", "showRouteLabel"],
        orbit: [
            "speedDegreesPerMinute",
            "direction",
            "startingLongitude",
            "latitude",
            "zoom",
        ],
        explore: [
            "zoomedOutLevel",
            "zoomedInLevel",
            "zoomInDurationSeconds",
            "viewDurationSeconds",
            "zoomOutDurationSeconds",
        ],
    };

    for (const [key, expectedKeys] of Object.entries(requiredNestedKeys)) {
        const nested = requireRecord(record[key], `${key} settings`);
        if (expectedKeys.some((expectedKey) => nested[expectedKey] === undefined)) {
            throw new Error("Settings object is incomplete.");
        }
    }

    return mergeSettings(defaultWallpaperSettings, validateSettingsPatch(record));
}

export function mergeSettings(
    current: WallpaperSettings,
    patch: WallpaperSettingsPatch,
): WallpaperSettings {
    return {
        behaviourMode: patch.behaviourMode ?? current.behaviourMode,
        visual: { ...current.visual, ...patch.visual },
        performance: { ...current.performance, ...patch.performance },
        destinations: { ...current.destinations, ...patch.destinations },
        flight: { ...current.flight, ...patch.flight },
        orbit: { ...current.orbit, ...patch.orbit },
        explore: { ...current.explore, ...patch.explore },
    };
}

export function mergeSettingsPatches(
    current: WallpaperSettingsPatch,
    patch: WallpaperSettingsPatch,
): WallpaperSettingsPatch {
    return {
        ...current,
        ...patch,
        visual: mergeOptionalObjects(current.visual, patch.visual),
        performance: mergeOptionalObjects(current.performance, patch.performance),
        destinations: mergeOptionalObjects(
            current.destinations,
            patch.destinations,
        ),
        flight: mergeOptionalObjects(current.flight, patch.flight),
        orbit: mergeOptionalObjects(current.orbit, patch.orbit),
        explore: mergeOptionalObjects(current.explore, patch.explore),
    };
}

export function migrateStoredSettings(value: unknown): WallpaperSettings {
    const record = requireRecord(value, "Stored settings");

    // The original flat model used `mode` for the map style, not behaviour.
    if (record.mode !== undefined) {
        return validateSettings({
            ...defaultWallpaperSettings,
            visual: { mapStyle: record.mode },
            performance: { targetFps: record.targetFps },
            flight: {
                speedMultiplier: record.flightSpeedMultiplier,
                minimumPopulation: record.minimumPopulation,
                showRouteLabel: record.showRouteLabel,
            },
        });
    }

    return mergeSettings(
        defaultWallpaperSettings,
        validateSettingsPatch(migrateLegacyDestinationSettings(record)),
    );
}

export function normalizeDestinationSettings(
    settings: WallpaperSettings,
    countries: readonly Country[],
): WallpaperSettings {
    const countryIso2 = settings.destinations.countryIso2;

    if (countryIso2 === null) {
        return settings;
    }

    const country = countries.find((candidate) => candidate.iso2 === countryIso2);
    const countryIsCompatible = country !== undefined &&
        (
            settings.destinations.continent === null ||
            country.continent === settings.destinations.continent
        );

    if (countryIsCompatible) {
        return settings;
    }

    return {
        ...settings,
        destinations: {
            ...settings.destinations,
            countryIso2: null,
        },
    };
}

function validateVisualPatch(value: unknown): Partial<VisualSettings> {
    const visual = requireRecord(value, "Visual settings");
    requireOnlyKeys(visual, ["mapStyle"]);
    return visual.mapStyle === undefined
        ? {}
        : { mapStyle: requireOption(visual.mapStyle, mapStyles, "map style") };
}

function validatePerformancePatch(value: unknown): Partial<PerformanceSettings> {
    const performance = requireRecord(value, "Performance settings");
    requireOnlyKeys(performance, ["targetFps"]);
    return performance.targetFps === undefined
        ? {}
        : {
            targetFps: requireOption(
                performance.targetFps,
                targetFpsOptions,
                "target FPS",
            ),
        };
}

function validateDestinationPatch(value: unknown): Partial<DestinationSettings> {
    const destinations = requireRecord(value, "Destination settings");
    requireOnlyKeys(destinations, ["continent", "countryIso2"]);
    const patch: Mutable<Partial<DestinationSettings>> = {};

    if (destinations.continent !== undefined) {
        patch.continent = destinations.continent === null
            ? null
            : requireOption(
                destinations.continent,
                destinationContinents,
                "continent",
            );
    }
    if (destinations.countryIso2 !== undefined) {
        if (destinations.countryIso2 === null) {
            patch.countryIso2 = null;
        } else if (
            typeof destinations.countryIso2 === "string" &&
            /^[A-Z]{2}$/.test(destinations.countryIso2)
        ) {
            patch.countryIso2 = destinations.countryIso2;
        } else {
            throw new Error("Country must be an uppercase ISO2 code or null.");
        }
    }

    return patch;
}

function validateFlightPatch(value: unknown): Partial<FlightSettings> {
    const flight = requireRecord(value, "Flight settings");
    requireOnlyKeys(flight, [
        "speedMultiplier",
        "minimumPopulation",
        "showRouteLabel",
    ]);
    const patch: Mutable<Partial<FlightSettings>> = {};

    if (flight.speedMultiplier !== undefined) {
        patch.speedMultiplier = requireNumber(
            flight.speedMultiplier,
            settingsLimits.flight.speedMultiplier,
            "Flight speed",
        );
    }
    if (flight.minimumPopulation !== undefined) {
        patch.minimumPopulation = requireNumber(
            flight.minimumPopulation,
            settingsLimits.flight.minimumPopulation,
            "Minimum population",
            true,
        );
    }
    if (flight.showRouteLabel !== undefined) {
        if (typeof flight.showRouteLabel !== "boolean") {
            throw new Error("Route label visibility must be a boolean.");
        }
        patch.showRouteLabel = flight.showRouteLabel;
    }
    return patch;
}

function validateOrbitPatch(value: unknown): Partial<OrbitSettings> {
    const orbit = requireRecord(value, "Orbit settings");
    requireOnlyKeys(orbit, [
        "speedDegreesPerMinute",
        "direction",
        "startingLongitude",
        "latitude",
        "zoom",
    ]);
    const patch: Mutable<Partial<OrbitSettings>> = {};

    if (orbit.speedDegreesPerMinute !== undefined) {
        patch.speedDegreesPerMinute = requireNumber(
            orbit.speedDegreesPerMinute,
            settingsLimits.orbit.speedDegreesPerMinute,
            "Orbit speed",
        );
    }
    if (orbit.direction !== undefined) {
        patch.direction = requireOption(
            orbit.direction,
            orbitDirections,
            "orbit direction",
        );
    }
    if (orbit.startingLongitude !== undefined) {
        patch.startingLongitude = requireNumber(
            orbit.startingLongitude,
            settingsLimits.orbit.startingLongitude,
            "Starting longitude",
        );
    }
    if (orbit.latitude !== undefined) {
        patch.latitude = requireNumber(
            orbit.latitude,
            settingsLimits.orbit.latitude,
            "Orbit latitude",
        );
    }
    if (orbit.zoom !== undefined) {
        patch.zoom = requireNumber(
            orbit.zoom,
            settingsLimits.orbit.zoom,
            "Orbit zoom",
        );
    }
    return patch;
}

function validateExplorePatch(value: unknown): Partial<ExploreSettings> {
    const explore = requireRecord(value, "Explore settings");
    const keys: readonly (keyof ExploreSettings)[] = [
        "zoomedOutLevel",
        "zoomedInLevel",
        "zoomInDurationSeconds",
        "viewDurationSeconds",
        "zoomOutDurationSeconds",
    ];
    requireOnlyKeys(explore, keys);
    const patch: Mutable<Partial<ExploreSettings>> = {};

    for (const key of keys) {
        if (explore[key] !== undefined) {
            patch[key] = requireNumber(
                explore[key],
                settingsLimits.explore[key],
                `Explore ${key}`,
            );
        }
    }
    return patch;
}

function migrateLegacyDestinationSettings(
    record: Record<string, unknown>,
): Record<string, unknown> {
    const migrated = { ...record };
    if (!isRecord(migrated.flight)) {
        return migrated;
    }

    const flight = { ...migrated.flight };
    const legacyContinent = flight.continent;
    const legacyCountryIso2 = flight.countryIso2;
    delete flight.continent;
    delete flight.countryIso2;
    migrated.flight = flight;

    if (migrated.destinations === undefined) {
        migrated.destinations = {
            continent: legacyContinent ?? null,
            countryIso2: legacyCountryIso2 ?? null,
        };
    }

    return migrated;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, name: string): Record<string, unknown> {
    if (!isRecord(value)) {
        throw new Error(`${name} must be an object.`);
    }
    return value;
}

function requireOnlyKeys(
    record: Record<string, unknown>,
    allowedKeys: readonly string[],
): void {
    for (const key of Object.keys(record)) {
        if (!allowedKeys.includes(key)) {
            throw new Error(`Unknown setting: ${key}`);
        }
    }
}

function requireOption<const Option extends string | number>(
    value: unknown,
    options: readonly Option[],
    name: string,
): Option {
    if (!options.includes(value as Option)) {
        throw new Error(`Invalid ${name}.`);
    }
    return value as Option;
}

function requireNumber(
    value: unknown,
    limits: { readonly minimum: number; readonly maximum: number },
    name: string,
    integer = false,
): number {
    if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < limits.minimum ||
        value > limits.maximum ||
        (integer && !Number.isInteger(value))
    ) {
        throw new Error(`${name} is outside the allowed range.`);
    }
    return value;
}

function mergeOptionalObjects<Value extends object>(
    current: Value | undefined,
    patch: Value | undefined,
): Value | undefined {
    if (current === undefined && patch === undefined) {
        return undefined;
    }
    return { ...current, ...patch } as Value;
}

type Mutable<Value> = {
    -readonly [Key in keyof Value]: Value[Key];
};

import type {
    WallpaperSettings,
    WallpaperSettingsPatch,
} from "./WallpaperSettings";
import {
    validateSettings,
    validateSettingsPatch,
} from "./WallpaperSettings";

export type SettingsClientRole = "wallpaper" | "settings";

export type SettingsClientMessage =
    | {
        readonly type: "client.hello";
        readonly role: SettingsClientRole;
    }
    | {
        readonly type: "settings.get";
    }
    | {
        readonly type: "settings.update";
        readonly patch: WallpaperSettingsPatch;
    };

export type SettingsServerMessage =
    | {
        readonly type: "settings.current";
        readonly settings: WallpaperSettings;
    }
    | {
        readonly type: "settings.error";
        readonly message: string;
    };

export function parseClientMessage(json: string): SettingsClientMessage {
    const value = parseRecord(json);

    switch (value.type) {
        case "client.hello":
            if (value.role !== "wallpaper" && value.role !== "settings") {
                throw new Error("Invalid client role.");
            }
            return { type: value.type, role: value.role };
        case "settings.get":
            return { type: value.type };
        case "settings.update":
            return {
                type: value.type,
                patch: validateSettingsPatch(value.patch),
            };
        default:
            throw new Error("Unknown client message type.");
    }
}

export function parseServerMessage(json: string): SettingsServerMessage {
    const value = parseRecord(json);

    switch (value.type) {
        case "settings.current":
            return {
                type: value.type,
                settings: validateSettings(value.settings),
            };
        case "settings.error":
            if (typeof value.message !== "string") {
                throw new Error("Invalid settings error message.");
            }
            return { type: value.type, message: value.message };
        default:
            throw new Error("Unknown server message type.");
    }
}

function parseRecord(json: string): Record<string, unknown> {
    const value: unknown = JSON.parse(json);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("Protocol message must be an object.");
    }
    return value as Record<string, unknown>;
}

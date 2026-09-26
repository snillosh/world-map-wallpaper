import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { WebSocket, WebSocketServer } from "ws";

import type { SettingsServerMessage } from "../src/models/SettingsProtocol";
import { parseClientMessage } from "../src/models/SettingsProtocol";
import type { Country } from "../src/models/Country";
import type {
    WallpaperSettings,
    WallpaperSettingsPatch,
} from "../src/models/WallpaperSettings";
import {
    defaultWallpaperSettings,
    mergeSettings,
    migrateStoredSettings,
    normalizeDestinationSettings,
    validateSettings,
} from "../src/models/WallpaperSettings";

const host = "127.0.0.1";
const port = 47_631;
const settingsPath = resolve(process.cwd(), "wallpaper-settings.json");
const temporarySettingsPath = `${settingsPath}.tmp`;
const countriesPath = resolve(process.cwd(), "countries.json");

let countries = await loadCountries();
let settings = await loadSettings();
let settingsUpdateQueue = Promise.resolve();

const server = new WebSocketServer({
    host,
    port,
    maxPayload: 16 * 1024,
});

server.on("connection", (socket) => {
    send(socket, { type: "settings.current", settings });

    socket.on("message", async (data, isBinary) => {
        if (isBinary) {
            sendError(socket, "Binary messages are not supported.");
            return;
        }

        try {
            const message = parseClientMessage(data.toString());

            switch (message.type) {
                case "client.hello":
                case "settings.get":
                    send(socket, { type: "settings.current", settings });
                    break;
                case "settings.update":
                    await enqueueSettingsUpdate(message.patch);
                    break;
            }
        } catch (error) {
            sendError(
                socket,
                error instanceof Error ? error.message : "Invalid message.",
            );
        }
    });
});

server.on("listening", () => {
    console.log(`Wallpaper settings host listening on ws://${host}:${port}`);
    console.log(`Settings file: ${settingsPath}`);
});

server.on("error", (error) => {
    console.error("Wallpaper settings host failed:", error);
    process.exitCode = 1;
});

async function loadSettings(): Promise<WallpaperSettings> {
    try {
        const contents = await readFile(settingsPath, "utf8");
        const loadedSettings = normalizeDestinationSettings(
            migrateStoredSettings(JSON.parse(contents)),
            countries,
        );
        await persistSettings(loadedSettings);
        return loadedSettings;
    } catch (error) {
        const isMissingFile = error instanceof Error &&
            "code" in error && error.code === "ENOENT";

        if (!isMissingFile) {
            console.warn("Could not load saved settings; using defaults.", error);
        }

        await persistSettings(defaultWallpaperSettings);
        return defaultWallpaperSettings;
    }
}

async function loadCountries(): Promise<readonly Country[]> {
    const contents = await readFile(countriesPath, "utf8");
    return JSON.parse(contents) as Country[];
}

async function persistSettings(value: WallpaperSettings): Promise<void> {
    await writeFile(
        temporarySettingsPath,
        `${JSON.stringify(value, null, 2)}\n`,
        "utf8",
    );
    await rename(temporarySettingsPath, settingsPath);
}

async function enqueueSettingsUpdate(
    patch: WallpaperSettingsPatch,
): Promise<void> {
    const update = settingsUpdateQueue.then(async () => {
        // The development settings UI can pick up a regenerated catalogue via
        // Vite without restarting this process. Refresh here as well so a new
        // destination is not incorrectly normalised back to All Countries.
        countries = await loadCountries();
        settings = normalizeDestinationSettings(
            validateSettings(mergeSettings(settings, patch)),
            countries,
        );
        await persistSettings(settings);
        broadcast({ type: "settings.current", settings });
    });

    settingsUpdateQueue = update.catch(() => undefined);
    await update;
}

function broadcast(message: SettingsServerMessage): void {
    const json = JSON.stringify(message);
    for (const client of server.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(json);
        }
    }
}

function send(socket: WebSocket, message: SettingsServerMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
    }
}

function sendError(socket: WebSocket, message: string): void {
    send(socket, { type: "settings.error", message });
}

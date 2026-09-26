import { createReadStream } from "node:fs";
import { readFile, rename, stat, writeFile } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import { extname, resolve, sep } from "node:path";

import { WebSocket, WebSocketServer } from "ws";

import type { SettingsServerMessage } from "../src/models/SettingsProtocol.js";
import { parseClientMessage } from "../src/models/SettingsProtocol.js";
import type { Country } from "../src/models/Country.js";
import type {
    WallpaperSettings,
    WallpaperSettingsPatch,
} from "../src/models/WallpaperSettings.js";
import {
    defaultWallpaperSettings,
    mergeSettings,
    migrateStoredSettings,
    normalizeDestinationSettings,
    validateSettings,
} from "../src/models/WallpaperSettings.js";

const host = process.env.WALLPAPER_HOST ?? "127.0.0.1";
const port = parsePort(process.env.WALLPAPER_PORT);
const staticDirectory = process.env.WALLPAPER_STATIC_DIR === undefined
    ? undefined
    : resolve(process.env.WALLPAPER_STATIC_DIR);
const settingsPath = resolve(
    process.env.WALLPAPER_SETTINGS_PATH ?? "wallpaper-settings.json",
);
const temporarySettingsPath = `${settingsPath}.tmp`;
const countriesPath = resolve(
    process.env.WALLPAPER_COUNTRIES_PATH ?? "countries.json",
);

let countries = await loadCountries();
let settings = await loadSettings();
let settingsUpdateQueue = Promise.resolve();

const httpServer = createServer((request, response) => {
    void serveHttpRequest(request.url, request.method, response);
});
const webSocketServer = new WebSocketServer({
    noServer: true,
    maxPayload: 16 * 1024,
});

httpServer.on("upgrade", (request, socket, head) => {
    const pathname = getRequestPathname(request.url);
    if (
        pathname !== "/" &&
        pathname !== "/settings" &&
        pathname !== "/settings-admin"
    ) {
        socket.destroy();
        return;
    }

    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
        webSocketServer.emit("connection", webSocket, request);
    });
});

webSocketServer.on("connection", (socket, request) => {
    const pathname = getRequestPathname(request.url);
    const updatesAllowed = pathname === "/settings-admin" ||
        (pathname === "/" && staticDirectory === undefined);
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
                    if (!updatesAllowed) {
                        sendError(socket, "This connection is read-only.");
                        break;
                    }
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

httpServer.on("listening", () => {
    console.log(`Wallpaper host listening on http://${host}:${port}`);
    if (staticDirectory !== undefined) {
        console.log(`Serving wallpaper files from ${staticDirectory}`);
    }
    console.log(`Settings file: ${settingsPath}`);
});

httpServer.on("error", (error) => {
    console.error("Wallpaper settings host failed:", error);
    process.exitCode = 1;
});

httpServer.listen(port, host);

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
    for (const client of webSocketServer.clients) {
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

async function serveHttpRequest(
    rawUrl: string | undefined,
    method: string | undefined,
    response: ServerResponse,
): Promise<void> {
    if (getRequestPathname(rawUrl) === "/healthz") {
        response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
        response.end("ok\n");
        return;
    }

    if (staticDirectory === undefined) {
        response.writeHead(404);
        response.end();
        return;
    }

    if (method !== "GET" && method !== "HEAD") {
        response.writeHead(405, { allow: "GET, HEAD" });
        response.end();
        return;
    }

    const pathname = getRequestPathname(rawUrl);
    let relativePath: string;
    try {
        relativePath = pathname === "/"
            ? "index.html"
            : decodeURIComponent(pathname).replace(/^\/+/, "");
    } catch {
        response.writeHead(400);
        response.end();
        return;
    }
    const requestedPath = resolve(staticDirectory, relativePath);
    const isWithinStaticDirectory = requestedPath === staticDirectory ||
        requestedPath.startsWith(`${staticDirectory}${sep}`);

    if (!isWithinStaticDirectory) {
        response.writeHead(403);
        response.end();
        return;
    }

    try {
        const fileStats = await stat(requestedPath);
        if (!fileStats.isFile()) {
            response.writeHead(404);
            response.end();
            return;
        }

        response.writeHead(200, {
            "content-type": getContentType(requestedPath),
            "content-length": fileStats.size,
            "cache-control": pathname.startsWith("/assets/")
                ? "public, max-age=31536000, immutable"
                : "no-cache",
        });

        if (method === "HEAD") {
            response.end();
            return;
        }

        createReadStream(requestedPath)
            .on("error", () => response.destroy())
            .pipe(response);
    } catch (error) {
        const isMissingFile = error instanceof Error &&
            "code" in error && error.code === "ENOENT";
        response.writeHead(isMissingFile ? 404 : 500);
        response.end();
    }
}

function getRequestPathname(rawUrl: string | undefined): string {
    try {
        return new URL(rawUrl ?? "/", "http://localhost").pathname;
    } catch {
        return "/";
    }
}

function getContentType(path: string): string {
    const contentTypes: Readonly<Record<string, string>> = {
        ".css": "text/css; charset=utf-8",
        ".gif": "image/gif",
        ".html": "text/html; charset=utf-8",
        ".ico": "image/x-icon",
        ".jpeg": "image/jpeg",
        ".jpg": "image/jpeg",
        ".js": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
    };
    return contentTypes[extname(path).toLowerCase()] ??
        "application/octet-stream";
}

function parsePort(value: string | undefined): number {
    if (value === undefined) {
        return 47_631;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
        throw new Error("WALLPAPER_PORT must be an integer from 1 to 65535.");
    }

    return parsed;
}

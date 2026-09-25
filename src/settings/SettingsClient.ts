import type {
    SettingsClientMessage,
    SettingsClientRole,
} from "../models/SettingsProtocol";
import { parseServerMessage } from "../models/SettingsProtocol";
import type {
    WallpaperSettings,
    WallpaperSettingsPatch,
} from "../models/WallpaperSettings";
import { mergeSettingsPatches } from "../models/WallpaperSettings";

export type ConnectionState = "connected" | "connecting" | "disconnected";

interface SettingsClientOptions {
    readonly url: string;
    readonly role: SettingsClientRole;
    readonly onSettings: (settings: WallpaperSettings) => void;
    readonly onConnectionChange?: (state: ConnectionState) => void;
    readonly onError?: (message: string) => void;
}

export class SettingsClient {
    private readonly options: SettingsClientOptions;
    private socket: WebSocket | undefined;
    private reconnectTimer: number | undefined;
    private reconnectAttempt = 0;
    private stopped = true;
    private pendingPatch: WallpaperSettingsPatch = {};

    constructor(options: SettingsClientOptions) {
        this.options = options;
    }

    public start(): void {
        if (!this.stopped) {
            return;
        }

        this.stopped = false;
        this.connect();
    }

    public stop(): void {
        this.stopped = true;
        window.clearTimeout(this.reconnectTimer);
        this.socket?.close();
        this.socket = undefined;
    }

    public update(patch: WallpaperSettingsPatch): void {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.send({ type: "settings.update", patch });
            return;
        }

        this.pendingPatch = mergeSettingsPatches(this.pendingPatch, patch);
    }

    private connect(): void {
        this.options.onConnectionChange?.("connecting");
        const socket = new WebSocket(this.options.url);
        this.socket = socket;

        socket.addEventListener("open", () => {
            if (this.socket !== socket) {
                return;
            }

            this.reconnectAttempt = 0;
            this.options.onConnectionChange?.("connected");
            this.send({ type: "client.hello", role: this.options.role });
            this.send({ type: "settings.get" });

            if (Object.keys(this.pendingPatch).length > 0) {
                this.send({
                    type: "settings.update",
                    patch: this.pendingPatch,
                });
                this.pendingPatch = {};
            }
        });

        socket.addEventListener("message", (event) => {
            if (typeof event.data !== "string") {
                return;
            }

            try {
                const message = parseServerMessage(event.data);
                if (message.type === "settings.current") {
                    this.options.onSettings(message.settings);
                } else {
                    this.options.onError?.(message.message);
                }
            } catch (error) {
                this.options.onError?.(
                    error instanceof Error ? error.message : "Invalid host message.",
                );
            }
        });

        socket.addEventListener("close", () => {
            if (this.socket !== socket) {
                return;
            }

            this.socket = undefined;
            this.options.onConnectionChange?.("disconnected");
            this.scheduleReconnect();
        });

        socket.addEventListener("error", () => {
            socket.close();
        });
    }

    private scheduleReconnect(): void {
        if (this.stopped) {
            return;
        }

        const delayMs = Math.min(500 * 2 ** this.reconnectAttempt, 5_000);
        this.reconnectAttempt += 1;
        this.reconnectTimer = window.setTimeout(() => this.connect(), delayMs);
    }

    private send(message: SettingsClientMessage): void {
        this.socket?.send(JSON.stringify(message));
    }
}

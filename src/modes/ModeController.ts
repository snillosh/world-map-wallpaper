import type {
    BehaviourModeKind,
    WallpaperSettings,
} from "../models/WallpaperSettings";
import type { WallpaperMode } from "./WallpaperMode";

type ModeRegistry = Readonly<Record<BehaviourModeKind, WallpaperMode>>;

export class ModeController {
    private readonly modes: ModeRegistry;
    private readonly onError: (error: unknown) => void;
    private activeMode: WallpaperMode | undefined;
    private activeAbortController: AbortController | undefined;

    constructor(
        modes: ModeRegistry,
        onError: (error: unknown) => void = console.error,
    ) {
        this.modes = modes;
        this.onError = onError;
    }

    public switchTo(
        kind: BehaviourModeKind,
        settings: WallpaperSettings,
    ): void {
        if (this.activeMode?.kind === kind) {
            this.activeMode.updateSettings(settings);
            return;
        }

        this.stop();

        const mode = this.modes[kind];
        const abortController = new AbortController();
        this.activeMode = mode;
        this.activeAbortController = abortController;

        mode.updateSettings(settings);
        void mode.start(abortController.signal).catch((error: unknown) => {
            if (!abortController.signal.aborted) {
                this.onError(error);
            }
        });
    }

    public updateSettings(settings: WallpaperSettings): void {
        this.activeMode?.updateSettings(settings);
    }

    public stop(): void {
        this.activeAbortController?.abort();
        this.activeAbortController = undefined;
        this.activeMode = undefined;
    }

    public get activeKind(): BehaviourModeKind | undefined {
        return this.activeMode?.kind;
    }
}

import type {
    BehaviourModeKind,
    WallpaperSettings,
} from "../models/WallpaperSettings";

export interface WallpaperMode {
    readonly kind: BehaviourModeKind;
    start(signal: AbortSignal): Promise<void>;
    updateSettings(settings: WallpaperSettings): void;
}

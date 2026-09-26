import { Config } from "../config/Config";
import type { WallpaperSettings } from "../models/WallpaperSettings";
import { defaultWallpaperSettings } from "../models/WallpaperSettings";
import { FlightMode } from "../modes/FlightMode";
import { ExploreMode } from "../modes/ExploreMode";
import { ModeController } from "../modes/ModeController";
import { OrbitMode } from "../modes/OrbitMode";
import { CityService } from "../services/CityService";
import { MapService } from "../services/MapService";
import { SettingsClient } from "../settings/SettingsClient";
import { RouteLabel } from "../ui/RouteLabel";

export class WallpaperApplication {
    private readonly routeLabel = new RouteLabel();
    private readonly errorNotice = requireElement("map-error");
    private readonly mapService = new MapService(
        defaultWallpaperSettings.visual.mapStyle,
        (error) => this.showMapError(error),
    );
    private readonly cityService = new CityService();
    private readonly modeController = new ModeController(
        {
            flight: new FlightMode(
                this.mapService,
                this.cityService,
                this.routeLabel,
            ),
            orbit: new OrbitMode(this.mapService, this.routeLabel),
            explore: new ExploreMode(
                this.mapService,
                this.cityService,
                this.routeLabel,
            ),
        },
        (error) => this.showError(error),
    );
    private readonly settingsClient = new SettingsClient({
        url: Config.settings.webSocketUrl,
        role: "wallpaper",
        onSettings: (settings) => this.applySettings(settings),
        onError: (message) => console.warn("Settings host:", message),
    });

    private settings = defaultWallpaperSettings;
    private ready = false;

    public async run(): Promise<void> {
        this.applySettings(this.settings);
        this.settingsClient.start();

        try {
            this.routeLabel.setText("Loading map…");
            await this.mapService.initialise();

            this.routeLabel.setText("Loading cities…");
            await this.cityService.initialise();

            this.ready = true;
            this.modeController.switchTo(
                this.settings.behaviourMode,
                this.settings,
            );
        } catch (error) {
            this.showError(error);
        }
    }

    private applySettings(settings: WallpaperSettings): void {
        const previousMode = this.settings.behaviourMode;
        this.settings = settings;
        void this.mapService
            .setStyle(settings.visual.mapStyle)
            .then(() => this.clearError())
            .catch((error: unknown) => this.showMapError(error));

        if (!this.ready) {
            return;
        }

        if (settings.behaviourMode !== previousMode) {
            this.modeController.switchTo(settings.behaviourMode, settings);
        } else {
            this.modeController.updateSettings(settings);
        }
    }

    private showError(error: unknown): void {
        const message = error instanceof Error
            ? error.message
            : "Something went wrong.";
        this.showMapError(error);
        this.routeLabel.setVisible(true);
        this.routeLabel.setError(message);
    }

    private showMapError(error: unknown): void {
        console.error(error);
        this.errorNotice.textContent = error instanceof Error
            ? error.message
            : "Something went wrong.";
        this.errorNotice.hidden = false;
    }

    private clearError(): void {
        this.errorNotice.hidden = true;
        this.errorNotice.textContent = "";
    }
}

function requireElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (element === null) {
        throw new Error(`Missing #${id} element.`);
    }
    return element;
}

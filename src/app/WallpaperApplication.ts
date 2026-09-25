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
    private readonly mapService = new MapService(
        defaultWallpaperSettings.visual.mapStyle,
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
        this.mapService.setStyle(settings.visual.mapStyle);

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
        console.error(error);
        this.routeLabel.setVisible(true);
        this.routeLabel.setError(
            error instanceof Error ? error.message : "Something went wrong.",
        );
    }
}

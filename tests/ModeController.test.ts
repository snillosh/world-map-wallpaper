import assert from "node:assert/strict";
import { test } from "node:test";

import type {
    BehaviourModeKind,
    WallpaperSettings,
} from "../src/models/WallpaperSettings";
import {
    defaultWallpaperSettings,
    mergeSettings,
} from "../src/models/WallpaperSettings";
import { ModeController } from "../src/modes/ModeController";
import type { WallpaperMode } from "../src/modes/WallpaperMode";

class FakeMode implements WallpaperMode {
    public readonly kind: BehaviourModeKind;
    public starts = 0;
    public stops = 0;
    public updates: WallpaperSettings[] = [];

    constructor(kind: BehaviourModeKind) {
        this.kind = kind;
    }

    public start(signal: AbortSignal): Promise<void> {
        this.starts += 1;
        return new Promise((resolve) => {
            signal.addEventListener("abort", () => {
                this.stops += 1;
                resolve();
            }, { once: true });
        });
    }

    public updateSettings(settings: WallpaperSettings): void {
        this.updates.push(settings);
    }
}

function createController(): {
    controller: ModeController;
    flight: FakeMode;
    orbit: FakeMode;
    explore: FakeMode;
} {
    const flight = new FakeMode("flight");
    const orbit = new FakeMode("orbit");
    const explore = new FakeMode("explore");
    const controller = new ModeController({ flight, orbit, explore });
    return { controller, flight, orbit, explore };
}

test("starts the selected mode", () => {
    const { controller, flight } = createController();

    controller.switchTo("flight", defaultWallpaperSettings);

    assert.equal(controller.activeKind, "flight");
    assert.equal(flight.starts, 1);
    assert.equal(flight.updates.length, 1);
    controller.stop();
});

test("stops the active mode", () => {
    const { controller, flight } = createController();
    controller.switchTo("flight", defaultWallpaperSettings);

    controller.stop();

    assert.equal(controller.activeKind, undefined);
    assert.equal(flight.stops, 1);
});

test("switches Flight to Orbit and Orbit to Flight", () => {
    const { controller, flight, orbit } = createController();
    controller.switchTo("flight", defaultWallpaperSettings);

    controller.switchTo("orbit", defaultWallpaperSettings);
    assert.equal(flight.stops, 1);
    assert.equal(orbit.starts, 1);

    controller.switchTo("flight", defaultWallpaperSettings);
    assert.equal(orbit.stops, 1);
    assert.equal(flight.starts, 2);
    controller.stop();
});

test("selecting the same mode twice does not start a duplicate", () => {
    const { controller, flight } = createController();
    controller.switchTo("flight", defaultWallpaperSettings);

    controller.switchTo("flight", defaultWallpaperSettings);

    assert.equal(flight.starts, 1);
    assert.equal(flight.stops, 0);
    assert.equal(flight.updates.length, 2);
    controller.stop();
});

test("only the active mode receives later settings", () => {
    const { controller, flight, orbit } = createController();
    controller.switchTo("flight", defaultWallpaperSettings);
    controller.switchTo("orbit", defaultWallpaperSettings);
    const changedSettings = mergeSettings(defaultWallpaperSettings, {
        orbit: { speedDegreesPerMinute: 5 },
    });

    controller.updateSettings(changedSettings);

    assert.equal(flight.updates.length, 1);
    assert.equal(orbit.updates.length, 2);
    assert.equal(
        orbit.updates.at(-1)?.orbit.speedDegreesPerMinute,
        5,
    );
    controller.stop();
});

test("switches Flight and Orbit into Explore and stops each previous mode", () => {
    const { controller, flight, orbit, explore } = createController();

    controller.switchTo("flight", defaultWallpaperSettings);
    controller.switchTo("explore", defaultWallpaperSettings);
    assert.equal(flight.stops, 1);
    assert.equal(explore.starts, 1);

    controller.switchTo("orbit", defaultWallpaperSettings);
    assert.equal(explore.stops, 1);
    controller.switchTo("explore", defaultWallpaperSettings);
    assert.equal(orbit.stops, 1);
    assert.equal(explore.starts, 2);

    controller.switchTo("flight", defaultWallpaperSettings);
    assert.equal(explore.stops, 2);
    controller.stop();
});

test("selecting Explore twice does not create duplicate animation loops", () => {
    const { controller, explore } = createController();
    controller.switchTo("explore", defaultWallpaperSettings);

    controller.switchTo("explore", defaultWallpaperSettings);

    assert.equal(explore.starts, 1);
    assert.equal(explore.stops, 0);
    assert.equal(explore.updates.length, 2);
    controller.stop();
    assert.equal(explore.stops, 1);
});

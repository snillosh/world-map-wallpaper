import assert from "node:assert/strict";
import { test } from "node:test";

import {
    createMoveStage,
    createViewingStage,
    createZoomStage,
    getMoveDurationMs,
    sampleExploreStage,
} from "../src/models/Explore";

test("Moving changes position while keeping zoom exactly fixed", () => {
    const stage = createMoveStage(
        { longitude: 0, latitude: 10, zoom: 3 },
        { longitude: 20, latitude: 30 },
        4_000,
    );
    const state = sampleExploreStage(stage, 0.5);

    assert.notEqual(state.longitude, 0);
    assert.notEqual(state.latitude, 10);
    assert.equal(state.zoom, 3);
});

test("Zooming In and Out change zoom while keeping position exactly fixed", () => {
    for (const kind of ["zooming-in", "zooming-out"] as const) {
        const stage = createZoomStage(kind, {
            longitude: 12,
            latitude: 34,
        }, 3, 8, 6_000);
        const state = sampleExploreStage(stage, 0.5);

        assert.equal(state.longitude, 12);
        assert.equal(state.latitude, 34);
        assert.notEqual(state.zoom, 3);
    }
});

test("Viewing keeps position and zoom exactly fixed", () => {
    const stage = createViewingStage({
        longitude: 12,
        latitude: 34,
        zoom: 8,
    }, 4_000);

    assert.deepEqual(sampleExploreStage(stage, 0.1), {
        longitude: 12,
        latitude: 34,
        zoom: 8,
    });
    assert.deepEqual(sampleExploreStage(stage, 0.9), {
        longitude: 12,
        latitude: 34,
        zoom: 8,
    });
});

test("stage factories retain independently configured durations", () => {
    const zoomIn = createZoomStage(
        "zooming-in",
        { longitude: 0, latitude: 0 },
        3,
        8,
        8_000,
    );
    const view = createViewingStage({ longitude: 0, latitude: 0, zoom: 8 }, 4_000);
    const zoomOut = createZoomStage(
        "zooming-out",
        { longitude: 0, latitude: 0 },
        8,
        3,
        6_000,
    );

    assert.equal(zoomIn.durationMs, 8_000);
    assert.equal(view.durationMs, 4_000);
    assert.equal(zoomOut.durationMs, 6_000);
});

test("longer moves take longer while respecting minimum and maximum caps", () => {
    assert.ok(getMoveDurationMs(1_000) < getMoveDurationMs(5_000));
    assert.equal(getMoveDurationMs(0), 1_500);
    assert.equal(getMoveDurationMs(50_000), 8_000);
});

test("movement crosses the antimeridian by the short route", () => {
    const stage = createMoveStage(
        { longitude: 179, latitude: 0, zoom: 3 },
        { longitude: -179, latitude: 0 },
        2_000,
    );

    assert.equal(stage.kind, "moving");
    if (stage.kind === "moving") {
        assert.equal(stage.toLongitude, 181);
        assert.equal(sampleExploreStage(stage, 0.5).longitude, 180);
    }
});

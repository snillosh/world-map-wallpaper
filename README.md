# Flight Map Wallpaper

<p align="center">
  <img src="screenshots/demo.gif" width="1200" alt="Flight Map Wallpaper Demo">
</p>

This project is a custom live wallpaper for KDE Plasma built with TypeScript and MapLibre.

The idea started because I wanted something similar to Wallpaper Engine on Windows, but native to Linux. Rather than using a video or a pre-rendered animation, the wallpaper renders a live, interactive map in the background and animates flights between cities around the world.

The project runs as an HTML wallpaper using KDE's HTML Wallpaper plugin. It loads a local dataset of world cities, chooses destinations, and smoothly flies the camera between them while adjusting the zoom to simulate takeoff, cruising altitude, and landing.

The goal is to keep the project lightweight, easy to maintain, and enjoyable to extend. As it grows I'd like to experiment with smarter route planning, more cinematic camera movement, different map styles, weather overlays, day and night cycles, and other ideas that make the desktop feel alive.

## Local development

Install dependencies and start the wallpaper, settings UI, and local settings host:

```bash
npm install
npm run dev
```

Open the wallpaper at `http://localhost:5173/` and its separate control panel at
`http://localhost:5173/settings.html`. The host listens only on
`ws://127.0.0.1:47631` and saves the current configuration in the ignored local
file `wallpaper-settings.json`.

The control panel keeps behaviour and appearance separate. Flight, Orbit, and
Explore are behaviour modes; Night, Night + Urban Density, Muted Orange, and
Classic are map styles that work with every behaviour. Each mode retains its
own settings when you switch between them.

Explore behaves like a calm map observer: it zooms into a place, pauses, zooms
straight back out, and only then moves geographically toward its next mostly
regional destination. Geographic movement and zoom never happen at the same
time.

Flight and Explore destinations share Continent and searchable Country
constraints. Countries come from the generated data and are persisted
internally by ISO2 code; changing the selection takes effect after the current
flight or Explore inspection finishes.

Run the mode lifecycle tests with:

```bash
npm test
```

## City data

The committed `cities.json` is a curated runtime dataset generated from the
GeoNames `cities500` export. The wallpaper loads only this prepared JSON; it
does not parse the raw source or contact GeoNames at runtime.

To rebuild it, download `cities500.txt` manually into the repository root and
run:

```bash
npm run generate-city-data
```

The raw text file is intentionally ignored by Git. The generator keeps useful
capitals and administrative centres, balances population with geographic
coverage, caps each country at 250 destinations, writes a compact
`countries.json` catalogue for destination controls, and records generation
details in `cities.metadata.json`. See
[DATA_ATTRIBUTION.md](DATA_ATTRIBUTION.md) for source and licence information.

This project is mainly for fun and as an opportunity to explore TypeScript, animation, and map rendering while building something I'll actually use every day.

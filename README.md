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
Classic are map styles that work with every behaviour. Satellite Light,
Satellite Dark, Satellite Hybrid Light, and Satellite Hybrid Dark are also
available when a MapTiler key is configured. Each mode retains its own settings
when you switch between them.

## MapTiler map styles

Create a browser API key in your
[MapTiler Cloud account](https://cloud.maptiler.com/account/keys/), copy
`.env.example` to `.env`, and set:

```dotenv
VITE_MAPTILER_API_KEY=your-browser-key
```

Restart the development server after changing `.env`. All map themes use
MapTiler-hosted map data; the four custom themes replace the sample key in their
source JSON as they are bundled, while the satellite themes load their provider
styles using the same configured key. Vite intentionally sends `VITE_` values
to the browser, which is expected for a browser map key; restrict the key to the
wallpaper's production URL and local development origins in MapTiler Cloud. The
local `.env` file is ignored by Git and must not be committed.

## Docker deployment

The production image serves the built wallpaper and settings host together on
port `8080`. Its `/data` volume holds `wallpaper-settings.json`, so settings
survive container replacement. Production wallpaper clients use a same-origin
read-only WebSocket at `/settings`; the control panel uses the writable
`/settings-admin` route.

Sign in to Docker Hub, then publish the image from PowerShell:

```powershell
cd Scripts
pwsh ./Publish-DockerImage.ps1
```

The script reads `VITE_MAPTILER_API_KEY` from the ignored root `.env`, passes it
to Docker as a BuildKit secret, builds
`snillosh/world-map-wallpaper:latest`, and pushes the image. The browser key is
necessarily present in the final JavaScript bundle, so its MapTiler HTTP-origin
restrictions remain the real access control.

Server deployment is deliberately separate. The ServerConfiguration repository
pulls the published image through its existing deployment script, exposes the
viewer at `https://wallpaper.bsalter.online`, and keeps the writable control
panel at `http://wallpaper-settings.home/settings.html` on the LAN/VPN only.
The public Caddy route blocks both the control-panel page and writable WebSocket.

The four satellite styles use MapTiler's current Satellite v4 and Hybrid v4
light/dark treatments, then replace their navigation overlays with a small
wallpaper-specific set:

- **Satellite Light / Dark** — completely plain imagery with no labels or
  borders.
- **Satellite Hybrid Light / Dark** — the same imagery-led presentation with
  state, village, island, inland-water, and regional-border context.

None of the satellite styles include roads, street names, POIs, transit layers,
or the Night theme's city glow. They use MapTiler Planet v4 for labels and
borders and MapTiler Terrain RGB v2 for restrained 3D terrain. Satellite imagery
is delivered by MapTiler's provider styles. TileJSON's normal browser cache is
left enabled; the wallpaper adds no extra reload or animation loop.

MapLibre's compact attribution control remains visible so credits supplied by
MapTiler's imagery and data sources are shown. The MapTiler logo is also kept on
screen for free-plan compliance. See MapTiler's
[attribution guidance](https://docs.maptiler.com/guides/map-design/attribution/add-attribution/)
for plan-specific requirements.

Explore behaves like a calm map observer: it zooms into a place, pauses, zooms
straight back out, and only then moves geographically toward its next mostly
regional destination. Geographic movement and zoom never happen at the same
time.

Flight and Explore destinations share Continent and searchable Country
constraints. Countries come from the generated data and are persisted
internally by a stable ISO-derived destination code; changing the selection
takes effect after the current flight or Explore inspection finishes.

The Europe country list also exposes England, Northern Ireland, Scotland, and
Wales individually while retaining United Kingdom as the combined option. The
home nations use their real `GB` country code plus GeoNames administrative
codes, and each is curated independently up to the same 250-location ceiling
as other destinations.

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

# Flight Map Wallpaper

This project is a custom live wallpaper for KDE Plasma built with TypeScript and MapLibre.

The idea started because I wanted something similar to Wallpaper Engine on Windows, but native to Linux. Rather than using a video or a pre-rendered animation, the wallpaper renders a live, interactive map in the background and animates flights between cities around the world.

The project runs as an HTML wallpaper using KDE's HTML Wallpaper plugin. It loads a local dataset of world cities, chooses destinations, and smoothly flies the camera between them while adjusting the zoom to simulate takeoff, cruising altitude, and landing.

The goal is to keep the project lightweight, easy to maintain, and enjoyable to extend. As it grows I'd like to experiment with smarter route planning, more cinematic camera movement, different map styles, weather overlays, day and night cycles, and other ideas that make the desktop feel alive.

This project is mainly for fun and as an opportunity to explore TypeScript, animation, and map rendering while building something I'll actually use every day.

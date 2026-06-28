import csv
import json
from pathlib import Path

BASE = Path.home() / ".local/share/live-map-wallpaper"
INPUT = BASE / "worldcities.csv"
OUTPUT = BASE / "cities.json"

MIN_POPULATION = 250_000

cities = []

with INPUT.open("r", encoding="utf-8-sig", newline="") as f:
    reader = csv.DictReader(f)

    for row in reader:
        population_text = row.get("population") or "0"

        try:
            population = int(float(population_text))
        except ValueError:
            population = 0

        if population < MIN_POPULATION:
            continue

        try:
            lat = float(row["lat"])
            lng = float(row["lng"])
        except ValueError:
            continue

        cities.append({
            "city": row["city_ascii"] or row["city"],
            "country": row["country"],
            "iso2": row["iso2"],
            "lat": lat,
            "lng": lng,
            "population": population,
            "capital": row["capital"]
        })

cities.sort(key=lambda c: c["population"], reverse=True)

with OUTPUT.open("w", encoding="utf-8") as f:
    json.dump(cities, f, ensure_ascii=False, indent=2)

print(f"Wrote {len(cities)} cities to {OUTPUT}")
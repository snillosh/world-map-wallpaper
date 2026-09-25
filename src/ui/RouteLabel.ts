import type { FlightPhaseKind } from "../models/Flight";

export class RouteLabel {
    private readonly element: HTMLElement;
    private route = "";
    private phase = "";

    constructor() {
        const element = document.getElementById("route-label");

        if (!(element instanceof HTMLElement)) {
            throw new Error("Could not find #route-label.");
        }

        this.element = element;
    }

    public setLoading(cityCount: number): void {
        this.element.textContent = `Loaded ${cityCount} cities`;
    }

    public setRoute(
        fromCity: string,
        fromCountry: string,
        toCity: string,
        toCountry: string,
    ): void {
        this.route = `${fromCity}, ${fromCountry} → ${toCity}, ${toCountry}`;
        this.phase = "";
        this.render();
    }

    public setPhase(phase: FlightPhaseKind): void {
        this.phase = phase.charAt(0).toUpperCase() + phase.slice(1);
        this.render();
    }

    public setError(message: string): void {
        this.element.textContent = message;
    }

    public setText(text: string): void {
        this.element.textContent = text;
    }

    private render(): void {
        this.element.textContent = this.phase
            ? `${this.route} · ${this.phase}`
            : this.route;
    }
}

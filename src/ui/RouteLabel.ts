export class RouteLabel {
    private readonly element: HTMLElement;

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
        this.element.textContent =
            `${fromCity}, ${fromCountry} → ${toCity}, ${toCountry}`;
    }

    public setError(message: string): void {
        this.element.textContent = message;
    }

    public setText(text: string): void {
        this.element.textContent = text;
    }
}
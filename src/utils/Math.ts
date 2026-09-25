export function lerp(start: number, end: number, amount: number): number {
    return start + (end - start) * amount;
}

export function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), maximum);
}

export function smoothstep(progress: number): number {
    const amount = clamp(progress, 0, 1);
    return amount * amount * (3 - 2 * amount);
}

export function smoothstepIntegral(progress: number): number {
    const amount = clamp(progress, 0, 1);
    return amount ** 3 - 0.5 * amount ** 4;
}

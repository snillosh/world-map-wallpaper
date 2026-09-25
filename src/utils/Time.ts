export function sleep(
    milliseconds: number,
    signal?: AbortSignal,
): Promise<void> {
    return new Promise((resolve) => {
        if (signal?.aborted) {
            resolve();
            return;
        }

        const timer = window.setTimeout(finish, milliseconds);

        signal?.addEventListener("abort", finish, { once: true });

        function finish(): void {
            window.clearTimeout(timer);
            signal?.removeEventListener("abort", finish);
            resolve();
        }
    });
}

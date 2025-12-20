export function init_debug_mode(debug_log: [Level, string][]) {
    console.log("OVERRIDDING DEFAULT CONSOLE.LOG HANDLERS")

    const original = {
        log: console.log,
        warn: console.warn,
        error: console.error,
    };
    function log_to_debug_console(level: Level, args: unknown[]) {
        const line = args
            .map(a =>
                typeof a === 'string'
                    ? a
                    : (() => {
                        try {
                            return JSON.stringify(a);
                        } catch {
                            return String(a);
                        }
                    })()
            )
            .join(' ');

        debug_log.push([level, line])
    }

    console.log = (...args: unknown[]) => {
        original.log(...args);
        log_to_debug_console(Level.INFO, args);
    };

    console.warn = (...args: unknown[]) => {
        original.warn(...args);
        log_to_debug_console(Level.WARN, args);
    };

    console.error = (...args: unknown[]) => {
        original.error(...args);
        log_to_debug_console(Level.ERROR, args);
    };

}

export enum Level {
    INFO,
    WARN,
    ERROR
}


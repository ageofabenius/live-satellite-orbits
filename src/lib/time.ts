/** Format a duration as [Dd ]Hh Mm Ss */
export function format_duration(duration_seconds: number): string {
    const days = Math.floor(duration_seconds / 86_400);
    let remainder_seconds = duration_seconds % 86_400;

    const hours = Math.floor(remainder_seconds / 3600);
    remainder_seconds = remainder_seconds % 3600;

    const minutes = Math.floor(remainder_seconds / 60);
    remainder_seconds = remainder_seconds % 60;

    const seconds = Math.floor(remainder_seconds);

    let s = [];
    if (days >= 1) {
        s.push(`${days}d`);
    }
    s.push(`${hours}h`);
    s.push(`${minutes}m`);
    s.push(`${seconds}s`);

    return s.join(' ');
}
interface Position {
    x: number;
    y: number;
    bounds: string;
}

function getCenterFromBounds(bounds: string): Position {
    const match = bounds.match(
        /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/
    );

    if (!match) {
        throw new Error(`Invalid bounds: ${bounds}`);
    }

    const [, left, top, right, bottom] = match.map(Number);

    return {
        x: Math.round((left + right) / 2),
        y: Math.round((top + bottom) / 2),
        bounds,
    };
}

function findElementPosition(
    xml: string,
    contentDesc: string
): Position | null {
    const escaped = contentDesc.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );

    const regex = new RegExp(
        `content-desc="${escaped}"[^>]*bounds="([^"]+)"`,
        "i"
    );

    const match = xml.match(regex);

    if (!match) {
        return null;
    }

    return getCenterFromBounds(match[1]);
}
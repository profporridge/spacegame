import { COLOR_NAMES } from '../constants.js';

/**
 * Parses a color string or number into a standardized format.
 * Supports:
 * - Numbers (hex colors)
 * - Hex strings (#ffffff)
 * - RGB/RGBA strings (rgb(255, 255, 255) or rgba(255, 255, 255, 0.5))
 * - Color names (from COLOR_NAMES)
 * 
 * @param {string|number} colorInput - Color string or number to parse
 * @returns {{hex: number, alpha: number, r: number, g: number, b: number}} Parsed color with hex, alpha, and RGB components
 */
export function parseRgba(colorInput) {
    // Handle numbers (already hex values)
    if (typeof colorInput === 'number') {
        const r = (colorInput >> 16) & 0xFF;
        const g = (colorInput >> 8) & 0xFF;
        const b = colorInput & 0xFF;
        return { hex: colorInput, alpha: 1, r, g, b };
    }

    // Handle color names via COLOR_NAMES lookup
    if (typeof COLOR_NAMES[colorInput.toLowerCase()] !== 'undefined') {
        return parseRgba(COLOR_NAMES[colorInput.toLowerCase()]);
    }

    // Handle hex strings (#ffffff)
    if (colorInput.startsWith('#')) {
        const hex = parseInt(colorInput.substring(1), 16);
        const r = (hex >> 16) & 0xFF;
        const g = (hex >> 8) & 0xFF;
        const b = hex & 0xFF;
        return { hex, alpha: 1, r, g, b };
    }

    // Handle RGB/RGBA strings
    const match = colorInput.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!match) {
        console.warn('Invalid color string, defaulting to gray:', colorInput);
        return { hex: 0x808080, alpha: 1, r: 128, g: 128, b: 128 }; // Default to gray if parsing fails
    }

    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    const alpha = match[4] !== undefined ? parseFloat(match[4]) : 1;
    const hex = (r << 16) + (g << 8) + b;

    return { hex, alpha, r, g, b };
}


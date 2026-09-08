/**
 * Universal financial and temporal formatting utilities for BayesMarket.
 * Ensures consistent tabular presentation (font-feature-settings: "tnum" 1)
 * and eliminates duplicate parsing/rounding logic across views (DRY & KISS).
 */

/**
 * Formats a USDC monetary quantity into a standard currency string (e.g. "$1,000.00").
 */
export function formatUSDC(val: string | number | null | undefined, fractionDigits = 2): string {
    if (val === null || val === undefined || val === '') {
        return '$0.00';
    }
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) {
        return '$0.00';
    }
    return `$${num.toLocaleString('en-US', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits
    })}`;
}

/**
 * Formats an outcome share balance into a localized quantity string (e.g. "1,250.00").
 */
export function formatShares(val: string | number | null | undefined, fractionDigits = 2): string {
    if (val === null || val === undefined || val === '') {
        return '0.00';
    }
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) {
        return '0.00';
    }
    return num.toLocaleString('en-US', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits
    });
}

/**
 * Formats a unit probability price (e.g. 0.7200) into a standard price string (e.g. "$0.7200" or "72¢").
 */
export function formatPrice(val: string | number | null | undefined, fractionDigits = 4): string {
    if (val === null || val === undefined || val === '') {
        return '$0.0000';
    }
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) {
        return '$0.0000';
    }
    return `$${num.toFixed(fractionDigits)}`;
}

/**
 * Formats a probability or price into a percentage string (e.g. 0.72 -> "72%", or "72.5%").
 */
export function formatPercent(val: string | number | null | undefined, decimals = 0): string {
    if (val === null || val === undefined || val === '') {
        return '0%';
    }
    let num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) {
        return '0%';
    }
    // If given as probability 0.0 - 1.0, scale up to percentage
    if (num <= 1.0 && num >= -1.0 && num !== 0) {
        num = num * 100;
    }
    return `${num.toFixed(decimals)}%`;
}

/**
 * Formats an ISO-8601 timestamp string into a localized time string (e.g. "10:42:15 AM").
 */
export function formatTimestamp(isoStr?: string | null): string {
    if (!isoStr) {
        return 'just now';
    }
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) {
        return 'just now';
    }
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

import { Prisma } from '@prisma/client';

/**
 * Convert a Prisma Decimal to a JS number (for API serialization)
 */
export function decimalToNumber(d: Prisma.Decimal | null | undefined): number | null {
  if (d == null) return null;
  return d.toNumber();
}

/**
 * Convert a JS number to a Prisma Decimal (for DB writes)
 */
export function numberToDecimal(n: number | null | undefined): Prisma.Decimal | null {
  if (n == null) return null;
  return new Prisma.Decimal(n);
}

/**
 * Recursively serialize all Decimal instances in an object to numbers.
 * Used as a JSON replacer or in response middleware.
 */
export function serializeDecimals(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  // Prisma.Decimal instances have ._isDecimal = true (from decimal.js)
  if (typeof obj === 'object' && (obj as any)._isDecimal === true) {
    return parseFloat((obj as any).toString());
  }
  if (Array.isArray(obj)) return obj.map(serializeDecimals);
  if (typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, serializeDecimals(v)])
    );
  }
  return obj;
}

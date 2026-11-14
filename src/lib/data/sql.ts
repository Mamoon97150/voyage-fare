/**
 * The generated types don't know a function argument can be SQL null (they only see its type).
 * Our functions do take null on purpose (no place, no package, no date): say so in one place.
 */
export const sqlNull = <T,>(value: T | null) => value as T

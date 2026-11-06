const isBlank = (v: unknown) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/** Fields that fall back to a server default when cleared, instead of being stored as empty. */
const SERVER_DEFAULTED = new Set(['country', 'invoiceNumberPrefix']);

/**
 * Company profile as the API expects it: a cleared optional field is sent as null (an empty
 * string fails validation, e.g. for Email), and a cleared country or invoice prefix is left out
 * so the server default applies.
 */
export function toSavePayload<T extends object>(form: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(form)) {
    if (typeof v !== 'string' || v.trim() !== '') out[k] = v;
    else if (!SERVER_DEFAULTED.has(k)) out[k] = null;
  }
  return out as T;
}

/** `form` with its blank fields taken from `server`; fields the user filled stay as typed. */
export function fillBlanks<T extends object>(form: T, server: T): T {
  const out: Record<string, unknown> = { ...(form as Record<string, unknown>) };
  for (const [k, v] of Object.entries(server)) if (isBlank(out[k]) && !isBlank(v)) out[k] = v;
  return out as T;
}

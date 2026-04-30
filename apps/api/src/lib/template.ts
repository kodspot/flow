/**
 * Tiny safe template engine — replaces {{key}} and {{#each items}}…{{/each}}
 * No eval. HTML-escapes all interpolated values.
 */

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getPath(ctx: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, ctx);
}

export function renderTemplate(template: string, ctx: Record<string, unknown>): string {
  // {{#each items}}...{{/each}}
  let out = template.replace(
    /\{\{#each\s+([\w.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_m, listKey: string, body: string) => {
      const list = getPath(ctx, listKey);
      if (!Array.isArray(list)) return '';
      return list
        .map((item, idx) =>
          renderTemplate(body, { ...ctx, this: item, '@index': idx, '@number': idx + 1, ...item }),
        )
        .join('');
    },
  );

  // {{#if key}}...{{/if}}
  out = out.replace(
    /\{\{#if\s+([\w.]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g,
    (_m, key: string, truthy: string, falsy = '') => {
      const v = getPath(ctx, key);
      return v ? truthy : falsy;
    },
  );

  // {{{raw}}}  — unescaped (use sparingly, only for trusted SVG/logo)
  out = out.replace(/\{\{\{([\w.]+)\}\}\}/g, (_m, key: string) => {
    const v = getPath(ctx, key);
    return v == null ? '' : String(v);
  });

  // {{key}} — escaped
  out = out.replace(/\{\{([\w.@]+)\}\}/g, (_m, key: string) => escapeHtml(getPath(ctx, key)));

  return out;
}

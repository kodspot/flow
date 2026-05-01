/**
 * Tiny safe template engine — replaces {{key}}, {{#if x}}…{{/if}} (with nesting),
 * and {{#each items}}…{{/each}} (with nesting). HTML-escapes all interpolated
 * values. No eval.
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

/**
 * Replace innermost block-helper instances first ({{#each}} / {{#if}}) so
 * that nested blocks render correctly. We iterate until no innermost block
 * (i.e. one whose body contains no further opening tag) remains.
 */
function replaceBlocks(input: string, ctx: Record<string, unknown>): string {
  let prev: string;
  let out = input;
  // Innermost {{#each ...}}…{{/each}} — body must not contain another {{#each
  const eachRe =
    /\{\{#each\s+([\w.]+)\}\}((?:(?!\{\{#each\s)[\s\S])*?)\{\{\/each\}\}/;
  // Innermost {{#if ...}}…[{{else}}…]{{/if}} — body must not contain another {{#if
  const ifRe =
    /\{\{#if\s+([\w.]+)\}\}((?:(?!\{\{#if\s)[\s\S])*?)(?:\{\{else\}\}((?:(?!\{\{#if\s)[\s\S])*?))?\{\{\/if\}\}/;
  do {
    prev = out;
    out = out.replace(eachRe, (_m, listKey: string, body: string) => {
      const list = getPath(ctx, listKey);
      if (!Array.isArray(list)) return '';
      return list
        .map((item, idx) =>
          renderTemplate(body, {
            ...ctx,
            this: item,
            '@index': idx,
            '@number': idx + 1,
            ...item,
          }),
        )
        .join('');
    });
    out = out.replace(ifRe, (_m, key: string, truthy: string, falsy = '') => {
      const v = getPath(ctx, key);
      return v ? truthy : falsy;
    });
  } while (out !== prev);
  return out;
}

export function renderTemplate(template: string, ctx: Record<string, unknown>): string {
  let out = replaceBlocks(template, ctx);

  // {{{raw}}} — unescaped (used for trusted SVG/logo only)
  out = out.replace(/\{\{\{([\w.]+)\}\}\}/g, (_m, key: string) => {
    const v = getPath(ctx, key);
    return v == null ? '' : String(v);
  });

  // {{key}} — escaped
  out = out.replace(/\{\{([\w.@]+)\}\}/g, (_m, key: string) => escapeHtml(getPath(ctx, key)));

  return out;
}

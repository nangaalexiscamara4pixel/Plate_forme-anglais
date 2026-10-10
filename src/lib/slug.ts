/** Slug ASCII lisible (« Les verbes irréguliers » → « les-verbes-irreguliers »). */
export function slugify(input: string): string {
  const slug = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return slug || "item";
}

/** Rend un slug unique parmi `taken` en ajoutant -2, -3… */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  if (!set.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base.slice(0, 56)}-${i}`;
    if (!set.has(candidate)) return candidate;
  }
}

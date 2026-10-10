/** Clé de traduction d'une action d'audit (next-intl interdit le « . » dans une clé). */
export function actionKey(action: string): string {
  return action.replaceAll(".", "_");
}

/**
 * Résumé lisible des métadonnées d'une entrée d'audit (sans jamais afficher de secret :
 * les métadonnées n'en contiennent pas par construction).
 */
export function auditDetails(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof m.from === "string" || typeof m.to === "string") parts.push(`${m.from ?? "—"} → ${m.to ?? "—"}`);
  if (typeof m.levelCode === "string") parts.push(m.levelCode);
  if (typeof m.mode === "string") parts.push(m.mode);
  if (typeof m.method === "string") parts.push(m.method);
  if (typeof m.count === "number") parts.push(`n = ${m.count}`);
  if (typeof m.reason === "string" && m.reason) parts.push(`« ${m.reason} »`);
  if (m.filters && typeof m.filters === "object") {
    const f = Object.entries(m.filters as Record<string, unknown>).filter(([, v]) => v !== undefined && v !== null && v !== "");
    if (f.length) parts.push(f.map(([k, v]) => `${k}=${String(v)}`).join(", "));
  }
  return parts.length ? parts.join(" · ") : null;
}

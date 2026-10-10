import "server-only";
import { isAPIError } from "better-auth/api";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { logger } from "@/server/logger";
import { AuthorizationError } from "@/server/dal/guards";

/**
 * Résultat uniforme des Server Actions. `error` est une clé de traduction
 * (namespace "errors") : on n'expose jamais de détail technique au client.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[] | undefined>;
      /** Valeurs non sensibles renvoyées pour pré-remplir le formulaire après une erreur. */
      values?: Record<string, string>;
    };

export function fail(error: string, fieldErrors?: Record<string, string[] | undefined>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/** Champs jamais renvoyés au client, même en cas d'erreur. */
const SENSITIVE_FIELDS = new Set(["password", "newPassword", "token", "code", "consent"]);

function echoValues(data: unknown): Record<string, string> | undefined {
  if (!data || typeof data !== "object") return undefined;
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!SENSITIVE_FIELDS.has(key) && !key.startsWith("$") && typeof value === "string") values[key] = value.slice(0, 500);
  }
  return values;
}

function withValues<T>(result: ActionResult<T>, data: unknown): ActionResult<T> {
  return result.ok ? result : { ...result, values: echoValues(data) };
}

/**
 * Enveloppe une Server Action : validation Zod de l'entrée, puis exécution du handler.
 * Les erreurs d'autorisation et d'API sont converties en clés d'erreur ; les redirections
 * Next.js sont propagées ; toute autre erreur est journalisée et masquée.
 */
export function createAction<S extends z.ZodType, T = undefined>(
  schema: S,
  handler: (input: z.infer<S>) => Promise<ActionResult<T>>,
) {
  return async (_prev: ActionResult<T> | null, raw: FormData | z.input<S>): Promise<ActionResult<T>> => {
    const data = raw instanceof FormData ? Object.fromEntries(raw.entries()) : raw;
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      return withValues(fail("validation", z.flattenError(parsed.error).fieldErrors as Record<string, string[]>), data);
    }
    try {
      return withValues(await handler(parsed.data), data);
    } catch (err) {
      unstable_rethrow(err); // redirections / notFound de Next.js
      if (err instanceof AuthorizationError) return fail(err.code === "READ_ONLY" ? "readOnly" : "forbidden");
      if (isAPIError(err)) {
        if (err.statusCode === 429) return withValues(fail("tooManyAttempts"), data);
        logger.warn(
          { status: err.status, code: (err.body as { code?: string } | undefined)?.code },
          "erreur d'API d'authentification",
        );
        return withValues(fail("generic"), data);
      }
      logger.error({ err }, "erreur inattendue dans une Server Action");
      return withValues(fail("generic"), data);
    }
  };
}

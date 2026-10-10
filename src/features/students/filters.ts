import { z } from "zod";

/** Filtres de la liste des étudiants — partagés par la page, l'export CSV et les tests. */
export const PAGE_SIZE = 20;

export const studentFiltersSchema = z.object({
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => v || undefined),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "SUSPENDED"]).optional().catch(undefined),
  level: z.enum(["A1", "A2", "B1", "B2"]).optional().catch(undefined),
  sort: z.enum(["recent", "oldest", "name", "lastLogin"]).default("recent").catch("recent"),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});

export type StudentFilters = z.infer<typeof studentFiltersSchema>;

export function parseStudentFilters(params: Record<string, string | string[] | undefined>): StudentFilters {
  const flat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  return studentFiltersSchema.parse(flat);
}

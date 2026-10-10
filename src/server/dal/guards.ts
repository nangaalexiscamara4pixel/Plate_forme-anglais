import "server-only";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { decideAdminArea, decideGate, decideStudentArea, type AccessDecision } from "./access";
import { getViewer, type Viewer } from "./viewer";

export class AuthorizationError extends Error {
  constructor(public readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "READ_ONLY" = "FORBIDDEN") {
    super(code);
  }
}

async function enforce(decision: AccessDecision): Promise<void> {
  if (decision.allow) return;
  if ("notFound" in decision) notFound();
  redirect({ href: decision.redirectTo, locale: await getLocale() });
}

/** Pages : utilisateur connecté (quel que soit son statut). */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) await enforce({ allow: false, redirectTo: "/sign-in" });
  return viewer!;
}

/** Pages de l'espace étudiant. */
export async function requireApprovedStudent(): Promise<Viewer> {
  const viewer = await getViewer();
  await enforce(decideStudentArea(viewer));
  return viewer!;
}

/** Pages du back-office. */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  await enforce(decideAdminArea(viewer));
  return viewer!;
}

/** Pages portail (/pending, /account-status). */
export async function requireGate(page: "pending" | "account-status"): Promise<Viewer> {
  const viewer = await getViewer();
  await enforce(decideGate(viewer, page));
  return viewer!;
}

// ── Variantes pour Server Actions et routes API : lèvent une erreur au lieu de rediriger ──

export async function assertApprovedStudent(opts: { mutation?: boolean } = {}): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new AuthorizationError("UNAUTHENTICATED");
  if (!decideStudentArea(viewer).allow) throw new AuthorizationError("FORBIDDEN");
  // Impersonation en lecture seule : l'administrateur voit, mais ne modifie rien.
  if (opts.mutation && viewer.impersonatedBy) throw new AuthorizationError("READ_ONLY");
  return viewer;
}

export async function assertAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new AuthorizationError("UNAUTHENTICATED");
  if (!decideAdminArea(viewer).allow) throw new AuthorizationError("FORBIDDEN");
  return viewer;
}

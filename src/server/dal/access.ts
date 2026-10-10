import type { AccountStatus, Role } from "@/generated/prisma/client";

/**
 * Règles d'accès PURES (sans I/O) — testées unitairement, et utilisées par les gardes.
 * Chaque fonction renvoie la décision à appliquer pour une zone de l'application.
 */
export type AccessDecision =
  | { allow: true }
  | { allow: false; redirectTo: string }
  | { allow: false; notFound: true };

/** Durée maximale d'une session administrateur (12 h), quelle que soit l'activité. */
export const ADMIN_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

type Subject = {
  role: Role;
  status: AccountStatus;
  twoFactorEnabled: boolean;
  impersonatedBy: string | null;
  sessionCreatedAt: Date;
} | null;

/** Où envoyer un compte qui n'est pas (ou plus) autorisé à entrer. */
export function gateFor(status: AccountStatus): string {
  return status === "PENDING" ? "/pending" : "/account-status";
}

/** Espace étudiant : compte APPROUVÉ uniquement (ou admin en mode « voir en tant que »). */
export function decideStudentArea(s: Subject): AccessDecision {
  if (!s) return { allow: false, redirectTo: "/sign-in" };
  if (s.role === "ADMIN") return { allow: false, redirectTo: "/admin" };
  if (s.status !== "APPROVED") return { allow: false, redirectTo: gateFor(s.status) };
  return { allow: true };
}

/** Back-office : rôle ADMIN, 2FA activée, session de moins de 12 h. */
export function decideAdminArea(s: Subject, now = new Date()): AccessDecision {
  if (!s) return { allow: false, redirectTo: "/sign-in" };
  // Un étudiant (ou une session d'impersonation) ne doit même pas apprendre que la zone existe.
  if (s.role !== "ADMIN" || s.impersonatedBy) return { allow: false, notFound: true };
  if (now.getTime() - s.sessionCreatedAt.getTime() > ADMIN_SESSION_MAX_AGE_MS) {
    return { allow: false, redirectTo: "/sign-in?reason=expired" };
  }
  if (!s.twoFactorEnabled) return { allow: false, redirectTo: "/setup-2fa" };
  return { allow: true };
}

/** Pages « portail » (/pending, /account-status) : connecté mais non approuvé. */
export function decideGate(s: Subject, page: "pending" | "account-status"): AccessDecision {
  if (!s) return { allow: false, redirectTo: "/sign-in" };
  if (s.role === "ADMIN") return { allow: false, redirectTo: "/admin" };
  if (s.status === "APPROVED") return { allow: false, redirectTo: "/app" };
  const expected = gateFor(s.status) === "/pending" ? "pending" : "account-status";
  if (expected !== page) return { allow: false, redirectTo: `/${expected}` };
  return { allow: true };
}

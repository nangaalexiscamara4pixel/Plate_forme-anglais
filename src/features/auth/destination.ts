import type { AccountStatus, Role } from "@/generated/prisma/client";
import { gateFor } from "@/server/dal/access";

/** Page d'arrivée après connexion, selon le rôle et le statut du compte. */
export function destinationFor(
  user: { role: Role; status: AccountStatus; twoFactorEnabled: boolean | null },
  next?: string,
): string {
  if (user.role === "ADMIN") {
    if (!user.twoFactorEnabled) return "/setup-2fa";
    return next?.startsWith("/admin") ? next : "/admin";
  }
  if (user.status !== "APPROVED") return gateFor(user.status);
  return next?.startsWith("/app") ? next : "/app";
}

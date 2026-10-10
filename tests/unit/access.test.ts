import { describe, expect, it } from "vitest";
import { destinationFor } from "@/features/auth/destination";
import { ADMIN_SESSION_MAX_AGE_MS, decideAdminArea, decideGate, decideStudentArea } from "@/server/dal/access";

const now = new Date("2026-10-10T12:00:00Z");
const fresh = new Date(now.getTime() - 60_000);

const student = (status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED", extra = {}) => ({
  role: "STUDENT" as const,
  status,
  twoFactorEnabled: false,
  impersonatedBy: null,
  sessionCreatedAt: fresh,
  ...extra,
});
const admin = (extra = {}) => ({
  role: "ADMIN" as const,
  status: "APPROVED" as const,
  twoFactorEnabled: true,
  impersonatedBy: null,
  sessionCreatedAt: fresh,
  ...extra,
});

describe("espace étudiant", () => {
  it("refuse un visiteur non connecté", () => {
    expect(decideStudentArea(null)).toEqual({ allow: false, redirectTo: "/sign-in" });
  });

  it.each([
    ["PENDING", "/pending"],
    ["REJECTED", "/account-status"],
    ["SUSPENDED", "/account-status"],
  ] as const)("bloque un compte %s", (status, redirectTo) => {
    expect(decideStudentArea(student(status))).toEqual({ allow: false, redirectTo });
  });

  it("autorise un compte APPROVED", () => {
    expect(decideStudentArea(student("APPROVED"))).toEqual({ allow: true });
  });

  it("autorise l'admin en impersonation (session au nom de l'étudiant)", () => {
    expect(decideStudentArea(student("APPROVED", { impersonatedBy: "admin-id" }))).toEqual({ allow: true });
  });

  it("renvoie l'admin vers le back-office", () => {
    expect(decideStudentArea(admin())).toEqual({ allow: false, redirectTo: "/admin" });
  });
});

describe("back-office", () => {
  it("répond 404 à un étudiant, même approuvé (la zone n'est pas révélée)", () => {
    expect(decideAdminArea(student("APPROVED"), now)).toEqual({ allow: false, notFound: true });
  });

  it("répond 404 pendant une impersonation", () => {
    expect(decideAdminArea(admin({ impersonatedBy: "x" }), now)).toEqual({ allow: false, notFound: true });
  });

  it("impose la double authentification à l'admin", () => {
    expect(decideAdminArea(admin({ twoFactorEnabled: false }), now)).toEqual({ allow: false, redirectTo: "/setup-2fa" });
  });

  it("expire une session admin de plus de 12 h", () => {
    const old = new Date(now.getTime() - ADMIN_SESSION_MAX_AGE_MS - 1);
    expect(decideAdminArea(admin({ sessionCreatedAt: old }), now)).toEqual({
      allow: false,
      redirectTo: "/sign-in?reason=expired",
    });
  });

  it("autorise un admin avec 2FA et session récente", () => {
    expect(decideAdminArea(admin(), now)).toEqual({ allow: true });
  });
});

describe("pages portail", () => {
  it("envoie un compte approuvé vers l'espace étudiant", () => {
    expect(decideGate(student("APPROVED"), "pending")).toEqual({ allow: false, redirectTo: "/app" });
  });
  it("affiche /pending à un compte en attente", () => {
    expect(decideGate(student("PENDING"), "pending")).toEqual({ allow: true });
  });
  it("redirige un compte suspendu de /pending vers /account-status", () => {
    expect(decideGate(student("SUSPENDED"), "pending")).toEqual({ allow: false, redirectTo: "/account-status" });
  });
});

describe("destination après connexion", () => {
  it("n'accepte un `next` que dans la zone autorisée", () => {
    expect(destinationFor({ role: "STUDENT", status: "APPROVED", twoFactorEnabled: false }, "/admin")).toBe("/app");
    expect(destinationFor({ role: "STUDENT", status: "APPROVED", twoFactorEnabled: false }, "/app/learn")).toBe("/app/learn");
    expect(destinationFor({ role: "STUDENT", status: "PENDING", twoFactorEnabled: false }, "/app")).toBe("/pending");
    expect(destinationFor({ role: "ADMIN", status: "APPROVED", twoFactorEnabled: false })).toBe("/setup-2fa");
  });
});

import { describe, expect, it } from "vitest";
import { canTransition } from "@/features/approval/service";
import { nextPathSchema, passwordSchema, signUpSchema } from "@/features/auth/schemas";
import { decrypt, encrypt } from "@/server/crypto";
import { hashPassword, verifyPassword } from "@/server/password";
import { lockDurationMinutes } from "@/server/security/lockout";

describe("redirections internes (anti open-redirect)", () => {
  it.each(["/app", "/app/learn?x=1", "/admin/students"])("accepte %s", (p) => {
    expect(nextPathSchema.parse(p)).toBe(p);
  });
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "app"])(
    "rejette %s",
    (p) => {
      expect(nextPathSchema.parse(p)).toBeUndefined();
    },
  );
});

describe("politique de mot de passe", () => {
  it("exige 12 caractères et un mélange", () => {
    expect(passwordSchema.safeParse("short1!").success).toBe(false);
    expect(passwordSchema.safeParse("onlylettersherexx").success).toBe(false);
    expect(passwordSchema.safeParse("Violet-Harbour-42").success).toBe(true);
  });
});

describe("inscription", () => {
  const valid = {
    name: "Amina",
    whatsapp: "+221 77 123 45 67",
    email: "  Amina@Example.TEST ",
    password: "Violet-Harbour-42",
    timezone: "Africa/Dakar",
    locale: "fr",
    consent: "on",
  };
  it("normalise l'email", () => {
    expect(signUpSchema.parse(valid).email).toBe("amina@example.test");
  });
  it("exige le consentement RGPD", () => {
    expect(signUpSchema.safeParse({ ...valid, consent: undefined }).success).toBe(false);
  });
  it("normalise le numéro WhatsApp au format international", () => {
    expect(signUpSchema.parse(valid).whatsapp).toBe("+221771234567");
    expect(signUpSchema.parse({ ...valid, whatsapp: "00 33 (6) 12-34-56-78" }).whatsapp).toBe("+33612345678");
  });
  it("exige un numéro WhatsApp avec indicatif", () => {
    for (const whatsapp of [undefined, "", "06 12 34 56 78", "+0612345678", "+33 abc", "+1234"]) {
      expect(signUpSchema.safeParse({ ...valid, whatsapp }).success).toBe(false);
    }
  });
  it("rejette un fuseau horaire inventé", () => {
    expect(signUpSchema.safeParse({ ...valid, timezone: "Mars/Olympus" }).success).toBe(false);
  });
});

describe("Argon2id", () => {
  it("hache et vérifie", async () => {
    const digest = await hashPassword("Violet-Harbour-42");
    expect(digest.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword({ hash: digest, password: "Violet-Harbour-42" })).toBe(true);
    expect(await verifyPassword({ hash: digest, password: "wrong-password-00" })).toBe(false);
    expect(await verifyPassword({ hash: "garbage", password: "x" })).toBe(false);
  });
});

describe("chiffrement AES-256-GCM", () => {
  it("chiffre de façon non déterministe et déchiffre", () => {
    const url = "https://meet.google.com/abc-defg-hij";
    const a = encrypt(url);
    expect(a).not.toContain("meet.google.com");
    expect(encrypt(url)).not.toBe(a);
    expect(decrypt(a)).toBe(url);
  });
  it("détecte une altération", () => {
    const [iv, tag, ct] = encrypt("secret").split(".");
    const tampered = [iv, tag, `${ct!.slice(0, -2)}AA`].join(".");
    expect(() => decrypt(tampered)).toThrow();
  });
});

describe("verrouillage progressif", () => {
  it.each([
    [4, 0],
    [5, 15],
    [10, 30],
    [15, 60],
    [500, 1440],
  ])("%i échecs → %i min", (fails, minutes) => {
    expect(lockDurationMinutes(fails)).toBe(minutes);
  });
});

describe("machine à états du statut", () => {
  it("autorise les transitions prévues", () => {
    expect(canTransition("PENDING", "APPROVED")).toBe(true);
    expect(canTransition("PENDING", "REJECTED")).toBe(true);
    expect(canTransition("APPROVED", "SUSPENDED")).toBe(true);
    expect(canTransition("SUSPENDED", "APPROVED")).toBe(true);
  });
  it("interdit les autres", () => {
    expect(canTransition("PENDING", "SUSPENDED")).toBe(false);
    expect(canTransition("APPROVED", "PENDING")).toBe(false);
    expect(canTransition("APPROVED", "REJECTED")).toBe(false);
  });
});

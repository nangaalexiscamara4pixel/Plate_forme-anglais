import { describe, expect, it } from "vitest";
import { canEnterRoom, roomPhase, roomTimes, sortRoster, type RosterEntry } from "@/features/live/rules";

const start = new Date("2026-10-12T16:00:00Z");
const session = { startsAt: start, durationMin: 60, joinWindowMin: 15, status: "SCHEDULED" as const, levelId: "A1" };
const at = (min: number) => new Date(start.getTime() + min * 60_000);

describe("salle virtuelle : phases", () => {
  it("s'ouvre 15 min avant, reste ouverte 30 min après la fin prévue", () => {
    expect(roomPhase(session, at(-16))).toBe("upcoming");
    expect(roomPhase(session, at(-15))).toBe("open");
    expect(roomPhase(session, at(0))).toBe("live");
    expect(roomPhase(session, at(89))).toBe("live");
    expect(roomPhase(session, at(90))).toBe("ended");
    expect(roomTimes(session).endsAt).toEqual(at(60));
  });
  it("une séance annulée ou terminée est fermée, quelle que soit l'heure", () => {
    expect(roomPhase({ ...session, status: "CANCELLED" }, at(0))).toBe("cancelled");
    expect(roomPhase({ ...session, status: "COMPLETED" }, at(0))).toBe("ended");
  });
});

describe("salle virtuelle : qui peut entrer", () => {
  const student = { role: "STUDENT" as const, levelId: "A1" };
  const admin = { role: "ADMIN" as const, levelId: null };

  it("l'étudiant du niveau entre pendant la fenêtre d'ouverture", () => {
    expect(canEnterRoom(student, session, at(-10))).toEqual({ allow: true, role: "student" });
    expect(canEnterRoom(student, session, at(30))).toEqual({ allow: true, role: "student" });
  });
  it("refuse l'étudiant avant l'ouverture et après la fermeture", () => {
    expect(canEnterRoom(student, session, at(-30))).toEqual({ allow: false, reason: "notOpen" });
    expect(canEnterRoom(student, session, at(120))).toEqual({ allow: false, reason: "closed" });
  });
  it("isolation par niveau : jamais la salle d'un autre niveau, ni sans niveau", () => {
    expect(canEnterRoom({ role: "STUDENT", levelId: "A2" }, session, at(0))).toEqual({ allow: false, reason: "level" });
    expect(canEnterRoom({ role: "STUDENT", levelId: null }, session, at(0))).toEqual({ allow: false, reason: "level" });
  });
  it("l'enseignant prépare la salle à l'avance, mais pas une séance annulée", () => {
    expect(canEnterRoom(admin, session, at(-120))).toEqual({ allow: true, role: "host" });
    expect(canEnterRoom(admin, { ...session, status: "CANCELLED" }, at(0))).toEqual({ allow: false, reason: "closed" });
  });
});

describe("salle virtuelle : ordre des participants", () => {
  const p = (userId: string, role: RosterEntry["role"], handRaisedAt: string | null = null): RosterEntry => ({ userId, name: userId, role, handRaisedAt, floorGrantedAt: null });
  it("enseignant d'abord, puis mains levées dans l'ordre, puis par nom", () => {
    const sorted = sortRoster([p("zoe", "student"), p("bob", "student", "2026-10-12T16:05:00Z"), p("prof", "host"), p("amy", "student"), p("eve", "student", "2026-10-12T16:01:00Z")]);
    expect(sorted.map((r) => r.userId)).toEqual(["prof", "eve", "bob", "amy", "zoe"]);
  });
});

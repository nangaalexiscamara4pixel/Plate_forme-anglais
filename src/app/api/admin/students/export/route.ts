import { NextResponse, type NextRequest } from "next/server";
import { parseStudentFilters } from "@/features/students/filters";
import { exportStudentsCsv } from "@/features/students/service";
import { AuthorizationError, assertAdmin } from "@/server/dal/guards";

/** Export CSV de la liste des étudiants (mêmes filtres que la page), journalisé. */
export async function GET(request: NextRequest) {
  let admin;
  try {
    admin = await assertAdmin();
  } catch (err) {
    if (err instanceof AuthorizationError) return new NextResponse("Not found", { status: 404 });
    throw err;
  }
  const filters = parseStudentFilters(Object.fromEntries(request.nextUrl.searchParams));
  const csv = await exportStudentsCsv(
    { actorId: admin.userId, ip: admin.ip, userAgent: admin.userAgent },
    { q: filters.q, status: filters.status, level: filters.level },
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="globespeak-etudiants-${stamp}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

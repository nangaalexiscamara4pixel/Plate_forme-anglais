import { Eye } from "lucide-react";

/**
 * Bandeau permanent affiché quand un administrateur consulte la plateforme
 * « en tant que » un étudiant (lecture seule). Le bouton de sortie arrive en phase 2.
 */
export function ImpersonationBanner({ studentName }: { studentName: string }) {
  return (
    <div role="status" className="sticky top-0 z-50 bg-destructive px-4 py-2 text-center text-sm font-medium text-white">
      <Eye className="mr-2 inline size-4" aria-hidden />
      Mode « voir en tant que » : {studentName} — lecture seule
    </div>
  );
}

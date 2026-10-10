import { cn } from "@/lib/utils";

/** Emblème : globe à méridiens traversé d'une orbite dorée. */
export function GlobeMark({
  className,
  title,
  subtle = false,
}: {
  className?: string;
  title?: string;
  /** Version décorative grand format : orbite dorée atténuée pour ne pas concurrencer le texte. */
  subtle?: boolean;
}) {
  const goldOpacity = subtle ? 0.28 : 1;
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("size-9", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <circle cx="24" cy="24" r="17" fill="none" stroke="currentColor" strokeWidth="2" />
      <ellipse cx="24" cy="24" rx="7.5" ry="17" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.8" />
      <path d="M7.5 18h33M7.5 30h33" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      <ellipse
        cx="24"
        cy="24"
        rx="22"
        ry="7"
        fill="none"
        stroke="var(--gold)"
        strokeOpacity={goldOpacity}
        strokeWidth={subtle ? 0.8 : 2}
        transform="rotate(-24 24 24)"
      />
      <circle cx="42.5" cy="15.5" r={subtle ? 1.2 : 2.4} fill="var(--gold)" fillOpacity={subtle ? 0.6 : 1} />
    </svg>
  );
}

export function Logo({
  className,
  compact = false,
  collapseOnMobile = false,
}: {
  className?: string;
  compact?: boolean;
  /** Masque le nom sous 640 px (l'emblème reste, avec un libellé accessible). */
  collapseOnMobile?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <GlobeMark />
      {collapseOnMobile && <span className="sr-only sm:hidden">GlobeSpeak Academy</span>}
      {!compact && (
        <span className={cn("flex flex-col leading-none", collapseOnMobile && "max-sm:hidden")}>
          <span className="font-display text-lg font-semibold tracking-wide">GlobeSpeak</span>
          <span className="text-[0.62rem] font-medium uppercase tracking-[0.32em] text-gold-ink">Academy</span>
        </span>
      )}
    </span>
  );
}

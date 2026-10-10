import { BookOpen, Ear, GraduationCap, type LucideIcon, Mic, PenLine, Users, Video } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { SITE_IMAGES, type SiteImage, type SiteImageKey } from "../site-config";

const TONES = {
  night: "from-[oklch(0.38_0.15_264)] to-night",
  red: "from-[oklch(0.62_0.2_25)] to-brand",
  flag: "from-night via-[oklch(0.36_0.15_264)] to-brand",
  a1: "from-[oklch(0.68_0.12_155)] to-level-a1",
  a2: "from-[oklch(0.72_0.11_230)] to-level-a2",
  b1: "from-[oklch(0.62_0.15_290)] to-level-b1",
  b2: "from-[oklch(0.8_0.11_82)] to-level-b2",
} as const;

const ICONS: Partial<Record<SiteImageKey, LucideIcon>> = {
  heroLondon: GraduationCap,
  heroDenim: Users,
  skillReading: BookOpen,
  skillListening: Ear,
  skillSpeaking: Mic,
  skillWriting: PenLine,
  liveClass: Video,
};

/**
 * Photo du site public (configurée dans site-config.ts).
 *  - photo classique : recadrée pour remplir le cadre (`position` règle le point d'intérêt) ;
 *  - affiche (`fit="contain"`) : montrée en entier, sans recadrage, pour que son texte reste lisible ;
 *  - photo détourée (`cutout`) : posée en bas d'un fond dégradé aux couleurs de l'Académie ;
 *  - sans photo : visuel de remplacement (dégradé, motif discret, icône).
 * Animation (`motion`) : léger zoom au survol de la carte parente (`group`) ou zoom lent continu (`kenburns`).
 * Les deux sont neutralisées si le visiteur préfère réduire les animations (globals.css).
 */
export function SitePhoto({
  name,
  alt,
  className,
  sizes = "(min-width: 1024px) 33vw, 100vw",
  priority = false,
  position = "center",
  fit = "cover",
  motion = "hover",
  motionDelay = 0,
}: {
  name: SiteImageKey;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  position?: "center" | "top";
  fit?: "cover" | "contain";
  motion?: "hover" | "kenburns" | "none";
  /** Décalage (secondes) du zoom continu, pour que les photos voisines ne bougent pas en même temps. */
  motionDelay?: number;
}) {
  const image: SiteImage = SITE_IMAGES[name];
  const tone = TONES[image.tone];
  const anim = cn(
    motion === "hover" && "transition-transform duration-700 ease-out group-hover:scale-105",
    motion === "kenburns" && "animate-kenburns",
  );
  const animStyle = motion === "kenburns" && motionDelay ? { animationDelay: `-${motionDelay}s` } : undefined;
  if (image.src && image.cutout) {
    return (
      <div className={cn("relative overflow-hidden bg-gradient-to-br", tone, className)}>
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:18px_18px]" aria-hidden />
        <Image src={image.src} alt={alt} fill sizes={sizes} priority={priority} style={animStyle} className={cn("object-contain object-bottom", anim)} />
      </div>
    );
  }
  if (image.src && fit === "contain") {
    return (
      <div className={cn("relative overflow-hidden bg-white", className)}>
        {/* Fond flou tiré de l'affiche : comble les bandes quand ses proportions diffèrent du cadre */}
        <Image src={image.src} alt="" aria-hidden fill sizes={sizes} quality={90} className="scale-110 object-cover opacity-60 blur-xl" />
        <Image src={image.src} alt={alt} fill sizes={sizes} priority={priority} quality={90} style={animStyle} className={cn("object-contain", anim)} />
      </div>
    );
  }
  if (image.src) {
    return (
      <div className={cn("relative overflow-hidden", className)}>
        <Image src={image.src} alt={alt} fill sizes={sizes} priority={priority} style={animStyle} className={cn("object-cover", position === "top" && "object-top", anim)} />
      </div>
    );
  }
  const Icon = ICONS[name] ?? GraduationCap;
  return (
    <div role="img" aria-label={alt} className={cn("relative overflow-hidden bg-gradient-to-br", tone, className)}>
      <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:18px_18px]" aria-hidden />
      <div className="absolute -right-10 -bottom-10 size-48 rounded-full border-[18px] border-white/10" aria-hidden />
      <Icon className="absolute top-1/2 left-1/2 size-14 -translate-x-1/2 -translate-y-1/2 text-white/80" strokeWidth={1.25} aria-hidden />
    </div>
  );
}

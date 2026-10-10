"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

/**
 * Inscriptions par jour sur 30 jours — une seule série (pas de légende : le titre la nomme),
 * barres fines à extrémités arrondies, grille discrète, info-bulle au survol,
 * et tableau équivalent pour les lecteurs d'écran.
 */
export function RegistrationsChart({ data }: { data: { date: string; count: number }[] }) {
  const t = useTranslations("admin.dashboard");
  const format = useFormatter();
  const config = { count: { label: t("registrations"), color: "var(--primary)" } } satisfies ChartConfig;
  const label = (iso: string) => format.dateTime(new Date(`${iso}T12:00:00Z`), { day: "numeric", month: "short" });

  return (
    <figure>
      <ChartContainer config={config} className="aspect-auto h-56 w-full" aria-hidden>
        <BarChart data={data} margin={{ left: -16, right: 4, top: 8 }} barCategoryGap={3}>
          <CartesianGrid vertical={false} strokeOpacity={0.5} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} tickFormatter={label} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
          <ChartTooltip cursor={{ fillOpacity: 0.08 }} content={<ChartTooltipContent labelFormatter={(v) => label(String(v))} />} />
          <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={14} />
        </BarChart>
      </ChartContainer>
      <table className="sr-only">
        <caption>{t("registrationsTitle")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("date")}</th>
            <th scope="col">{t("registrations")}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{label(d.date)}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

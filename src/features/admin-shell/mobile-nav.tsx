"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AdminNav } from "./admin-nav";

export function AdminMobileNav({ pending }: { pending: number }) {
  const t = useTranslations("admin.nav");
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("open")}>
          <Menu className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-4 text-sidebar-foreground">
        <SheetTitle className="sr-only">{t("label")}</SheetTitle>
        <div className="mb-6 px-2 pt-2">
          <Logo className="[&_.text-brand-ink]:text-brand-soft" />
        </div>
        <AdminNav pending={pending} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

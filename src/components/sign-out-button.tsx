import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions";

export async function SignOutButton({ variant = "ghost" }: { variant?: "ghost" | "outline" }) {
  const t = await getTranslations("common");
  return (
    <form action={signOutAction}>
      <Button type="submit" variant={variant} size="sm">
        <LogOut className="size-4" aria-hidden />
        {t("signOut")}
      </Button>
    </form>
  );
}

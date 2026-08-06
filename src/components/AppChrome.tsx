"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const inWorkspace = pathname.startsWith("/workspace");

  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      {!inWorkspace && <SiteFooter />}
    </>
  );
}

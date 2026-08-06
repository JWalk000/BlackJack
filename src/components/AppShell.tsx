"use client";

import { usePathname } from "next/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isPackage = pathname.includes("/package");
  return (
    <div className={`${isHome ? "" : "pt-16"} ${isPackage ? "print:pt-0" : ""}`}>
      {children}
    </div>
  );
}

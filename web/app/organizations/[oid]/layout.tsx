import type { ReactNode } from "react";

import { OrgNav } from "@/components/OrgNav";

export default async function OrgLayout({ children, params }: { children: ReactNode; params: Promise<{ oid: string }> }) {
  const { oid } = await params;
  return (
    <>
      <OrgNav oid={oid} />
      {children}
    </>
  );
}

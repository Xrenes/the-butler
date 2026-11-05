"use client";

import { DemoProvider, useIsClient } from "@/components/demo/store";
import { AppShell } from "@/components/shell/AppShell";

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="text-center">
        <p className="text-2xl font-semibold tracking-tight">The Butler</p>
        <p className="mt-2 text-sm text-fg-2">Loading your day…</p>
      </div>
    </div>
  );
}

/** Demo data is generated per visit, so the app renders after hydration to avoid mismatches. */
export function ButlerApp() {
  const isClient = useIsClient();
  if (!isClient) return <Splash />;
  return (
    <DemoProvider>
      <AppShell />
    </DemoProvider>
  );
}

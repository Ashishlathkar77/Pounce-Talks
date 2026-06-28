"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { RunDetailPanel } from "@/components/runs/DetailPanel";

export default function RunDetailPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();

  return (
    <div className="converse-fullbleed-page" style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "var(--bg-neutral-primary)", overflow: "hidden",
    }}>
      {/* Breadcrumb bar */}
      <div style={{
        display: "flex", alignItems: "center",
        padding: "0 24px", height: 44, flexShrink: 0,
        borderBottom: "1px solid var(--border-neutral-bold)",
        background: "var(--bg-neutral-primary)",
        fontSize: 13,
      }}>
        <span
          onClick={() => router.push("/runs")}
          style={{ color: "var(--text-neutral-tertiary)", fontWeight: 500, cursor: "pointer" }}
        >
          Runs
        </span>
        <span style={{ color: "var(--text-neutral-disabled)", margin: "0 6px" }}>/</span>
        <span style={{ color: "var(--text-neutral-secondary)", fontWeight: 600 }}>Detail</span>
      </div>

      {/* Full-page panel — close routes back to /runs. The expand/minimize
          button is intentionally omitted (no split view to toggle on this
          standalone route), so the panel header renders only the close X. */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <RunDetailPanel
          sessionId={sessionId}
          onClose={() => router.push("/runs")}
        />
      </div>
    </div>
  );
}

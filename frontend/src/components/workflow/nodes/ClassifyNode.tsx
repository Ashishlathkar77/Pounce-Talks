"use client";

import { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { Tag } from "@hemut2025/design-system";
import { NodeData } from "@/lib/types";
import BaseNode from "./BaseNode";

function ClassifyNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as NodeData;

  // Branches/routes may be either:
  //   • legacy `routes: string[]`              (older seeds)
  //   • legacy `branches: string[]`             (carrier_sales, etc.)
  //   • v1.0/lift `branches: ClassifyBranch[]`  ({ name, description? })
  // Read whichever is present and render names only.
  const raw = nodeData.config?.branches ?? nodeData.config?.routes;
  const names: string[] = Array.isArray(raw)
    ? raw
        .map((b) => {
          if (typeof b === "string") return b;
          if (b && typeof b === "object" && typeof (b as { name?: unknown }).name === "string") {
            return (b as { name: string }).name;
          }
          return "";
        })
        .filter(Boolean)
    : [];

  return (
    <BaseNode
      tone="warning"
      iconName="git-branch"
      typeLabel="Classify"
      label={nodeData.label ?? "Classify"}
      selected={selected}
    >
      {names.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {/* Neutral (not warning) chips: the warning variant's `--bg-warning-
              subtle` is near-black in dark mode and vanishes against the card.
              Neutral sits on `--bg-neutral-secondary`, a touch lighter than the
              card, so branch labels stay legible in both themes — and it matches
              the chips in ExtractNode / WebhookNode. */}
          {names.slice(0, 3).map((name, i) => (
            <Tag key={i} size="xm" variant="neutral">{name}</Tag>
          ))}
          {names.length > 3 && (
            <Tag size="xm" variant="neutral">+{names.length - 3}</Tag>
          )}
        </div>
      )}
    </BaseNode>
  );
}

export default memo(ClassifyNode);

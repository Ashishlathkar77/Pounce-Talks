"use client";

import { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { Tag } from "@hemut2025/design-system";
import { NodeData } from "@/lib/types";
import BaseNode from "./BaseNode";

function ExtractNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as NodeData;

  // `fields` may be either:
  //   • legacy:    string[]                       (old seeds: ["mc_number", "ref"])
  //   • v1.0/lift: IOField[] = {name, type, ...}[] (typed objects from catalog)
  // Render the names only — never blow up on object children.
  const rawFields = nodeData.config?.fields;
  const fieldNames: string[] = Array.isArray(rawFields)
    ? rawFields
        .map((f) => {
          if (typeof f === "string") return f;
          if (f && typeof f === "object" && typeof (f as { name?: unknown }).name === "string") {
            return (f as { name: string }).name;
          }
          return "";
        })
        .filter(Boolean)
    : [];

  return (
    <BaseNode
      tone="neutral"
      iconName="scissors"
      typeLabel="Extract"
      label={nodeData.label ?? "Extract Data"}
      selected={selected}
    >
      {fieldNames.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {fieldNames.slice(0, 3).map((field, i) => (
            <Tag key={i} size="xm" variant="neutral">{field}</Tag>
          ))}
          {fieldNames.length > 3 && (
            <Tag size="xm" variant="neutral">+{fieldNames.length - 3}</Tag>
          )}
        </div>
      )}
    </BaseNode>
  );
}

export default memo(ExtractNode);

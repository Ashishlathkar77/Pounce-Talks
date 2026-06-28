"use client";

import { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { Tag } from "@hemut2025/design-system";
import { NodeData } from "@/lib/types";
import BaseNode from "./BaseNode";

function WebhookNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as NodeData;
  const url = (nodeData.config?.url as string) ?? "";
  const method = ((nodeData.config?.method as string) ?? "POST").toUpperCase();

  return (
    <BaseNode
      tone="neutral"
      iconName="globe"
      typeLabel="Webhook"
      label={nodeData.label ?? "Webhook"}
      selected={selected}
    >
      {url && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Tag size="xm" variant="neutral">{method}</Tag>
          <span
            title={url}
            style={{
              fontSize: 11,
              color: "var(--text-neutral-tertiary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 150,
              fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
            }}
          >
            {url}
          </span>
        </div>
      )}
    </BaseNode>
  );
}

export default memo(WebhookNode);

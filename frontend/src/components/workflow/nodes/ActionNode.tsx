"use client";

import { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { NodeData } from "@/lib/types";
import BaseNode from "./BaseNode";

function ActionNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as NodeData;
  // Prefer the v1.0 `tool` field (canonical, written by the lifter and the
  // ActionNodeForm). Fall back to legacy `action_name` for old rows that
  // haven't been resaved yet.
  const tool =
    (nodeData.config?.tool as string) ??
    (nodeData.config?.action_name as string) ??
    "";

  return (
    <BaseNode
      tone="brand"
      iconName="lightning"
      typeLabel="Action"
      label={nodeData.label ?? "Action"}
      description={tool || nodeData.description}
      selected={selected}
    />
  );
}

export default memo(ActionNode);

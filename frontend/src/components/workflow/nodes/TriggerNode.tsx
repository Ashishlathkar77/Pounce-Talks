"use client";

import { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { NodeData } from "@/lib/types";
import BaseNode from "./BaseNode";

function TriggerNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as NodeData;
  const isOutbound = nodeData.config?.direction === "outbound";

  return (
    <BaseNode
      tone="neutral"
      iconName={isOutbound ? "phone-outgoing" : "phone-incoming"}
      typeLabel="Trigger"
      label={nodeData.label ?? (isOutbound ? "Outbound Call" : "Inbound Call")}
      description={nodeData.description}
      selected={selected}
      hasTarget={false}
    />
  );
}

export default memo(TriggerNode);

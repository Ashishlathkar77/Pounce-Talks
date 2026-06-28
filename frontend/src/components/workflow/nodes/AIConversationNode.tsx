"use client";

import { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { NodeData } from "@/lib/types";
import BaseNode from "./BaseNode";

function AIConversationNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as NodeData;
  const model = (nodeData.config?.model as string) ?? "gpt-4.1-mini";

  return (
    <BaseNode
      tone="info"
      iconName="chat-circle-text"
      typeLabel="AI Convo"
      label={nodeData.label ?? "AI Conversation"}
      description={nodeData.description ?? model}
      selected={selected}
    />
  );
}

export default memo(AIConversationNode);

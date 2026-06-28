/**
 * Frontend mirror of the backend tool catalog.
 *
 * The actual data lives in `toolCatalog.generated.json`, emitted by the
 * backend script:
 *
 *     cd backend && python -m scripts.export_workflow_jsonschema
 *
 * Re-run that script after adding / editing a tool in
 * `backend/voice_agent/tools/catalog.py`. The script writes both the
 * `architecture/workflow.schema.json` (for IDE / CI lint) and the
 * `frontend/src/lib/toolCatalog.generated.json` consumed here.
 *
 * The generated JSON is checked in so the canvas works in fresh
 * environments without needing the Python backend running.
 */

import { IOField, VariableType } from "@/lib/types";
import generated from "./toolCatalog.generated.json";

export interface ToolSpec {
  name: string;
  description: string;
  inputs: IOField[];
  outputs: IOField[];
}

interface GeneratedShape {
  schema_version: string;
  tools: Record<string, {
    name: string;
    description?: string;
    inputs?: Array<Partial<IOField> & { name: string; type: string }>;
    outputs?: Array<Partial<IOField> & { name: string; type: string }>;
  }>;
}

const data = generated as GeneratedShape;

function coerceField(raw: { name: string; type: string } & Partial<IOField>): IOField {
  return {
    name: raw.name,
    type: raw.type as VariableType,
    description: raw.description,
    required: raw.required,
    default: raw.default,
    enum: raw.enum,
    pattern: raw.pattern,
  };
}

/** Map of tool name → typed `ToolSpec`. Frozen at module load. */
export const TOOL_CATALOG: Record<string, ToolSpec> = Object.fromEntries(
  Object.entries(data.tools).map(([name, raw]) => [
    name,
    {
      name: raw.name,
      description: raw.description ?? "",
      inputs:  (raw.inputs  ?? []).map(coerceField),
      outputs: (raw.outputs ?? []).map(coerceField),
    },
  ]),
);

/** Sorted list of every known tool name. */
export const TOOL_NAMES: string[] = Object.keys(TOOL_CATALOG).sort();

/** Look up a tool spec by name. Returns `undefined` for unknown tools. */
export function getToolSpec(name: string): ToolSpec | undefined {
  return TOOL_CATALOG[name];
}

/** True when `name` is a tool the catalog knows about. */
export function isKnownTool(name: string): boolean {
  return name in TOOL_CATALOG;
}

/** Names of required tool inputs. Empty for unknown tools. */
export function requiredInputs(name: string): string[] {
  const spec = TOOL_CATALOG[name];
  if (!spec) return [];
  return spec.inputs.filter((i) => i.required).map((i) => i.name);
}

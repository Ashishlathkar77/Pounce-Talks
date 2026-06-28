import { create } from "zustand";
import { persist } from "zustand/middleware";
import { WorkflowEdge, WorkflowNode, WorkflowVariable } from "@/lib/types";

// ── Selected agent (global context — synced with TopNav selector) ─────────────

interface AgentSelectorState {
  selectedAgentType: string | null;
  selectedAgentName: string;
  selectedAgentId: string | null;
  setSelectedAgent: (id: string | null, type: string | null, name: string) => void;
}

export const useAgentSelectorStore = create<AgentSelectorState>()(
  persist(
    (set) => ({
      selectedAgentType: null,
      selectedAgentName: "All agents",
      selectedAgentId: null,
      setSelectedAgent: (id, type, name) =>
        set({ selectedAgentId: id, selectedAgentType: type, selectedAgentName: name }),
    }),
    { name: "converse_agent_selector" }
  )
);

interface AuthUser {
  email: string;
  customer_name: string;
  plan: string;
  role: string;
  workspace_config: { runs_columns?: string[]; features?: string[] };
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setToken: (token: string, user?: AuthUser) => void;
  logout: () => void;
}

/** One point-in-time copy of the canvas graph, kept on the undo/redo stacks. */
interface WorkflowSnapshot {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

interface WorkflowState {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  // `markDirty` defaults to true. Pass false for non-substantive React Flow
  // updates (node dimension measurement, selection) so they don't flip the
  // unsaved-changes flag on initial mount.
  setNodes: (nodes: WorkflowNode[], markDirty?: boolean) => void;
  setEdges: (edges: WorkflowEdge[], markDirty?: boolean) => void;
  selectedNode: WorkflowNode | null;
  setSelectedNode: (node: WorkflowNode | null) => void;
  // ── Undo / redo ──────────────────────────────────────────────────────────
  past: WorkflowSnapshot[];
  future: WorkflowSnapshot[];
  canUndo: boolean;
  canRedo: boolean;
  snapshot: () => void;
  undo: () => void;
  redo: () => void;
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
  // Workflow-scope authoring state (v1.0 schema).
  primaryPrompt: string;
  primaryPromptVars: string[];
  variables: WorkflowVariable[];
  setPrimaryPrompt: (prompt: string, vars?: string[]) => void;
  setVariables: (vars: WorkflowVariable[]) => void;
  resetWorkflow: () => void;
}

// ── Demo mode auth store — hardcoded demo user, no-op logout ─────────────────

const DEMO_USER: AuthUser = {
  email: "demo@hemut.com",
  customer_name: "Pounce Demo",
  plan: "enterprise",
  role: "admin",
  workspace_config: { features: ["call_sheet"] },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: "demo",
      user: DEMO_USER,
      setToken: (token, user) => set({ token, user: user ?? DEMO_USER }),
      logout: () => {
        // No-op in demo mode — no real session to clear
      },
    }),
    {
      name: "converse_auth",
    }
  )
);

// Compatibility shim so api.ts's `useAuthStore.getState().logout()` call
// never throws even if the store isn't hydrated yet.
(useAuthStore as unknown as { getState: () => { logout: () => void } }).getState =
  () => ({ logout: () => {} });

// Bound on how many edits we keep around.
const HISTORY_LIMIT = 50;

export const useWorkflowStore = create<WorkflowState>()((set) => ({
  nodes: [],
  edges: [],
  setNodes: (nodes, markDirty = true) => set((s) => ({ nodes, isDirty: markDirty || s.isDirty })),
  setEdges: (edges, markDirty = true) => set((s) => ({ edges, isDirty: markDirty || s.isDirty })),
  selectedNode: null,
  setSelectedNode: (node) => set({ selectedNode: node }),
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,
  snapshot: () =>
    set((s) => ({
      past: [...s.past, { nodes: s.nodes, edges: s.edges }].slice(-HISTORY_LIMIT),
      future: [],
      canUndo: true,
      canRedo: false,
    })),
  undo: () =>
    set((s) => {
      if (s.past.length === 0) return {};
      const previous = s.past[s.past.length - 1];
      const past = s.past.slice(0, -1);
      return {
        nodes: previous.nodes,
        edges: previous.edges,
        past,
        future: [{ nodes: s.nodes, edges: s.edges }, ...s.future].slice(0, HISTORY_LIMIT),
        canUndo: past.length > 0,
        canRedo: true,
        selectedNode: null,
        isDirty: true,
      };
    }),
  redo: () =>
    set((s) => {
      if (s.future.length === 0) return {};
      const next = s.future[0];
      const future = s.future.slice(1);
      return {
        nodes: next.nodes,
        edges: next.edges,
        future,
        past: [...s.past, { nodes: s.nodes, edges: s.edges }].slice(-HISTORY_LIMIT),
        canUndo: true,
        canRedo: future.length > 0,
        selectedNode: null,
        isDirty: true,
      };
    }),
  isDirty: false,
  setIsDirty: (isDirty) => set({ isDirty }),
  primaryPrompt: "",
  primaryPromptVars: [],
  variables: [],
  setPrimaryPrompt: (prompt, vars) =>
    set((state) => ({
      primaryPrompt: prompt,
      primaryPromptVars: vars ?? state.primaryPromptVars,
      isDirty: true,
    })),
  setVariables: (vars) => set({ variables: vars, isDirty: true }),
  resetWorkflow: () =>
    set({
      nodes: [], edges: [], selectedNode: null, isDirty: false,
      primaryPrompt: "", primaryPromptVars: [], variables: [],
      past: [], future: [], canUndo: false, canRedo: false,
    }),
}));

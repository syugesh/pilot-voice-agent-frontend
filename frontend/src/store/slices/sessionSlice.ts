import { StateCreator } from "zustand";
import { AppState, TranscriptEntry, ToolCard, JobItem, Speaker } from "../types";
import { syncUrlFromState } from "../urlSync";

export interface SessionSlice {
  sessionId: string | null;
  usecase: string;
  transcripts: TranscriptEntry[];
  toolCards: ToolCard[];
  jobQueue: JobItem[];
  speakers: Speaker[];
  confirmPrompt: { tool: string; speaker: string; message: string } | null;
  setSession: (id: string) => void;
  addTranscript: (e: TranscriptEntry) => void;
  upsertToolCard: (c: Partial<ToolCard> & { job_id: string }) => void;
  addJob: (j: JobItem) => void;
  setSpeakers: (s: Speaker[]) => void;
  setConfirm: (p: AppState["confirmPrompt"]) => void;
}

export const createSessionSlice: StateCreator<
  AppState,
  [],
  [],
  SessionSlice
> = (set, get) => ({
  sessionId: null,
  usecase: "general",
  transcripts: [],
  toolCards: [],
  jobQueue: [],
  speakers: [],
  confirmPrompt: null,

  setSession: (id) => {
    set({ sessionId: id });
    const s = get();
    syncUrlFromState(s.page, id, s.user?.id, s.talkiniaSubRoute);
  },

  addTranscript: (e) =>
    set((s) => ({ transcripts: [...s.transcripts.slice(-299), e] })),

  upsertToolCard: (c) =>
    set((s) => {
      const idx = s.toolCards.findIndex((x) => x.job_id === c.job_id);
      if (idx >= 0) {
        const a = [...s.toolCards];
        a[idx] = { ...a[idx], ...c } as ToolCard;
        return { toolCards: a };
      }
      // A card with no tool name is unusable (Queue/Current Task both render
      // `.tool.replace(...)` directly) and unrenderable-safe. The
      // "transcript" event handler in shared_voice.ts only ever intends to
      // update an existing card's status to "ok" once its result is spoken —
      // it never has `tool` to give — so if no card exists yet for this
      // job_id (e.g. it arrived out of order, before job_queued/tool_start),
      // silently drop it instead of creating a broken, half-populated entry.
      if (!c.tool) return {};
      return { toolCards: [...s.toolCards, c as ToolCard] };
    }),

  addJob: (j) => set((s) => ({ jobQueue: [...s.jobQueue, j] })),

  setSpeakers: (sp) => set({ speakers: sp }),

  setConfirm: (p) => set({ confirmPrompt: p })
});

/**
 * Zustand store for an in-progress extraction. Accumulates streamed deltas
 * into structured shape the UI binds to.
 */
'use client';

import { create } from 'zustand';
import type {
  Audit,
  Component,
  ExtractionDelta,
  ExtractionStage,
  ModelCall,
  Token,
  Warning,
} from '@prism/shared';

export interface StageRecord {
  stage: ExtractionStage;
  status: 'started' | 'progress' | 'succeeded' | 'skipped' | 'failed';
  progress?: number;
  message?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface ExtractionState {
  extractionId: string | null;
  isComplete: boolean;
  failed: boolean;
  stages: StageRecord[];
  tokens: Token[];
  components: Component[];
  audits: Audit[];
  warnings: Warning[];
  modelCalls: ModelCall[];
  totalCostUsd: number;
  summary:
    | {
        tokenCount: number;
        componentCount: number;
        auditCount: number;
        costUsd: number;
        durationMs: number;
      }
    | null;
  errorMessage: string | null;
  reset(extractionId: string): void;
  apply(delta: ExtractionDelta): void;
  markFailed(message: string): void;
}

const initial: Omit<ExtractionState, 'reset' | 'apply' | 'markFailed'> = {
  extractionId: null,
  isComplete: false,
  failed: false,
  stages: [],
  tokens: [],
  components: [],
  audits: [],
  warnings: [],
  modelCalls: [],
  totalCostUsd: 0,
  summary: null,
  errorMessage: null,
};

export const useExtractionStore = create<ExtractionState>((set) => ({
  ...initial,
  reset: (extractionId) => set({ ...initial, extractionId }),
  markFailed: (message) => set({ failed: true, errorMessage: message, isComplete: true }),
  apply: (delta) =>
    set((state) => {
      switch (delta.type) {
        case 'stage': {
          const idx = state.stages.findIndex((s) => s.stage === delta.stage);
          const record: StageRecord = {
            stage: delta.stage,
            status: delta.status,
            ...(delta.progress !== undefined ? { progress: delta.progress } : {}),
            ...(delta.message ? { message: delta.message } : {}),
            ...(delta.status === 'started' ? { startedAt: delta.timestamp } : {}),
            ...(delta.status === 'succeeded' || delta.status === 'failed' || delta.status === 'skipped'
              ? { finishedAt: delta.timestamp }
              : {}),
          };
          const stages = [...state.stages];
          if (idx === -1) stages.push(record);
          else stages[idx] = { ...stages[idx], ...record };
          return {
            stages,
            ...(delta.stage === 'failed' || delta.status === 'failed'
              ? { failed: true, errorMessage: delta.message ?? 'Extraction failed' }
              : {}),
          };
        }
        case 'token': {
          const existingIdx = state.tokens.findIndex((t) => t.id === delta.token.id);
          const tokens = [...state.tokens];
          if (existingIdx === -1) tokens.push(delta.token);
          else tokens[existingIdx] = delta.token;
          return { tokens };
        }
        case 'component': {
          const existingIdx = state.components.findIndex((c) => c.id === delta.component.id);
          const components = [...state.components];
          if (existingIdx === -1) components.push(delta.component);
          else components[existingIdx] = delta.component;
          return { components };
        }
        case 'audit':
          return { audits: [...state.audits, delta.audit] };
        case 'warning':
          return { warnings: [...state.warnings, delta.warning] };
        case 'cost':
          return {
            modelCalls: [...state.modelCalls, delta.call],
            totalCostUsd: delta.runningTotalUsd,
          };
        case 'final':
          return {
            isComplete: true,
            summary: delta.summary,
            totalCostUsd: delta.summary.costUsd,
          };
        default:
          return {};
      }
    }),
}));

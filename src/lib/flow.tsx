/**
 * 重模式 skill 的流程控制器。
 *
 * 每个 heavy-mode skill（full_diagnosis、未来的薪酬架构设计等）声明一组有序 steps，
 * flow controller 统一管 currentStep + 每步 status，不再让组件自己维护"我在第几步"。
 *
 * 组件对 flow 的接触面就两件事：
 *   - 从 flow.currentStep 读"现在该渲染什么"
 *   - 完成后调 flow.advance(payload) 交还控制权
 *
 * 重启/重置只用 flow.reset()，所有组件自动回初始态；不再依赖 conversationKey
 * 这种"炸掉 key 重挂载"的方式（但 conversationKey 作为防御性 fallback 先保留）。
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type StepStatus = 'pending' | 'in_progress' | 'done' | 'error' | 'skipped';

export interface FlowStepDef {
  id: string;
  label?: string;
  /** user: 等用户交互；auto: 进入即自动跑（如 analyze） */
  kind: 'user' | 'auto';
}

export interface FlowStepState extends FlowStepDef {
  status: StepStatus;
  payload?: any;
  error?: string;
}

export interface FlowState {
  skillKey: string;
  steps: FlowStepState[];
  currentStepId: string | null;
}

export interface FlowApi {
  state: FlowState | null;
  currentStep: FlowStepState | null;
  start(skillKey: string, stepDefs: FlowStepDef[]): void;
  advance(payload?: any): void;
  markError(msg: string): void;
  retry(): void;                           // 当前步 error → in_progress，用户重试
  reset(): void;
  goTo(stepId: string): void;
}

const FlowContext = createContext<FlowApi | null>(null);

export function FlowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FlowState | null>(null);

  const start = useCallback((skillKey: string, stepDefs: FlowStepDef[]) => {
    if (stepDefs.length === 0) return;
    const steps: FlowStepState[] = stepDefs.map((s, i) => ({
      ...s,
      status: i === 0 ? ('in_progress' as StepStatus) : ('pending' as StepStatus),
    }));
    setState({ skillKey, steps, currentStepId: stepDefs[0].id });
  }, []);

  const advance = useCallback((payload?: any) => {
    setState(prev => {
      if (!prev || !prev.currentStepId) return prev;
      const idx = prev.steps.findIndex(s => s.id === prev.currentStepId);
      if (idx < 0) return prev;
      const newSteps = prev.steps.map((s, i) => {
        if (i === idx) return { ...s, status: 'done' as StepStatus, payload: payload ?? s.payload };
        if (i === idx + 1) return { ...s, status: 'in_progress' as StepStatus };
        return s;
      });
      const nextId = idx + 1 < newSteps.length ? newSteps[idx + 1].id : null;
      return { ...prev, steps: newSteps, currentStepId: nextId };
    });
  }, []);

  const markError = useCallback((msg: string) => {
    setState(prev => {
      if (!prev || !prev.currentStepId) return prev;
      return {
        ...prev,
        steps: prev.steps.map(s =>
          s.id === prev.currentStepId ? { ...s, status: 'error' as StepStatus, error: msg } : s,
        ),
      };
    });
  }, []);

  const retry = useCallback(() => {
    setState(prev => {
      if (!prev || !prev.currentStepId) return prev;
      return {
        ...prev,
        steps: prev.steps.map(s =>
          s.id === prev.currentStepId && s.status === 'error'
            ? { ...s, status: 'in_progress' as StepStatus, error: undefined }
            : s,
        ),
      };
    });
  }, []);

  const reset = useCallback(() => {
    setState(null);
  }, []);

  const goTo = useCallback((stepId: string) => {
    setState(prev => {
      if (!prev) return prev;
      if (!prev.steps.some(s => s.id === stepId)) return prev;
      return {
        ...prev,
        steps: prev.steps.map(s =>
          s.id === stepId ? { ...s, status: 'in_progress' as StepStatus, error: undefined } : s,
        ),
        currentStepId: stepId,
      };
    });
  }, []);

  const currentStep = useMemo<FlowStepState | null>(() => {
    if (!state || !state.currentStepId) return null;
    return state.steps.find(s => s.id === state.currentStepId) || null;
  }, [state]);

  const api: FlowApi = useMemo(() => ({
    state, currentStep, start, advance, markError, retry, reset, goTo,
  }), [state, currentStep, start, advance, markError, retry, reset, goTo]);

  return <FlowContext.Provider value={api}>{children}</FlowContext.Provider>;
}

export function useFlow(): FlowApi {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error('useFlow must be inside <FlowProvider>');
  return ctx;
}

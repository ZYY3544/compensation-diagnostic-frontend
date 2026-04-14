/**
 * Heavy-mode skill 的流程定义。
 * 加新 skill 时只需要在这里 export 一个 FlowStepDef[]，flow controller 不用改。
 */
import type { FlowStepDef } from '../lib/flow';

export const FULL_DIAGNOSIS_FLOW: FlowStepDef[] = [
  { id: 'interview', label: '业务访谈', kind: 'user' },
  { id: 'upload',    label: '数据上传', kind: 'user' },
  { id: 'confirm',   label: '数据确认', kind: 'user' },  // 内部还有 5 子步 + mapping 分支，归 confirm 自己管
  { id: 'analyze',   label: '分析中',   kind: 'auto' },  // 自动跑 runAnalysis + getReport，30s 超时
  { id: 'report',    label: '诊断报告', kind: 'user' },
];

export const SKILL_FLOWS: Record<string, FlowStepDef[]> = {
  full_diagnosis: FULL_DIAGNOSIS_FLOW,
};

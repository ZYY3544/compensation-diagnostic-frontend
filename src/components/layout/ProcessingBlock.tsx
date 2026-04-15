/**
 * 处理状态块：代替一堆独立对话气泡展示 pipeline 的多步进度。
 *
 * 视觉规范：
 * - 无头像、无气泡背景，左侧细线 + 浅色文字，紧凑 4px 行间距
 * - ✓ 已完成 / ◎ 进行中（呼吸动画）/ ✕ 失败
 * - 缩进对齐到 Sparky 气泡的位置（头像 32px + gap 12px = 44px）
 */
import type { ProcessingStep } from '../../types';

interface Props {
  steps: ProcessingStep[];
}

export default function ProcessingBlock({ steps }: Props) {
  if (!steps || steps.length === 0) return null;
  return (
    <div className="processing-block">
      {steps.map((step, i) => (
        <div key={i} className={`processing-step status-${step.status}`}>
          <span className="processing-icon">
            {step.status === 'done' ? '✓' : step.status === 'fail' ? '✕' : '◎'}
          </span>
          <span className="processing-text">{step.text}</span>
        </div>
      ))}
    </div>
  );
}

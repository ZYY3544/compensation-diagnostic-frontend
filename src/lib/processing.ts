/**
 * Sparky 处理状态（解析、清洗、匹配等）的消息管理。
 *
 * 使用场景：pipeline / 长流程里的多步"进度提示"不再每条发一个气泡，
 * 合并到同一个 ProcessingBlock 里。
 *
 * 约定：
 * - appendProcessingStep('...')：把上一条 doing 的步骤标成 done，
 *   追加新的 doing 步骤。如果最后一条 message 不是 processing，开一个新的块。
 * - finishProcessing()：把当前 processing 块里所有 doing 的步骤标成 done。
 *   用在 pipeline 全部结束时，紧接着发一条普通气泡做总结。
 * - failProcessing(msg)：当前 doing 步骤标成 fail。
 */
import { nextMsgId } from './msgId';
import type { Message, ProcessingStep } from '../types';

type Setter = React.Dispatch<React.SetStateAction<Message[]>>;

export function appendProcessingStep(setMessages: Setter, text: string): void {
  setMessages(prev => {
    const last = prev[prev.length - 1];
    if (last && last.role === 'processing') {
      // 把前一条 doing 切成 done，再追加新 doing
      const steps: ProcessingStep[] = (last.steps || []).map(s =>
        s.status === 'doing' ? { ...s, status: 'done' } : s,
      );
      steps.push({ text, status: 'doing' });
      return [...prev.slice(0, -1), { ...last, steps }];
    }
    // 开新块
    return [...prev, {
      id: nextMsgId(),
      role: 'processing',
      text: '',
      steps: [{ text, status: 'doing' }],
    }];
  });
}

export function finishProcessing(setMessages: Setter): void {
  setMessages(prev => {
    const last = prev[prev.length - 1];
    if (!last || last.role !== 'processing') return prev;
    const steps: ProcessingStep[] = (last.steps || []).map(s =>
      s.status === 'doing' ? { ...s, status: 'done' } : s,
    );
    return [...prev.slice(0, -1), { ...last, steps }];
  });
}

export function failProcessing(setMessages: Setter, errText?: string): void {
  setMessages(prev => {
    const last = prev[prev.length - 1];
    if (!last || last.role !== 'processing') return prev;
    const steps: ProcessingStep[] = (last.steps || []).map(s =>
      s.status === 'doing'
        ? { ...s, status: 'fail', text: errText || s.text }
        : s,
    );
    return [...prev.slice(0, -1), { ...last, steps }];
  });
}

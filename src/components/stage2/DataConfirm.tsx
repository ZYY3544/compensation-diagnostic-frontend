import { useState, useEffect, useCallback, useRef, type MutableRefObject } from 'react';
import WizardProgress from './WizardProgress';
import StepCompleteness from './StepCompleteness';
import StepCleansing from './StepCleansing';
import StepGradeMatch from './StepGradeMatch';
import StepFuncMatch from './StepFuncMatch';
import StepReady from './StepReady';
import { getCompletenessSummary, createSnapshot, runCleansing, runGradeMatch, runFuncMatch } from '../../api/client';
import { nextMsgId } from '../../lib/msgId';
import { appendProcessingStep, finishProcessing, failProcessing } from '../../lib/processing';
import type { Message, ParseResult } from '../../types';

// ProcessingBlock 相邻步骤之间的停顿（ms）——太快用户读不完，太慢显得卡
const STEP_PACE_MS = 1600;

interface DataConfirmProps {
  onComplete: () => void;
  addMsg: (msg: Message) => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  textInputRef: MutableRefObject<((text: string) => boolean) | null>;
  parseResult?: ParseResult | null;
  setParseResult: React.Dispatch<React.SetStateAction<ParseResult | null>>;
  sessionId: string | null;
  interviewNotes?: any;
}

export default function DataConfirm({ onComplete, addMsg, setMessages, textInputRef, parseResult, setParseResult, sessionId, interviewNotes }: DataConfirmProps) {
  const [substep, setSubstep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [viewingStep, setViewingStep] = useState(1);
  const [step1Ready, setStep1Ready] = useState(false);
  const animationStarted = useRef(false);
  const [step2MsgsSent, setStep2MsgsSent] = useState(false);
  const [step2Ready, setStep2Ready] = useState(false);
  const [step3MsgsSent, setStep3MsgsSent] = useState(false);
  const [step3Ready, setStep3Ready] = useState(false);
  const [gradeData, setGradeData] = useState<any>(null);
  const [step4MsgsSent, setStep4MsgsSent] = useState(false);
  const [step4Ready, setStep4Ready] = useState(false);
  const [funcData, setFuncData] = useState<any>(null);
  const [step5MsgsSent, setStep5MsgsSent] = useState(false);

  // Promise 超时兜底——前景标签里 intro stream 几秒就跑完；后台标签被 Chrome
  // throttle setInterval 时可能几十秒，给个上限防止死等
  const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | undefined> =>
    Promise.race([p, new Promise<undefined>(r => setTimeout(() => r(undefined), ms))]);

  // Helper: send Sparky message with streaming output
  // 每条消息分配唯一 id，按 id 更新——避免与 App.streamMsg 并发写同一个 "length-1" 位置
  const sendBotMsg = useCallback((text: string, delay: number) => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const id = nextMsgId();
        setMessages(prev => [...prev, { id, role: 'bot', text: '' }]);
        let displayed = 0;
        const timer = setInterval(() => {
          displayed = Math.min(displayed + 1, text.length);
          setMessages(prev => prev.map(m => m.id === id ? { ...m, text: text.slice(0, displayed) } : m));
          if (displayed >= text.length) {
            clearInterval(timer);
            resolve();
          }
        }, 30);
      }, delay);
    });
  }, [setMessages]);

  const advanceStep = useCallback((fromStep: number) => {
    const nextStep = fromStep + 1;
    setCompletedSteps(prev => prev.includes(fromStep) ? prev : [...prev, fromStep]);
    setSubstep(prev => nextStep > prev ? nextStep : prev);
    setViewingStep(nextStep);
  }, []);

  // --- Text input handler ---
  useEffect(() => {
    textInputRef.current = () => false;
  });

  // =====================================================================
  // Step 1: 解析播报 + 完整度分析 → AI 总结 → 展示完整度看板
  // =====================================================================
  useEffect(() => {
    if (substep !== 1 || animationStarted.current) return;
    animationStarted.current = true;

    const emp = parseResult?.employee_count || 0;
    const gradeCount = parseResult?.grade_count || 0;
    const deptCount = parseResult?.department_count || 0;
    const gradeRange = parseResult?.grades?.length
      ? `${parseResult.grades[0]}-${parseResult.grades[parseResult.grades.length - 1]}`
      : '';
    const rowMissing = parseResult?.completeness_issues?.row_missing || [];
    const colMissing = parseResult?.completeness_issues?.column_missing || [];

    (async () => {
      // 预计算完整度摘要 + AI 调用所需的输入
      const uniqueRows = new Set(rowMissing.map((r: any) => r.row));
      const fieldGroups: Record<string, number[]> = {};
      for (const r of rowMissing) {
        if (!fieldGroups[r.field]) fieldGroups[r.field] = [];
        fieldGroups[r.field].push(r.row);
      }
      const summaryParts = [
        `员工记录 ${emp} 条`,
        `关键字段缺失：${uniqueRows.size > 0 ? `${uniqueRows.size} 条记录、涉及字段：${Object.keys(fieldGroups).join('、')}` : '无'}`,
        `可选字段未填写：${colMissing.length > 0 ? colMissing.map((c: any) => c.field).join('、') : '无'}`,
      ];

      // 进度提示进 ProcessingBlock，不发独立气泡
      appendProcessingStep(setMessages, '正在读取 Excel 结构');
      await new Promise(r => setTimeout(r, STEP_PACE_MS));
      appendProcessingStep(setMessages, '正在识别字段和数据类型');
      await new Promise(r => setTimeout(r, STEP_PACE_MS));
      appendProcessingStep(setMessages, `解析完成，识别到 ${emp} 条员工记录、${gradeCount} 个职级（${gradeRange}）、${deptCount} 个部门`);
      await new Promise(r => setTimeout(r, STEP_PACE_MS));
      appendProcessingStep(setMessages, '正在检查数据完整度');

      // 调 AI 总结
      let aiMsg = '';
      if (sessionId) {
        try {
          const res = await getCompletenessSummary(sessionId, summaryParts.join('；'));
          aiMsg = res.data.message || '';
        } catch { /* fallback below */ }
      }

      if (!aiMsg) {
        if (uniqueRows.size > 0) {
          aiMsg = `有 ${uniqueRows.size} 条记录关键字段缺失，主要集中在${Object.keys(fieldGroups).slice(0, 2).join('和')}字段。`;
          if (colMissing.length > 0) aiMsg += `另外有 ${colMissing.length} 个可选字段整列没填，不影响核心诊断。`;
          aiMsg += '右边可以看详情，你决定是补完数据重新上传，还是先跳过继续。';
        } else {
          aiMsg = '所有必填字段都完整，数据质量很好！直接往下走吧。';
        }
      }

      finishProcessing(setMessages);       // 把剩下的 doing 都结了
      setStep1Ready(true);
      if (uniqueRows.size === 0 && colMissing.length === 0) {
        setTimeout(() => advanceStep(1), 2000);
      }
      // AI 总结是"跟用户讲话"—— 走正常气泡
      sendBotMsg(aiMsg, 300);
    })();
  }, [substep, parseResult, sendBotMsg, sessionId, advanceStep]);

  // =====================================================================
  // Step 2: 快照 → 数据清洗（进入时先复制数据，再调 AI cleansing）
  // =====================================================================
  useEffect(() => {
    if (substep === 2 && !step2MsgsSent) {
      setStep2MsgsSent(true);

      (async () => {
        // 左右联动：processing 步骤 + API 并行跑，两者都完成才 flip 右侧看板
        appendProcessingStep(setMessages, '正在备份原始数据');
        await new Promise(r => setTimeout(r, STEP_PACE_MS));
        appendProcessingStep(setMessages, '正在检查数据质量');

        if (!sessionId) { setStep2Ready(true); return; }

        try { await createSnapshot(sessionId); } catch {}
        const apiPromise = runCleansing(sessionId)
          .then(res => ({ ok: true as const, res }))
          .catch(err => ({ ok: false as const, err }));

        const apiResult = await withTimeout(apiPromise, 30000);

        if (apiResult?.ok) {
          const res = apiResult.res;
          if (res.data.cleansing_corrections) {
            setParseResult(prev => prev ? { ...prev, cleansing_corrections: res.data.cleansing_corrections } : prev);
          }
          const aiMsg = res.data.sparky_message
            || (res.data.cleansing_corrections?.length
              ? '右边可以看到清洗详情，有不对的可以撤回。'
              : '数据质量没问题，不需要额外修正。');
          finishProcessing(setMessages);
          setStep2Ready(true);
          sendBotMsg(aiMsg, 300);
        } else {
          failProcessing(setMessages, '数据清洗服务暂时不可用');
          setStep2Ready(true);
          sendBotMsg('数据清洗服务暂时不可用，你可以手动检查后继续。', 300);
        }
      })();
    }
  }, [substep, step2MsgsSent, sendBotMsg, sessionId, setParseResult]);

  // =====================================================================
  // Step 3: 职级匹配（进入时调 LLM）
  // =====================================================================
  useEffect(() => {
    if (substep === 3 && !step3MsgsSent) {
      setStep3MsgsSent(true);

      (async () => {
        appendProcessingStep(setMessages, '正在把职级跟市场标准对齐');
        if (!sessionId) { setStep3Ready(true); return; }

        const apiPromise = runGradeMatch(sessionId)
          .then(res => ({ ok: true as const, res }))
          .catch(err => ({ ok: false as const, err }));
        const apiResult = await withTimeout(apiPromise, 30000);

        if (apiResult?.ok) {
          const data = apiResult.res.data;
          setGradeData(data);
          if (data.grade_matching) {
            setParseResult(prev => prev ? { ...prev, grade_matching: data.grade_matching } : prev);
          }
          finishProcessing(setMessages);
          setStep3Ready(true);
          sendBotMsg(data.sparky_message || '职级匹配完成，请确认右边的映射关系。', 300);
        } else {
          console.warn('[DataConfirm] grade matching failed:', apiResult?.ok === false ? apiResult.err : 'timeout');
          failProcessing(setMessages, '职级匹配服务暂时不可用');
          setStep3Ready(true);
          sendBotMsg('职级匹配服务暂时不可用，请手动确认各职级对应关系。', 300);
        }
      })();
    }
  }, [substep, step3MsgsSent, sendBotMsg, sessionId, setParseResult]);

  // =====================================================================
  // Step 4: 职能匹配（进入时调 LLM）
  // =====================================================================
  useEffect(() => {
    if (substep === 4 && !step4MsgsSent) {
      setStep4MsgsSent(true);

      (async () => {
        appendProcessingStep(setMessages, '正在匹配岗位的职能类别');
        if (!sessionId) { setStep4Ready(true); return; }

        const apiPromise = runFuncMatch(sessionId)
          .then(res => ({ ok: true as const, res }))
          .catch(err => ({ ok: false as const, err }));
        const apiResult = await withTimeout(apiPromise, 30000);

        if (apiResult?.ok) {
          const data = apiResult.res.data;
          setFuncData(data);
          finishProcessing(setMessages);
          setStep4Ready(true);
          sendBotMsg(data.sparky_message || '职能匹配完成，请确认右边的映射关系。', 300);
        } else {
          console.warn('[DataConfirm] func matching failed:', apiResult?.ok === false ? apiResult.err : 'timeout');
          failProcessing(setMessages, '职能匹配服务暂时不可用');
          setStep4Ready(true);
          sendBotMsg('职能匹配服务暂时不可用，请手动确认各岗位对应职能。', 300);
        }
      })();
    }
  }, [substep, step4MsgsSent, sendBotMsg, sessionId, setParseResult]);

  // =====================================================================
  // Step 5: 准备就绪
  // =====================================================================
  useEffect(() => {
    if (substep === 5 && !step5MsgsSent) {
      setStep5MsgsSent(true);
      const unlocked = parseResult?.unlocked_modules || [];
      const locked = parseResult?.locked_modules || [];

      const readyMsg = `数据准备好了！这次诊断将覆盖${unlocked.slice(0, 3).join('、')}等 ${unlocked.length} 个维度。`;
      const lockedMsg = locked.length > 0
        ? `如果你能补充相关数据，我还能帮你做 ${locked.map(l => `${l.name}（${l.reason}）`).join('、')}。不补也没关系，点"开始诊断分析"直接跑报告。`
        : '所有分析模块都已解锁！点"开始诊断分析"直接跑报告。';

      sendBotMsg(readyMsg, 300).then(() => sendBotMsg(lockedMsg, 1200));
    }
  }, [substep, step5MsgsSent, sendBotMsg, parseResult]);

  // --- Handlers ---
  const handleAcceptCompleteness = () => {
    const rowMissing = parseResult?.completeness_issues?.row_missing || [];
    const msg = rowMissing.length > 0
      ? `好的，这 ${rowMissing.length} 条缺失记录已排除，不影响整体分析。接下来检查一下数据口径问题...`
      : '好的，数据完整度没问题。接下来检查一下数据口径问题...';
    addMsg({ role: 'bot', text: msg });
    setTimeout(() => advanceStep(1), 800);
  };

  const handleReupload = () => {
    addMsg({ role: 'bot', text: '好的，你补完数据后重新上传就行，我在这儿等你' });
  };

  const handleStepClick = (step: number) => {
    if (step <= substep) setViewingStep(step);
  };

  const renderStepContent = () => {
    switch (viewingStep) {
      case 1:
        return step1Ready || viewingStep !== substep
          ? <StepCompleteness onAccept={handleAcceptCompleteness} onReupload={handleReupload} parseResult={parseResult} />
          : <div className="wizard-content"><div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 0' }}>Sparky 正在分析数据...</div></div>;
      case 2:
        return step2Ready || viewingStep !== substep
          ? <StepCleansing parseResult={parseResult} setParseResult={setParseResult} sessionId={sessionId} onNext={() => advanceStep(2)} />
          : <div className="wizard-content"><div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 0' }}>Sparky 正在分析数据...</div></div>;
      case 3:
        return step3Ready
          ? <StepGradeMatch gradeData={gradeData} onNext={() => advanceStep(3)} />
          : <div className="wizard-content"><div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 0' }}>Sparky 正在匹配职级...</div></div>;
      case 4:
        return step4Ready
          ? <StepFuncMatch funcData={funcData} onNext={() => advanceStep(4)} />
          : <div className="wizard-content"><div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 0' }}>Sparky 正在匹配职能...</div></div>;
      case 5:
        return (
          <StepReady onStart={onComplete} onStepClick={s => setViewingStep(s)} onReupload={handleReupload} parseResult={parseResult} interviewNotes={interviewNotes} />
        );
      default:
        return null;
    }
  };

  return (
    <div className="fade-enter">
      <WizardProgress currentStep={viewingStep} completedSteps={completedSteps} maxReachedStep={substep} onStepClick={handleStepClick} />
      {renderStepContent()}
    </div>
  );
}

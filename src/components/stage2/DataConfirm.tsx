import { useState, useEffect, useCallback, useRef, type MutableRefObject } from 'react';
import WizardProgress from './WizardProgress';
import StepCompleteness from './StepCompleteness';
import StepCleansing from './StepCleansing';
import StepGradeMatch from './StepGradeMatch';
import StepFuncMatch from './StepFuncMatch';
import StepReady from './StepReady';
import { getCompletenessSummary, createSnapshot, runCleansing, runGradeMatch, runFuncMatch } from '../../api/client';
import type { Message, ParseResult } from '../../types';

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
  const [l7Choice, setL7Choice] = useState<string | null>(null);
  const [funcChoice, setFuncChoice] = useState<string | null>(null);
  const [step2MsgsSent, setStep2MsgsSent] = useState(false);
  const [step2Ready, setStep2Ready] = useState(false);
  const [step3MsgsSent, setStep3MsgsSent] = useState(false);
  const [step4MsgsSent, setStep4MsgsSent] = useState(false);
  const [step5MsgsSent, setStep5MsgsSent] = useState(false);

  // Helper: send Sparky message with streaming output
  const sendBotMsg = useCallback((text: string, delay: number) => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        addMsg({ role: 'bot', text: '' });
        let displayed = 0;
        const timer = setInterval(() => {
          displayed = Math.min(displayed + 1, text.length);
          setMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].role === 'bot') {
              updated[lastIdx] = { role: 'bot', text: text.slice(0, displayed) };
            }
            return updated;
          });
          if (displayed >= text.length) {
            clearInterval(timer);
            resolve();
          }
        }, 30);
      }, delay);
    });
  }, [addMsg, setMessages]);

  const advanceStep = useCallback((fromStep: number) => {
    const nextStep = fromStep + 1;
    setCompletedSteps(prev => prev.includes(fromStep) ? prev : [...prev, fromStep]);
    setSubstep(prev => nextStep > prev ? nextStep : prev);
    setViewingStep(nextStep);
  }, []);

  // --- Choices ---
  const handleL7Choice = useCallback((choice: string) => {
    setL7Choice(choice);
    const label = choice === 'director' ? '总监级' : '高级经理级';
    setTimeout(() => addMsg({ role: 'bot', text: `明白了，L7 按${label}处理 ✓` }), 300);
    setTimeout(() => advanceStep(3), 1200);
  }, [addMsg, advanceStep]);

  const handleFuncChoice = useCallback((choice: string) => {
    setFuncChoice(choice);
    const label = choice === 'digital' ? '数字营销' : '用户增长';
    setTimeout(() => addMsg({ role: 'bot', text: `收到，增长黑客归入${label}类别 ✓` }), 300);
    setTimeout(() => advanceStep(4), 1200);
  }, [addMsg, advanceStep]);

  // --- Text input handler ---
  useEffect(() => {
    textInputRef.current = (text: string) => {
      const lower = text.toLowerCase();
      if (viewingStep === 3 && l7Choice === null) {
        if (lower.includes('总监')) { handleL7Choice('director'); return true; }
        if (lower.includes('高级经理') || lower.includes('经理')) { handleL7Choice('senior_mgr'); return true; }
      }
      if (viewingStep === 4 && funcChoice === null) {
        if (lower.includes('营销') || lower.includes('数字')) { handleFuncChoice('digital'); return true; }
        if (lower.includes('增长') || lower.includes('运营') || lower.includes('用户')) { handleFuncChoice('growth'); return true; }
      }
      return false;
    };
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
      // 解析阶段
      await sendBotMsg('正在读取 Excel 结构...', 1500);
      await sendBotMsg('正在识别字段和数据类型...', 2500);
      await sendBotMsg(`解析完成！识别到 ${emp} 条员工记录，覆盖 ${gradeCount} 个职级（${gradeRange}）、${deptCount} 个部门。`, 3000);

      // 完整度分析阶段
      await sendBotMsg('接下来做一下数据完整度分析...', 2500);
      await sendBotMsg('正在检查各字段填充情况...', 2500);

      // 汇总完整度数据给 AI
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

      await sendBotMsg(aiMsg, 1500);
      setStep1Ready(true);

      // 没有任何问题时自动推进
      if (uniqueRows.size === 0 && colMissing.length === 0) {
        setTimeout(() => advanceStep(1), 2000);
      }
    })();
  }, [substep, parseResult, sendBotMsg, sessionId, advanceStep]);

  // =====================================================================
  // Step 2: 快照 → 数据清洗（进入时先复制数据，再调 AI cleansing）
  // =====================================================================
  useEffect(() => {
    if (substep === 2 && !step2MsgsSent) {
      setStep2MsgsSent(true);

      (async () => {
        // 1. 先复制数据
        await sendBotMsg('我先复制一份你的原始数据，后续的清洗和修正都在副本上操作，改错了随时可以回退。', 1500);
        if (sessionId) {
          try { await createSnapshot(sessionId); } catch {}
        }

        // 2. 开始清洗
        await sendBotMsg('让我检查一下数据质量...', 2000);

        // 3. 调 AI cleansing，等结果回来展示 AI 生成的总结
        if (sessionId) {
          try {
            const res = await runCleansing(sessionId);
            if (res.data.cleansing_corrections) {
              setParseResult(prev => prev ? { ...prev, cleansing_corrections: res.data.cleansing_corrections } : prev);
            }
            const aiMsg = res.data.sparky_message
              || (res.data.cleansing_corrections?.length
                ? '右边可以看到清洗详情，有不对的可以撤回。'
                : '数据质量没问题，不需要额外修正。');
            await sendBotMsg(aiMsg, 500);
            setStep2Ready(true);
          } catch {
            await sendBotMsg('数据清洗服务暂时不可用，你可以手动检查后继续。', 500);
            setStep2Ready(true);
          }
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

      sendBotMsg('接下来把你们的职级跟市场标准对齐...', 300);

      if (sessionId) {
        runGradeMatch(sessionId).then(res => {
          const data = res.data;
          if (data.grade_matching) {
            setParseResult(prev => prev ? { ...prev, grade_matching: data.grade_matching } : prev);
          }
          const confirmed = (data.grade_matching || []).filter((g: any) => g.confirmed).length;
          const unconfirmed = (data.grade_matching || []).filter((g: any) => !g.confirmed);
          const msg = unconfirmed.length > 0
            ? `大部分职级都对上了（${confirmed} 个高置信度），但 ${unconfirmed.slice(0, 3).map((g: any) => g.client_grade).join('、')} 我拿不准，需要你确认一下。`
            : `所有 ${data.grade_matching?.length || 0} 个职级都高置信度匹配上了！`;
          sendBotMsg(msg, 500);
        }).catch(err => {
          console.warn('[DataConfirm] grade matching failed:', err);
          sendBotMsg('职级匹配服务暂时不可用，请手动确认各职级对应关系。', 500);
        });
      }
    }
  }, [substep, step3MsgsSent, sendBotMsg, sessionId, setParseResult]);

  // =====================================================================
  // Step 4: 职能匹配（进入时调 LLM）
  // =====================================================================
  useEffect(() => {
    if (substep === 4 && !step4MsgsSent) {
      setStep4MsgsSent(true);

      sendBotMsg('最后匹配一下岗位的职能类别...', 300);

      if (sessionId) {
        runFuncMatch(sessionId).then(res => {
          const data = res.data;
          if (data.function_matching) {
            setParseResult(prev => prev ? { ...prev, function_matching: data.function_matching } : prev);
          }
          const confirmed = (data.function_matching || []).filter((f: any) => f.confirmed).length;
          const unconfirmed = (data.function_matching || []).filter((f: any) => !f.confirmed);
          const msg = unconfirmed.length > 0
            ? `大部分岗位都匹配上了（${confirmed} 个高置信度），但 ${unconfirmed.slice(0, 3).map((f: any) => f.title).join('、')} 我不太确定，需要你看一下。`
            : `所有 ${data.function_matching?.length || 0} 个岗位都匹配上了！`;
          sendBotMsg(msg, 500);
        }).catch(err => {
          console.warn('[DataConfirm] func matching failed:', err);
          sendBotMsg('职能匹配服务暂时不可用，请手动确认各岗位对应职能。', 500);
        });
      }
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
        return (
          <StepGradeMatch l7Choice={l7Choice} onL7Choice={handleL7Choice} parseResult={parseResult} onNext={() => advanceStep(3)} />
        );
      case 4:
        return (
          <StepFuncMatch funcChoice={funcChoice} onFuncChoice={handleFuncChoice} parseResult={parseResult} onNext={() => advanceStep(4)} />
        );
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

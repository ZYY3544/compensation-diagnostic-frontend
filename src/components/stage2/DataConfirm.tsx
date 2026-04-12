import { useState, useEffect, useCallback, useRef, type MutableRefObject } from 'react';
import WizardProgress from './WizardProgress';
import DataOverview from './DataOverview';
import StepCompleteness from './StepCompleteness';
import StepCleansing from './StepCleansing';
import StepGradeMatch from './StepGradeMatch';
import StepFuncMatch from './StepFuncMatch';
import StepReady from './StepReady';
import { runCleansing, runGradeMatch, runFuncMatch } from '../../api/client';
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
  const [substep, setSubstep] = useState(0);  // 0 = 概览, 1-5 = wizard
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [viewingStep, setViewingStep] = useState(0);
  const [overviewReady, setOverviewReady] = useState(false);
  const overviewMsgsSent = useRef(false);
  const [taxChoice, setTaxChoice] = useState<string | null>(null);
  const [l7Choice, setL7Choice] = useState<string | null>(null);
  const [funcChoice, setFuncChoice] = useState<string | null>(null);
  const [reverted, setReverted] = useState([false, false, false]);
  const [step1MsgsSent, setStep1MsgsSent] = useState(false);
  const [step2MsgsSent, setStep2MsgsSent] = useState(false);
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
  const handleTaxChoice = useCallback((choice: string) => {
    setTaxChoice(choice);
    const label = choice === 'pre' ? '税前' : '税后';
    setTimeout(() => addMsg({ role: 'bot', text: `好的，按${label}数据处理 ✓` }), 300);
    setTimeout(() => advanceStep(2), 1200);
  }, [addMsg, advanceStep]);

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
      if (viewingStep === 2 && taxChoice === null) {
        if (lower.includes('税前')) { handleTaxChoice('pre'); return true; }
        if (lower.includes('税后')) { handleTaxChoice('post'); return true; }
      }
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
  // Step 0: 概览阶段 — Sparky 多阶段动画 → 展示概览面板
  // =====================================================================
  useEffect(() => {
    if (substep !== 0 || overviewMsgsSent.current) return;
    overviewMsgsSent.current = true;

    const emp = parseResult?.employee_count || 0;
    const gradeCount = parseResult?.grade_count || 0;
    const deptCount = parseResult?.department_count || 0;
    const sheetCount = parseResult?.sheet_count || 1;
    const gradeRange = parseResult?.grades?.length
      ? `${parseResult.grades[0]}-${parseResult.grades[parseResult.grades.length - 1]}`
      : '';

    (async () => {
      // 解析阶段
      await sendBotMsg('正在读取 Excel 结构...', 300);
      await sendBotMsg('正在识别字段和数据类型...', 1500);
      await sendBotMsg(`解析完成！识别到 ${emp} 条员工记录，覆盖 ${gradeCount} 个职级（${gradeRange}）、${deptCount} 个部门。`, 2000);

      // 完整度分析阶段
      await sendBotMsg('接下来做一下数据完整度分析...', 1200);
      await sendBotMsg('正在检查各字段填充情况...', 1500);

      const sheetMsg = sheetCount >= 2
        ? `数据读完了，${sheetCount} 张表都识别到了。你看看右边的字段和数量对不对，没问题的话我们往下走。`
        : '数据读完了。你看看右边的字段和数量对不对，没问题的话我们往下走。';
      await sendBotMsg(sheetMsg, 1500);

      setOverviewReady(true);
    })();
  }, [substep, parseResult, sendBotMsg]);

  // 概览确认 → 进入 wizard step 1
  const handleOverviewConfirm = useCallback(() => {
    setSubstep(1);
    setViewingStep(1);
  }, []);

  // =====================================================================
  // Step 1: 完整性检查（纯展示，数据已在 upload 时算好）
  // =====================================================================
  useEffect(() => {
    if (substep === 1 && !step1MsgsSent) {
      setStep1MsgsSent(true);
      const rowMissing = parseResult?.completeness_issues?.row_missing || [];
      const colMissing = parseResult?.completeness_issues?.column_missing || [];

      let missingMsg: string;
      if (rowMissing.length > 0) {
        const desc = rowMissing.slice(0, 3).map((r: any) => `第 ${r.row} 行${r.field}`).join('、');
        missingMsg = `有 ${rowMissing.length} 条记录关键字段缺失（${desc}）。建议你在 Excel 里补完后重新上传，或者直接跳过，我会排除这些记录继续分析。`;
      } else {
        missingMsg = '所有记录的关键字段都有值，数据完整度很好！';
      }

      let colMsg = '';
      if (colMissing.length > 0) {
        const colNames = colMissing.map((c: any) => c.field).join('、');
        colMsg = `另外有几个可选字段整列没填——${colNames}。这些不影响核心诊断，但相关的深度分析会受限。`;
      }

      sendBotMsg('先看看数据完整度...', 300).then(() => {
        return sendBotMsg(missingMsg, 1000);
      }).then(() => {
        if (colMsg) return sendBotMsg(colMsg, 1200);
      }).then(() => {
        if (rowMissing.length === 0 && colMissing.length === 0) {
          setTimeout(() => advanceStep(1), 1500);
        }
      });
    }
  }, [substep, step1MsgsSent, sendBotMsg, parseResult, advanceStep]);

  // =====================================================================
  // Step 2: 数据清洗（进入时后台调 AI cleansing LLM）
  // =====================================================================
  useEffect(() => {
    if (substep === 2 && !step2MsgsSent) {
      setStep2MsgsSent(true);
      const corrections = parseResult?.cleansing_corrections || [];

      // 先用代码层结果展示
      const corrMsg = corrections.length > 0
        ? `发现几个需要处理的地方，我已经帮你自动修正了 ${corrections.length} 项。右边可以看到详情，有不对的可以撤回。`
        : '数据口径看起来没有明显问题，不需要额外修正。';

      sendBotMsg('让我检查一下数据质量...', 300).then(() => {
        return sendBotMsg(corrMsg, 1000);
      }).then(() => {
        return sendBotMsg('对了，有一个需要你确认——你的薪酬数据是税前还是税后的？', 800);
      });

      // 后台并行调 AI cleansing，结果回来后更新 parseResult
      if (sessionId) {
        runCleansing(sessionId).then(res => {
          const data = res.data;
          if (data.cleansing_corrections) {
            setParseResult(prev => prev ? { ...prev, cleansing_corrections: data.cleansing_corrections } : prev);
          }
        }).catch(err => console.warn('[DataConfirm] AI cleansing failed:', err));
      }
    }
  }, [substep, step2MsgsSent, sendBotMsg, parseResult, sessionId, setParseResult]);

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

  const handleRevert = (idx: number) => {
    setReverted(prev => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  };

  const handleStepClick = (step: number) => {
    if (step <= substep) setViewingStep(step);
  };

  const renderStepContent = () => {
    switch (viewingStep) {
      case 0:
        return overviewReady && parseResult
          ? <DataOverview parseResult={parseResult} onConfirm={handleOverviewConfirm} />
          : <div className="wizard-content"><div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 0' }}>Sparky 正在分析数据...</div></div>;
      case 1:
        return <StepCompleteness onAccept={handleAcceptCompleteness} onReupload={handleReupload} parseResult={parseResult} />;
      case 2:
        return (
          <StepCleansing taxChoice={taxChoice} onTaxChoice={handleTaxChoice} reverted={reverted} onRevert={handleRevert} parseResult={parseResult} onNext={() => advanceStep(2)} />
        );
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
      {viewingStep >= 1 && (
        <WizardProgress currentStep={viewingStep} completedSteps={completedSteps} maxReachedStep={substep} onStepClick={handleStepClick} />
      )}
      {renderStepContent()}
    </div>
  );
}

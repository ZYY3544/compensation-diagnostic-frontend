import { useState, useEffect, useCallback, type MutableRefObject } from 'react';
import WizardProgress from './WizardProgress';
import StepParsing from './StepParsing';
import StepCompleteness from './StepCompleteness';
import StepCleansing from './StepCleansing';
import StepGradeMatch from './StepGradeMatch';
import StepFuncMatch from './StepFuncMatch';
import StepReady from './StepReady';
import type { Message, ParseResult } from '../../types';

interface DataConfirmProps {
  onComplete: () => void;
  addMsg: (msg: Message) => void;
  setShowTyping: (v: boolean) => void;
  textInputRef: MutableRefObject<((text: string) => boolean) | null>;
  parseResult?: ParseResult | null;
}

export default function DataConfirm({ onComplete, addMsg, setShowTyping, textInputRef, parseResult }: DataConfirmProps) {
  const [substep, setSubstep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [viewingStep, setViewingStep] = useState(1);
  const [parsing, setParsing] = useState(true);
  const [taxChoice, setTaxChoice] = useState<string | null>(null);
  const [l7Choice, setL7Choice] = useState<string | null>(null);
  const [funcChoice, setFuncChoice] = useState<string | null>(null);
  const [reverted, setReverted] = useState([false, false, false]);
  const [step1MsgsSent, setStep1MsgsSent] = useState(false);
  const [step2MsgsSent, setStep2MsgsSent] = useState(false);
  const [step3MsgsSent, setStep3MsgsSent] = useState(false);
  const [step4MsgsSent, setStep4MsgsSent] = useState(false);
  const [step5MsgsSent, setStep5MsgsSent] = useState(false);
  const [step6MsgsSent, setStep6MsgsSent] = useState(false);

  // Helper: send Sparky message with typing indicator
  const sendBotMsg = useCallback((text: string, delay: number) => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setShowTyping(true);
        setTimeout(() => {
          setShowTyping(false);
          addMsg({ role: 'bot', text });
          resolve();
        }, 600);
      }, delay);
    });
  }, [addMsg, setShowTyping]);

  // Advance to next step
  const advanceStep = useCallback((fromStep: number) => {
    const nextStep = fromStep + 1;
    setCompletedSteps(prev => prev.includes(fromStep) ? prev : [...prev, fromStep]);
    setSubstep(prev => nextStep > prev ? nextStep : prev);
    setViewingStep(nextStep);
  }, []);

  // Handle tax choice from left panel
  const handleTaxChoice = useCallback((choice: string) => {
    setTaxChoice(choice);
    const label = choice === 'pre' ? '税前' : '税后';
    setTimeout(() => {
      addMsg({ role: 'bot', text: `好的，按${label}数据处理 ✓` });
    }, 300);
    setTimeout(() => advanceStep(3), 1200);
  }, [addMsg, advanceStep]);

  // Handle L7 choice
  const handleL7Choice = useCallback((choice: string) => {
    setL7Choice(choice);
    const label = choice === 'director' ? '总监级' : '高级经理级';
    setTimeout(() => {
      addMsg({ role: 'bot', text: `明白了，L7 按${label}处理 ✓` });
    }, 300);
    setTimeout(() => advanceStep(4), 1200);
  }, [addMsg, advanceStep]);

  // Handle function choice
  const handleFuncChoice = useCallback((choice: string) => {
    setFuncChoice(choice);
    const label = choice === 'digital' ? '数字营销' : '用户增长';
    setTimeout(() => {
      addMsg({ role: 'bot', text: `收到，增长黑客归入${label}类别 ✓` });
    }, 300);
    setTimeout(() => advanceStep(5), 1200);
  }, [addMsg, advanceStep]);

  // Register text input handler for right-panel chat sync
  useEffect(() => {
    textInputRef.current = (text: string) => {
      const lower = text.toLowerCase();
      // Tax choice
      if (viewingStep === 3 && taxChoice === null) {
        if (lower.includes('税前')) {
          handleTaxChoice('pre');
          return true;
        }
        if (lower.includes('税后')) {
          handleTaxChoice('post');
          return true;
        }
      }
      // L7 choice
      if (viewingStep === 4 && l7Choice === null) {
        if (lower.includes('总监')) {
          handleL7Choice('director');
          return true;
        }
        if (lower.includes('高级经理') || lower.includes('经理')) {
          handleL7Choice('senior_mgr');
          return true;
        }
      }
      // Func choice
      if (viewingStep === 5 && funcChoice === null) {
        if (lower.includes('营销') || lower.includes('数字')) {
          handleFuncChoice('digital');
          return true;
        }
        if (lower.includes('增长') || lower.includes('运营') || lower.includes('用户')) {
          handleFuncChoice('growth');
          return true;
        }
      }
      return false;
    };
  });

  // Step 1: auto messages + auto advance
  useEffect(() => {
    if (substep === 1 && !step1MsgsSent) {
      setStep1MsgsSent(true);
      const empCount = parseResult?.employee_count ?? 126;
      const gradeCount = parseResult?.grade_count ?? 6;
      const deptCount = parseResult?.department_count ?? 5;
      const grades = parseResult?.grades?.join('-') || 'L3-L8';
      sendBotMsg('让我先看看你的数据结构...', 300).then(() => {
        setTimeout(() => {
          setParsing(false);
          sendBotMsg(`好的，解析完成！识别到 ${empCount} 条员工记录，覆盖 ${gradeCount} 个职级（${grades}）、${deptCount} 个部门。`, 500).then(() => {
            setTimeout(() => {
              setCompletedSteps(prev => [...prev, 1]);
              setSubstep(2);
              setViewingStep(2);
            }, 2000);
          });
        }, 2000);
      });
    }
  }, [substep, step1MsgsSent, sendBotMsg, parseResult]);

  // Step 2: completeness check messages (dynamic from parseResult)
  useEffect(() => {
    if (substep === 2 && !step2MsgsSent) {
      setStep2MsgsSent(true);
      const sparky = (parseResult as any)?.sparky_messages;
      const rowMissing = parseResult?.completeness_issues?.row_missing || [];
      const colMissing = parseResult?.completeness_issues?.column_missing || [];

      // Build dynamic missing message
      let missingMsg: string;
      if (sparky?.step2_missing) {
        missingMsg = sparky.step2_missing;
      } else if (rowMissing.length > 0) {
        const desc = rowMissing.slice(0, 3).map((r: any) => `第 ${r.row} 行${r.field}`).join('、');
        missingMsg = `有 ${rowMissing.length} 条记录关键字段缺失（${desc}）。建议你在 Excel 里补完后重新上传，或者直接跳过，我会排除这些记录继续分析。`;
      } else {
        missingMsg = '所有记录的关键字段都有值，数据完整度很好！';
      }

      // Build dynamic column message
      let colMsg: string;
      if (sparky?.step2_columns) {
        colMsg = sparky.step2_columns;
      } else if (colMissing.length > 0) {
        const colNames = colMissing.map((c: any) => c.field).join('、');
        colMsg = `另外有几个可选字段整列没填——${colNames}。这些不影响核心诊断，但相关的深度分析会受限。左边可以看详情。`;
      } else {
        colMsg = '';
      }

      sendBotMsg('先看看数据完整度...', 300).then(() => {
        return sendBotMsg(missingMsg, 1000);
      }).then(() => {
        if (colMsg) {
          return sendBotMsg(colMsg, 1200);
        }
      });
    }
  }, [substep, step2MsgsSent, sendBotMsg, parseResult]);

  // Step 3: data cleaning messages (dynamic from parseResult)
  useEffect(() => {
    if (substep === 3 && !step3MsgsSent) {
      setStep3MsgsSent(true);
      const sparky = (parseResult as any)?.sparky_messages;
      const corrections = parseResult?.cleansing_corrections || [];

      let corrMsg: string;
      if (sparky?.step3_corrections) {
        corrMsg = sparky.step3_corrections;
      } else if (corrections.length > 0) {
        corrMsg = `发现几个需要处理的地方，我已经帮你自动修正了 ${corrections.length} 项。左边可以看到详情，有不对的可以撤回。`;
      } else {
        corrMsg = '数据口径看起来没有明显问题，不需要额外修正。';
      }

      sendBotMsg('让我检查一下数据质量...', 300).then(() => {
        return sendBotMsg(corrMsg, 1000);
      }).then(() => {
        return sendBotMsg('对了，有一个需要你确认——你的薪酬数据是税前还是税后的？', 800);
      });
    }
  }, [substep, step3MsgsSent, sendBotMsg, parseResult]);

  // Step 4: grade matching messages (dynamic from parseResult)
  useEffect(() => {
    if (substep === 4 && !step4MsgsSent) {
      setStep4MsgsSent(true);
      const sparky = (parseResult as any)?.sparky_messages;
      const gradeMatching = parseResult?.grade_matching || [];
      const unconfirmed = gradeMatching.filter(g => !g.confirmed);

      let gradeMsg: string;
      if (sparky?.step4_grades) {
        gradeMsg = sparky.step4_grades;
      } else if (unconfirmed.length > 0) {
        const uncertain = unconfirmed.slice(0, 3).map(g => g.client_grade).join('、');
        const confirmed = gradeMatching.filter(g => g.confirmed).length;
        gradeMsg = `大部分职级都对上了（${confirmed} 个高置信度），但 ${uncertain} 我拿不准，需要你确认一下。`;
      } else {
        gradeMsg = `所有 ${gradeMatching.length} 个职级都高置信度匹配上了！`;
      }

      sendBotMsg('接下来把你们的职级跟市场标准对齐...', 300).then(() => {
        return sendBotMsg(gradeMsg, 1000);
      });
    }
  }, [substep, step4MsgsSent, sendBotMsg, parseResult]);

  // Step 5: function matching messages (dynamic from parseResult)
  useEffect(() => {
    if (substep === 5 && !step5MsgsSent) {
      setStep5MsgsSent(true);
      const sparky = (parseResult as any)?.sparky_messages;
      const funcMatching = parseResult?.function_matching || [];
      const unconfirmed = funcMatching.filter(f => !f.confirmed);

      let funcMsg: string;
      if (sparky?.step5_functions) {
        funcMsg = sparky.step5_functions;
      } else if (unconfirmed.length > 0) {
        const uncertain = unconfirmed.slice(0, 3).map(f => f.title).join('、');
        const confirmed = funcMatching.filter(f => f.confirmed).length;
        funcMsg = `大部分岗位都匹配上了（${confirmed} 个高置信度），但 ${uncertain} 我不太确定，需要你看一下。`;
      } else {
        funcMsg = `所有 ${funcMatching.length} 个岗位都匹配上了！`;
      }

      sendBotMsg('最后匹配一下岗位的职能类别...', 300).then(() => {
        return sendBotMsg(funcMsg, 1000);
      });
    }
  }, [substep, step5MsgsSent, sendBotMsg, parseResult]);

  // Step 6: ready messages (dynamic from parseResult)
  useEffect(() => {
    if (substep === 6 && !step6MsgsSent) {
      setStep6MsgsSent(true);
      const sparky = (parseResult as any)?.sparky_messages;
      const unlocked = parseResult?.unlocked_modules || [];
      const locked = parseResult?.locked_modules || [];

      let readyMsg: string;
      if (sparky?.step6_ready) {
        readyMsg = sparky.step6_ready;
      } else {
        readyMsg = `数据准备好了！这次诊断将覆盖${unlocked.slice(0, 3).join('、')}等 ${unlocked.length} 个维度。`;
      }

      let lockedMsg: string;
      if (sparky?.step6_locked) {
        lockedMsg = sparky.step6_locked;
      } else if (locked.length > 0) {
        const lockHints = locked.map(l => `${l.name}（${l.reason}）`).join('、');
        lockedMsg = `如果你能补充相关数据，我还能帮你做 ${lockHints}。不补也没关系，点"下一步"进入业务访谈。`;
      } else {
        lockedMsg = '所有分析模块都已解锁！点"下一步"进入业务访谈。';
      }

      sendBotMsg(readyMsg, 300).then(() => {
        return sendBotMsg(lockedMsg, 1200);
      });
    }
  }, [substep, step6MsgsSent, sendBotMsg, parseResult]);

  // Handle completeness check accept
  const handleAcceptCompleteness = () => {
    const rowMissing = parseResult?.completeness_issues?.row_missing || [];
    const count = rowMissing.length;
    const msg = count > 0
      ? `好的，这 ${count} 条缺失记录已排除，不影响整体分析。接下来检查一下数据口径问题...`
      : '好的，数据完整度没问题。接下来检查一下数据口径问题...';
    addMsg({ role: 'bot', text: msg });
    setTimeout(() => advanceStep(2), 800);
  };

  const handleReupload = () => {
    addMsg({ role: 'bot', text: '好的，你补完数据后重新上传就行，我在这儿等你' });
  };

  // Handle revert
  const handleRevert = (idx: number) => {
    setReverted(prev => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  };

  // Handle progress bar click (go back to view a completed step)
  const handleStepClick = (step: number) => {
    if (step <= substep) {
      setViewingStep(step);
    }
  };

  // Render current step content
  const renderStepContent = () => {
    switch (viewingStep) {
      case 1:
        return <StepParsing parsing={parsing} parseResult={parseResult} />;
      case 2:
        return <StepCompleteness onAccept={handleAcceptCompleteness} onReupload={handleReupload} parseResult={parseResult} />;
      case 3:
        return (
          <StepCleansing
            taxChoice={taxChoice}
            onTaxChoice={handleTaxChoice}
            reverted={reverted}
            onRevert={handleRevert}
            parseResult={parseResult}
            onNext={() => advanceStep(3)}
          />
        );
      case 4:
        return (
          <StepGradeMatch
            l7Choice={l7Choice}
            onL7Choice={handleL7Choice}
            parseResult={parseResult}
            onNext={() => advanceStep(4)}
          />
        );
      case 5:
        return (
          <StepFuncMatch
            funcChoice={funcChoice}
            onFuncChoice={handleFuncChoice}
            parseResult={parseResult}
            onNext={() => advanceStep(5)}
          />
        );
      case 6:
        return (
          <StepReady
            onStart={onComplete}
            onStepClick={(s) => setViewingStep(s)}
            onReupload={handleReupload}
            parseResult={parseResult}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="fade-enter">
      <WizardProgress
        currentStep={viewingStep}
        completedSteps={completedSteps}
        maxReachedStep={substep}
        onStepClick={handleStepClick}
      />
      {renderStepContent()}
    </div>
  );
}

import { useState, useEffect, useCallback, type MutableRefObject } from 'react';
import WizardProgress from './WizardProgress';
import StepParsing from './StepParsing';
import StepCompleteness from './StepCompleteness';
import StepCleansing from './StepCleansing';
import StepGradeMatch from './StepGradeMatch';
import StepFuncMatch from './StepFuncMatch';
import StepReady from './StepReady';
import type { Message } from '../../types';

interface DataConfirmProps {
  onComplete: () => void;
  addMsg: (msg: Message) => void;
  setShowTyping: (v: boolean) => void;
  textInputRef: MutableRefObject<((text: string) => boolean) | null>;
}

export default function DataConfirm({ onComplete, addMsg, setShowTyping, textInputRef }: DataConfirmProps) {
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
      sendBotMsg('让我先看看你的数据结构...', 300).then(() => {
        setTimeout(() => {
          setParsing(false);
          sendBotMsg('好的，解析完成！识别到 126 条员工记录，覆盖 6 个职级（L3-L8）、5 个部门。', 500).then(() => {
            setTimeout(() => {
              setCompletedSteps(prev => [...prev, 1]);
              setSubstep(2);
              setViewingStep(2);
            }, 2000);
          });
        }, 2000);
      });
    }
  }, [substep, step1MsgsSent, sendBotMsg]);

  // Step 2: completeness check messages
  useEffect(() => {
    if (substep === 2 && !step2MsgsSent) {
      setStep2MsgsSent(true);
      sendBotMsg('先看看数据完整度...', 300).then(() => {
        return sendBotMsg('有 3 条记录关键字段缺失（第 15 行月薪、第 23 行职级、第 67 行岗位名称）。建议你在 Excel 里补完后重新上传，或者直接跳过，我会排除这些记录继续分析。', 1000);
      }).then(() => {
        return sendBotMsg('另外有几个可选字段整列没填——管理岗标识、关键岗位标识、管理复杂度。这些不影响核心诊断，但相关的深度分析会受限。左边可以看详情。', 1200);
      });
    }
  }, [substep, step2MsgsSent, sendBotMsg]);

  // Step 3: data cleaning messages
  useEffect(() => {
    if (substep === 3 && !step3MsgsSent) {
      setStep3MsgsSent(true);
      sendBotMsg('让我检查一下数据质量...', 300).then(() => {
        return sendBotMsg('发现几个需要处理的地方，我已经帮你自动修正了 3 项。左边可以看到详情，有不对的可以撤回。', 1000);
      }).then(() => {
        return sendBotMsg('对了，有一个需要你确认——你的薪酬数据是税前还是税后的？', 800);
      });
    }
  }, [substep, step3MsgsSent, sendBotMsg]);

  // Step 4: grade matching messages
  useEffect(() => {
    if (substep === 4 && !step4MsgsSent) {
      setStep4MsgsSent(true);
      sendBotMsg('接下来把你们的职级跟市场标准对齐...', 300).then(() => {
        return sendBotMsg('L3 到 L6 我都比较确定，但 L7 我拿不准——你们的 L7 是高级经理级还是总监级？', 1000);
      });
    }
  }, [substep, step4MsgsSent, sendBotMsg]);

  // Step 5: function matching messages
  useEffect(() => {
    if (substep === 5 && !step5MsgsSent) {
      setStep5MsgsSent(true);
      sendBotMsg('最后匹配一下岗位的职能类别...', 300).then(() => {
        return sendBotMsg('大部分都对上了。就是"增长黑客"这个岗位我不太确定，它主要是做数字营销相关的，还是偏用户增长运营的？', 1000);
      });
    }
  }, [substep, step5MsgsSent, sendBotMsg]);

  // Step 6: ready messages
  useEffect(() => {
    if (substep === 6 && !step6MsgsSent) {
      setStep6MsgsSent(true);
      sendBotMsg('数据准备好了！这次诊断将覆盖外部竞争力、内部公平性和薪酬结构三个维度。', 300).then(() => {
        return sendBotMsg('如果你能补充绩效数据和公司经营数据，我还能帮你做绩效关联和人效分析。不补也没关系，点"下一步"进入业务访谈', 1200);
      });
    }
  }, [substep, step6MsgsSent, sendBotMsg]);

  // Handle completeness check accept
  const handleAcceptCompleteness = () => {
    addMsg({ role: 'bot', text: '好的，这 3 条缺失记录已排除，不影响整体分析。接下来检查一下数据口径问题...' });
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
    if (completedSteps.includes(step)) {
      setViewingStep(step);
    }
  };

  // Render current step content
  const renderStepContent = () => {
    switch (viewingStep) {
      case 1:
        return <StepParsing parsing={parsing} />;
      case 2:
        return <StepCompleteness onAccept={handleAcceptCompleteness} onReupload={handleReupload} />;
      case 3:
        return (
          <StepCleansing
            taxChoice={taxChoice}
            onTaxChoice={handleTaxChoice}
            reverted={reverted}
            onRevert={handleRevert}
          />
        );
      case 4:
        return (
          <StepGradeMatch
            l7Choice={l7Choice}
            onL7Choice={handleL7Choice}
          />
        );
      case 5:
        return (
          <StepFuncMatch
            funcChoice={funcChoice}
            onFuncChoice={handleFuncChoice}
          />
        );
      case 6:
        return (
          <StepReady
            onStart={onComplete}
            onStepClick={(s) => setViewingStep(s)}
            onReupload={handleReupload}
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
        onStepClick={handleStepClick}
      />
      {renderStepContent()}
    </div>
  );
}

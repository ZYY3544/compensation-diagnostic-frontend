/**
 * 路径 A 单评 — 全程左右分栏 + 原地过渡。
 *
 * 替代之前的 NewJobModal 弹窗。从入口选择页点"评一个岗位"进入本视图。
 *
 * 三阶段（右侧 Workspace 原地过渡，不跳页）：
 *   form        填表（岗位名 / 部门 / 职能必填，JD 选填）
 *   evaluating  右侧 placeholder + 左 Sparky 流式过场（5 步业务语言进度）
 *   result      右侧候选方案卡片（CandidateBoard）+ 左 Sparky 流式发评估解读
 *
 * 跟 detail 视图的差别：
 *   - detail 视图通过"返回职级图谱"回到 matrix
 *   - single view 通过顶部"再评一个"重置回 form 阶段，"看图谱"才跳 matrix
 */
import { useEffect, useRef, useState } from 'react';
import SparkyPanel from '../components/layout/SparkyPanel';
import Workspace from '../components/layout/Workspace';
import CandidateBoard from './CandidateBoard';
import { jeCreateJob, type JeJob, type JeCandidate } from '../api/client';
import { nextMsgId } from '../lib/msgId';
import { appendProcessingStep, finishProcessing, failProcessing } from '../lib/processing';
import type { Message } from '../types';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

// 业务语言的过场步骤 — 不要技术术语
const EVALUATING_STEPS = [
  '分析岗位专业知识要求',
  '评估管理复杂度和沟通要求',
  '判断问题解决难度',
  '评估职责影响范围',
  '生成候选方案',
];
const STEP_PACE = 1500;       // 每步出现的间隔（ms）

interface Props {
  functionCatalog: Record<string, string[]>;
  onJobCreated: (job: JeJob) => void;     // 父组件用来累积 jobs / 触发 anomalies 检测
  onGoToMatrix: () => void;
  onBackToEntry: () => void;
}

type Stage = 'form' | 'evaluating' | 'result';

export default function SingleEvalView({ functionCatalog, onJobCreated, onGoToMatrix, onBackToEntry }: Props) {
  const [stage, setStage] = useState<Stage>('form');
  const [job, setJob] = useState<JeJob | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // 表单 state
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [func, setFunc] = useState('');
  const [jd, setJd] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const initRef = useRef(false);

  // 进入即触发 Sparky 流式开场
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    setMessages([{ role: 'user', text: '评一个岗位' }]);
    const replyId = nextMsgId();
    setTimeout(() => {
      setMessages(prev => [...prev, { id: replyId, role: 'bot', text: '' }]);
      streamText(buildIntroText(), (t) => {
        setMessages(prev => prev.map(m => m.id === replyId ? { ...m, text: t } : m));
      });
    }, 200);
  }, []);

  const handleSubmit = async () => {
    setFormError(null);
    if (!title.trim()) return setFormError('请填写岗位名称');
    if (!func) return setFormError('请选择业务职能');

    setSubmitting(true);
    setStage('evaluating');

    // 启动过场动画 — 5 步逐步出现，每步间隔 STEP_PACE。
    // 用 Promise 跟踪"动画跑完"，保证最后一步出现后才让 result 阶段开始。
    // 后端慢于动画时，最后一步会保持 doing 直到 API 返回；
    // 后端快于动画时，结果阶段会等动画跑完才进，避免 setTimeout 在结果消息后面
    // 继续 appendProcessingStep 污染对话流。
    const animationDone = new Promise<void>(resolve => {
      let i = 0;
      const tick = () => {
        if (i >= EVALUATING_STEPS.length) {
          resolve();
          return;
        }
        appendProcessingStep(setMessages, EVALUATING_STEPS[i]);
        i++;
        if (i < EVALUATING_STEPS.length) {
          setTimeout(tick, STEP_PACE);
        } else {
          // 最后一步出现后再等一拍，让用户看到 doing 状态
          setTimeout(resolve, STEP_PACE);
        }
      };
      tick();
    });

    // 后端调用与动画并行
    const apiPromise = jeCreateJob({
      title: title.trim(),
      function: func,
      department: department.trim() || undefined,
      jd_text: jd.trim() || undefined,
    });

    let apiResult: Awaited<typeof apiPromise> | null = null;
    let apiError: any = null;
    try {
      apiResult = await apiPromise;
    } catch (e) {
      apiError = e;
    }
    // 不管 API 成功失败，都要等动画跑完才进下一阶段
    await animationDone;

    if (apiError) {
      failProcessing(setMessages, '评估失败');
      const errId = nextMsgId();
      setMessages(prev => [...prev, { id: errId, role: 'bot', text: '' }]);
      streamText(
        `评估时遇到了问题：${apiError?.response?.data?.reason || apiError?.message || '未知错误'}\n\n点"重新评估"再试一次，或者检查一下岗位信息。`,
        (t) => setMessages(prev => prev.map(m => m.id === errId ? { ...m, text: t } : m)),
      );
      setStage('form');
      setSubmitting(false);
      return;
    }

    finishProcessing(setMessages);
    const newJob = apiResult!.data.job;
    setJob(newJob);
    setStage('result');

    // 评估解读 + 7 因子收敛说明
    const reading = buildReadingMessage(newJob);
    const readingId = nextMsgId();
    setTimeout(() => {
      setMessages(prev => [...prev, { id: readingId, role: 'bot', text: '' }]);
      streamText(reading, (t) => {
        setMessages(prev => prev.map(m => m.id === readingId ? { ...m, text: t } : m));
      }, () => {
        // 多方案差异解释（如果有同职级或多个候选）
        const candidates = newJob.result?.candidates || [];
        const comparison = buildCandidateComparison(candidates);
        if (comparison) {
          const compId = nextMsgId();
          setTimeout(() => {
            setMessages(prev => [...prev, { id: compId, role: 'bot', text: '' }]);
            streamText(comparison, (t) => {
              setMessages(prev => prev.map(m => m.id === compId ? { ...m, text: t } : m));
            });
          }, 300);
        }
      });
    }, 400);

    onJobCreated(newJob);
    setSubmitting(false);
  };

  const handleJobUpdated = (updated: JeJob) => {
    setJob(updated);
  };

  const handleEvalAnother = () => {
    // 重置回表单态，但保留 chat 历史 — 让用户看到上一次评估的结果对话
    setStage('form');
    setJob(null);
    setTitle(''); setDepartment(''); setFunc(''); setJd('');
    setFormError(null);
    // Sparky 提一句"准备评下一个"
    const id = nextMsgId();
    setMessages(prev => [...prev, { id, role: 'bot', text: '' }]);
    streamText('好，准备评下一个岗位。右边重新填一下。', (t) => {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, text: t } : m));
    });
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: '#FAFAFA' }}>
      {/* 左：Sparky 对话 */}
      <div style={{
        flex: 1, minWidth: 0, height: '100%',
        background: '#fff', borderRight: '1px solid #E2E8F0',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <SparkyPanel
          messages={messages}
          setMessages={setMessages}
          sessionId={null}
          visible={true}
          onClose={() => {}}
          onNonChatSend={() => true}        // 单评流程不接受用户对话输入（由表单/按钮驱动）
          embedded={true}
        />
      </div>

      {/* 右：Workspace 原地过渡 form / evaluating / result */}
      <Workspace mode="wide"
        title={stage === 'result' && job ? job.title : '评估一个岗位'}
        subtitle={stage === 'result' && job ? `${job.department || '未分组'} · ${job.function}` : undefined}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
        }}>
          <button onClick={onBackToEntry} style={ghostBtn}>← 回到入口</button>
          {stage === 'result' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleEvalAnother} style={ghostBtn}>再评一个</button>
              <button onClick={onGoToMatrix} style={primaryBtn}>看职级图谱</button>
            </div>
          )}
        </div>

        {/* 表单 / 过场 / 结果 三段式淡入淡出 */}
        <div style={{ position: 'relative' }}>
          <FadeBlock visible={stage === 'form'}>
            <FormView
              functionCatalog={functionCatalog}
              title={title} setTitle={setTitle}
              department={department} setDepartment={setDepartment}
              func={func} setFunc={setFunc}
              jd={jd} setJd={setJd}
              error={formError}
              onSubmit={handleSubmit}
              submitting={submitting}
            />
          </FadeBlock>

          <FadeBlock visible={stage === 'evaluating'}>
            <EvaluatingPlaceholder />
          </FadeBlock>

          <FadeBlock visible={stage === 'result'}>
            {job && (
              <>
                <ResultBanner job={job} />
                <CandidateBoard job={job} onUpdated={handleJobUpdated} />
              </>
            )}
          </FadeBlock>
        </div>
      </Workspace>
    </div>
  );
}

// ============================================================================
// 表单
// ============================================================================
function FormView({
  functionCatalog, title, setTitle, department, setDepartment,
  func, setFunc, jd, setJd, error, onSubmit, submitting,
}: {
  functionCatalog: Record<string, string[]>;
  title: string; setTitle: (v: string) => void;
  department: string; setDepartment: (v: string) => void;
  func: string; setFunc: (v: string) => void;
  jd: string; setJd: (v: string) => void;
  error: string | null;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const groups = Object.keys(functionCatalog);
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 24 }}>
      <div style={{ fontSize: 13, color: '#64748B', marginBottom: 18, lineHeight: 1.6 }}>
        填一下岗位基本信息，JD 是选填的 — 没有的话 AI 会根据岗位名和职能推断，结果会标"AI 推断"提醒你。
      </div>

      <FormRow label="岗位名称 *">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="如：高级产品经理" style={inputStyle} />
      </FormRow>

      <FormRow label="部门">
        <input value={department} onChange={e => setDepartment(e.target.value)} placeholder="如：产品部（选填）" style={inputStyle} />
      </FormRow>

      <FormRow label="业务职能 *">
        <select value={func} onChange={e => setFunc(e.target.value)} style={inputStyle}>
          <option value="">— 选择职能 —</option>
          {groups.map(g => (
            <optgroup key={g} label={g}>
              {functionCatalog[g].map(fn => (
                <option key={fn} value={fn}>{fn}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </FormRow>

      <FormRow label="岗位 JD（选填）">
        <textarea
          value={jd}
          onChange={e => setJd(e.target.value)}
          placeholder="粘贴岗位职责 + 任职要求 + 团队规模 + 汇报关系等。没有 JD 也可以提交，AI 会基于岗位名和职能推断。"
          rows={10}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
        />
        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
          有 JD 时结果置信度更高（"深度分析"），没有时会标"AI 推断 — 建议补 JD 提高准确度"
        </div>
      </FormRow>

      {error && <div style={errStyle}>{error}</div>}

      <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onSubmit} disabled={submitting} style={{ ...primaryBtn, padding: '10px 24px', fontSize: 14 }}>
          {submitting ? '评估中...' : '开始评估'}
        </button>
      </div>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, color: '#475569', marginBottom: 6, fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  );
}

// ============================================================================
// 过场占位（真正的进度在左 chat 的 ProcessingBlock 里渲染）
// ============================================================================
function EvaluatingPlaceholder() {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: '60px 24px', textAlign: 'center', color: '#64748B',
    }}>
      <div style={{ fontSize: 14, marginBottom: 8 }}>Sparky 正在评估这个岗位...</div>
      <div style={{ fontSize: 12, color: '#94A3B8' }}>左侧能看到分析进度，约 10-15 秒</div>
    </div>
  );
}

// ============================================================================
// 结果顶部 banner（总分 / 职级 / 三维分数 / confidence）
// ============================================================================
function ResultBanner({ job }: { job: JeJob }) {
  const r = (job.result || {}) as any;
  const grade = r.job_grade;
  const total = r.total_score;
  const kh = r.kh_score, ps = r.ps_score, acc = r.acc_score;
  const confidence = r.confidence as 'high' | 'low' | undefined;

  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: 20, marginBottom: 16,
    }}>
      <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
        <Stat label="Hay 职级" value={grade != null ? `G${grade}` : '—'} accent />
        <Stat label="总分" value={total ?? '—'} accent />
        <Stat label="Know-How" value={kh ?? '—'} />
        <Stat label="Problem Solving" value={ps ?? '—'} />
        <Stat label="Accountability" value={acc ?? '—'} />
        {confidence === 'low' && (
          <span style={{
            marginLeft: 'auto', padding: '4px 10px', borderRadius: 4,
            background: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: 600,
          }}>
            AI 推断 · 建议补 JD
          </span>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: accent ? 22 : 16, fontWeight: 700, color: accent ? BRAND : '#0F172A' }}>{value}</div>
    </div>
  );
}

// ============================================================================
// 三段淡入淡出包装器
// ============================================================================
function FadeBlock({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div style={{
      opacity: visible ? 1 : 0,
      pointerEvents: visible ? 'auto' : 'none',
      transition: 'opacity 0.25s',
      // 用 absolute 定位会让三段叠在一起；改用条件渲染，淡出后 unmount
      display: visible ? 'block' : 'none',
    }}>
      {children}
    </div>
  );
}

// ============================================================================
// Sparky 文案
// ============================================================================
function buildIntroText(): string {
  return [
    '准备好了。右边填一下岗位信息：',
    '',
    '· 岗位名称 — 必填，比如"高级产品经理"',
    '· 业务职能 — 必填，从下拉里选最贴近的',
    '· JD — 选填，没 JD 我也能基于岗位名做评估，但有 JD 结果会更准',
    '',
    '点"开始评估"，约 10-15 秒后出结果。',
  ].join('\n');
}

function buildReadingMessage(job: JeJob): string {
  const r = (job.result || {}) as any;
  const reasoning = (r.pk_reasoning || '').trim();
  const grade = r.job_grade;
  const confidence = r.confidence;
  const head = grade != null ? `**评估完成 — Hay 职级 G${grade}**` : '评估完成。';

  const reasoningPart = reasoning
    ? reasoning
    : '（这次评估没有 LLM 推理记录，可能是因子直接计算的结果。）';

  const tail = '其他 7 个因子是基于专业知识档位，按 Hay 因素匹配规则自动收敛出来的。你可以在右侧手动调整任何因子档位，分数会实时重算。';

  const confidenceTip = confidence === 'low'
    ? '\n\n⚠️ 这次没给 JD，结果是 AI 根据岗位名 + 职能推断的，置信度偏低。可以点上方"上传 JD 精细评估"补 JD 重评。'
    : '';

  return `${head}\n\n${reasoningPart}\n\n${tail}${confidenceTip}`;
}

function buildCandidateComparison(candidates: JeCandidate[]): string | null {
  if (!candidates || candidates.length < 2) return null;

  // 按职级分组，看是否有同职级
  const byGrade: Record<number, JeCandidate[]> = {};
  for (const c of candidates) {
    const g = c.job_grade;
    if (g != null) (byGrade[g] ||= []).push(c);
  }
  const sameGradeGroups = Object.values(byGrade).filter(g => g.length >= 2);

  const recommended = candidates[0];   // engine 把推荐方案放第一
  const recoLabel = `方案 A（G${recommended.job_grade}，${recommended.dominant} 主导${recommended.orientation ? ` · ${recommended.orientation}` : ''}）`;

  if (sameGradeGroups.length > 0 && candidates.length >= 2) {
    // 有同职级，重点解释差异
    const lines: string[] = ['几套候选方案的实质差异：', ''];
    candidates.forEach((c, i) => {
      const letter = String.fromCharCode(65 + i);
      const tilt = `${c.dominant} 占比最高${c.orientation ? `，${c.orientation}` : ''}`;
      const detail = `KH ${c.kh_score} · PS ${c.ps_score} · ACC ${c.acc_score}`;
      lines.push(`· 方案 ${letter} (G${c.job_grade})：${tilt}（${detail}）`);
    });
    lines.push('');
    lines.push(`推荐 ${recoLabel.split('（')[0]}，因为它跟你们这类岗位的"专业 / 管理 / 战略"权重最匹配。如果对岗位倾向有不同判断，可以直接采用其他方案。`);
    return lines.join('\n');
  }

  if (candidates.length >= 2) {
    // 不同职级，简单说明
    const range = `G${Math.min(...candidates.map(c => c.job_grade))} – G${Math.max(...candidates.map(c => c.job_grade))}`;
    return `给你准备了 ${candidates.length} 套候选方案，覆盖 ${range} 的职级范围。推荐 ${recoLabel.split('（')[0]}，是匹配度最高的那套。如果觉得这个岗位实际更高 / 更低一档，可以采用其他方案。`;
  }
  return null;
}

// ============================================================================
// 流式打字
// ============================================================================
function streamText(text: string, onUpdate: (t: string) => void, onDone?: () => void) {
  let displayed = 0;
  const timer = setInterval(() => {
    displayed = Math.min(displayed + 1, text.length);
    onUpdate(text.slice(0, displayed));
    if (displayed >= text.length) {
      clearInterval(timer);
      onDone?.();
    }
  }, 25);
}

// ============================================================================
// 样式
// ============================================================================
const primaryBtn: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 6, border: 'none',
  background: BRAND, color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 500,
};

const ghostBtn: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 6, border: '1px solid #E2E8F0',
  background: '#fff', color: '#475569', fontSize: 12, cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  border: '1px solid #E2E8F0', borderRadius: 6, outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
};

const errStyle: React.CSSProperties = {
  marginTop: 12, padding: '8px 12px', background: '#FEF2F2', color: '#991B1B',
  borderRadius: 6, fontSize: 12,
};

// 防止 BRAND_TINT unused warning
void BRAND_TINT;

/**
 * 战略澄清访谈 — LLM 驱动的多轮访谈,镜像 SdInterview / JeOnboarding。
 *
 * 流程:
 *   Opening → SC_Q1 (竞争领域) → SC_Q2 (方式) → SC_Q3 (差异化)
 *   → SC_Q4 (节奏) → SC_Q5 (盈利模式) → 提交 profile → 生成钻石模型
 *   → onComplete 跳到钻石模型展示页
 */
import { useEffect, useRef, useState } from 'react';
import SparkyPanel from '../components/layout/SparkyPanel';
import Workspace from '../components/layout/Workspace';
import { nextMsgId } from '../lib/msgId';
import type { Message } from '../types';
import {
  scSaveProfile, scGenerateDiamond, scInterviewExtract,
  type ScProfile, type ScDiamond,
} from '../api/client';

const API_BASE = (import.meta.env as any).VITE_API_URL || '/api';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

export type Stage = 'interview' | 'generating' | 'done' | 'error';
type StepId = 'Opening' | 'SC_Q1' | 'SC_Q2' | 'SC_Q3' | 'SC_Q4' | 'SC_Q5';

const STEP_ORDER: StepId[] = ['SC_Q1', 'SC_Q2', 'SC_Q3', 'SC_Q4', 'SC_Q5'];

const SC_WELCOME_MESSAGE = `你好,我是 Sparky,铭曦的战略顾问 AI。这是战略澄清工具。

**什么是战略澄清**

基于 Korn Ferry 钻石模型,把脑子里散乱的战略想法整理成 5 元素的结构化战略 + 6 项质量测试。区别于战略解码工具(那是把已经清楚的战略翻译到组织和部门),战略澄清是帮你从 0 到 1 把战略本身想清楚。

**接下来 15-20 分钟,4 步走完**

1. 我用 5 道题挖出钻石模型 5 元素 — 竞争领域 / 方式 / 差异化 / 节奏 / 盈利模式
2. 整理成结构化战略表述 + 一句话战略
3. 跑 6 项战略质量测试 (适合环境 / 利用资源 / 差异化可持续 / 内部一致 / 资源足够 / 可执行)
4. 识别 5 元素之间的张力或加固,标出信息不足的 gap

**说在前面**

过程中我会主动挑战空话 — 你说"做行业第一"我会追问"第一具体指什么指标"。这是工具最值钱的部分,请耐心跟我对话。

**第一个问题:你们的业务打算在哪里玩? 服务什么客户、做什么产品、覆盖哪些地域、价值链上的哪些环节?**`;

interface Props {
  onComplete: (profile: ScProfile, diamond: ScDiamond) => void;
  onSkip?: () => void;
}

export default function ScInterview({ onComplete, onSkip }: Props) {
  const [stage, setStage] = useState<Stage>('interview');
  const [profile, setProfile] = useState<Partial<ScProfile>>({
    arenas_md: '', vehicles_md: '', differentiators_md: '',
    staging_md: '', economic_logic_md: '',
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);

  const stepRef = useRef<StepId>('Opening');
  const roundRef = useRef<number>(1);
  const isFollowUpRef = useRef<boolean>(false);
  const lastSparkyQuestionRef = useRef<string>('');
  const profileRef = useRef<Partial<ScProfile>>({
    arenas_md: '', vehicles_md: '', differentiators_md: '',
    staging_md: '', economic_logic_md: '',
  });
  const initRef = useRef(false);
  const finishedDiamondRef = useRef<ScDiamond | null>(null);
  const finishedProfileRef = useRef<ScProfile | null>(null);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    // 一进 tool 直接展示 Sparky 开场白 (硬编码,无 LLM 延迟)
    // 介绍工具是什么 + 4 步流程 + 心理预期 + 第一题
    setMessages([
      { role: 'user', text: '我想做一次战略澄清' },
      { id: nextMsgId(), role: 'bot', text: SC_WELCOME_MESSAGE },
    ]);

    // 状态机直接进入 SC_Q1 round 1 (等用户回答第一题)
    stepRef.current = 'SC_Q1';
    roundRef.current = 1;
    isFollowUpRef.current = true;   // round 1 的回答都标 follow_up=true,跟原 Opening→Q1 流程一致
    lastSparkyQuestionRef.current = '你们的业务打算在哪里玩? 服务什么客户、做什么产品、覆盖哪些地域、价值链上的哪些环节?';

    fetch(`${API_BASE}/sc/health`, { method: 'GET' }).catch(() => {});
  }, []);

  const applyExtracted = (items: Array<{ field_name: string; value: string }>) => {
    setProfile(prev => {
      const next: Partial<ScProfile> = { ...prev };
      for (const item of items) {
        const v = (item.value || '').trim();
        if (!v) continue;
        if (item.field_name === 'arenas_md') next.arenas_md = v;
        else if (item.field_name === 'vehicles_md') next.vehicles_md = v;
        else if (item.field_name === 'differentiators_md') next.differentiators_md = v;
        else if (item.field_name === 'staging_md') next.staging_md = v;
        else if (item.field_name === 'economic_logic_md') next.economic_logic_md = v;
      }
      profileRef.current = next;
      return next;
    });
  };

  const buildContext = (): string => {
    const p = profileRef.current;
    const parts: string[] = [];
    if (p.arenas_md) parts.push(`【竞争领域】${p.arenas_md}`);
    if (p.vehicles_md) parts.push(`【方式】${p.vehicles_md}`);
    if (p.differentiators_md) parts.push(`【差异化】${p.differentiators_md}`);
    if (p.staging_md) parts.push(`【节奏】${p.staging_md}`);
    if (p.economic_logic_md) parts.push(`【盈利模式】${p.economic_logic_md}`);
    return parts.join('\n\n');
  };

  const getPreviousValue = (step: StepId): string => {
    const p = profileRef.current;
    if (step === 'SC_Q1') return p.arenas_md || '';
    if (step === 'SC_Q2') return p.vehicles_md || '';
    if (step === 'SC_Q3') return p.differentiators_md || '';
    if (step === 'SC_Q4') return p.staging_md || '';
    if (step === 'SC_Q5') return p.economic_logic_md || '';
    return '';
  };

  const callExtract = async (questionId: StepId, userAnswer: string) => {
    const loadingId = nextMsgId();
    setMessages(prev => [...prev, { id: loadingId, role: 'bot', text: 'Sparky 正在思考...' }]);

    try {
      const res = await scInterviewExtract({
        question_id: questionId,
        answer: userAnswer,
        previous_value: getPreviousValue(questionId),
        is_follow_up: isFollowUpRef.current,
        round: roundRef.current,
        follow_up_question: isFollowUpRef.current ? lastSparkyQuestionRef.current : '',
        context: buildContext(),
      });

      const { extracted, reply, follow_up } = res.data;

      if (Array.isArray(extracted)) applyExtracted(extracted);

      setMessages(prev => prev.map(m => m.id === loadingId ? { ...m, text: '' } : m));
      streamText(reply, (t) => {
        setMessages(prev => prev.map(m => m.id === loadingId ? { ...m, text: t } : m));
      });

      const boldMatch = reply.match(/\*\*([^*]+)\*\*/);
      lastSparkyQuestionRef.current = boldMatch ? boldMatch[1] : reply.slice(-60);

      if (questionId === 'Opening') {
        stepRef.current = 'SC_Q1';
        roundRef.current = 1;
        isFollowUpRef.current = true;
        return;
      }

      if (follow_up) {
        roundRef.current += 1;
        isFollowUpRef.current = true;
      } else {
        const idx = STEP_ORDER.indexOf(questionId);
        if (idx >= 0 && idx + 1 < STEP_ORDER.length) {
          stepRef.current = STEP_ORDER[idx + 1];
          roundRef.current = 1;
          isFollowUpRef.current = false;
          lastSparkyQuestionRef.current = '';
        } else {
          setTimeout(() => submitProfile(), reply.length * 25 + 500);
        }
      }
    } catch (err: any) {
      console.error('[ScInterview] extract failed', err);
      const msg = err?.response?.data?.error || err?.message || '网络抖动,刚才那条没收到';
      setMessages(prev => prev.map(m => m.id === loadingId ? {
        ...m,
        text: `刚才有点小问题:${msg}。再说一遍试试,或者直接说"跳过"我们用现有信息生成钻石模型。`,
      } : m));
    }
  };

  const handleUserAnswer = (text: string): boolean => {
    setMessages(prev => [...prev, { role: 'user', text }]);

    if (stage !== 'interview') {
      const replyId = nextMsgId();
      setMessages(prev => [...prev, { id: replyId, role: 'bot', text: '' }]);
      streamText(
        stage === 'generating'
          ? '钻石模型生成中,等几秒...'
          : '访谈我都收完了,稍等会自动展示钻石模型。',
        (t) => setMessages(prev => prev.map(m => m.id === replyId ? { ...m, text: t } : m)),
      );
      return true;
    }

    callExtract(stepRef.current, text);
    return true;
  };

  const submitProfile = async () => {
    setStage('generating');
    const p = profileRef.current;
    const finalProfile: ScProfile = {
      arenas_md: p.arenas_md || '',
      vehicles_md: p.vehicles_md || '',
      differentiators_md: p.differentiators_md || '',
      staging_md: p.staging_md || '',
      economic_logic_md: p.economic_logic_md || '',
    };

    const genId = nextMsgId();
    setMessages(prev => [...prev, { id: genId, role: 'bot', text: '' }]);
    streamText(
      `5 个元素都聊清楚了 — 竞争领域 / 方式 / 差异化 / 节奏 / 盈利模式。\n\n现在我来基于钻石模型整理这 5 元素 + 跑 6 项战略质量测试 + 检查内部一致性 + 标出完整性 gaps。这一步要 30-60 秒...`,
      (t) => setMessages(prev => prev.map(m => m.id === genId ? { ...m, text: t } : m)),
    );

    try {
      await scSaveProfile(finalProfile);
      const result = await scGenerateDiamond({ timeout: 0 });

      finishedProfileRef.current = finalProfile;
      finishedDiamondRef.current = result.data.diamond;

      const d = result.data.diamond;
      const doneId = nextMsgId();
      setMessages(prev => [...prev, { id: doneId, role: 'bot', text: '' }]);
      streamText(
        `**战略澄清产出已生成**\n\n包括:\n· 一句话战略表述\n· 钻石模型 5 元素整理版\n· ${d.quality_tests?.length || 0} 项质量测试\n· ${d.consistency_warnings?.length || 0} 条一致性观察\n· ${d.completeness_gaps?.length || 0} 个完整性 gap\n\n点右上角"看战略澄清产出 →"进入钻石模型视图。这页的对话历史 + 笔记都还在。`,
        (t) => setMessages(prev => prev.map(m => m.id === doneId ? { ...m, text: t } : m)),
        () => setStage('done'),
      );
    } catch (err: any) {
      const isNetwork = !err?.response;
      const msg = err?.response?.data?.reason || err?.message || '未知错误';
      setErrorText(msg);
      setStage('error');
      const errId = nextMsgId();
      setMessages(prev => [...prev, { id: errId, role: 'bot', text: '' }]);
      const detail = isNetwork
        ? '是网络问题,可能是后端冷启动或 LLM 那边超时。'
        : `LLM 那边报错了:${msg}`;
      streamText(
        `生成钻石模型失败 — ${detail}\n\n你可以:\n· 刷新页面重走访谈\n· 用上一版钻石模型(如果有)`,
        (t) => setMessages(prev => prev.map(m => m.id === errId ? { ...m, text: t } : m)),
      );
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: '#FAFAFA' }}>
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
          onNonChatSend={handleUserAnswer}
          embedded={true}
        />
      </div>

      <Workspace
        mode="wide"
        title="战略澄清笔记"
        subtitle="访谈中实时整理钻石模型 5 大元素的输入"
        headerExtra={onSkip && stage === 'interview' ? (
          <span
            onClick={onSkip}
            style={{
              fontSize: 13, color: BRAND, cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            跳过访谈,看上一版 →
          </span>
        ) : undefined}
      >
        {stage === 'done' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button
              onClick={() => {
                if (finishedProfileRef.current && finishedDiamondRef.current) {
                  onComplete(finishedProfileRef.current, finishedDiamondRef.current);
                }
              }}
              style={primaryBtn}
            >
              看战略澄清产出 →
            </button>
          </div>
        )}
        <NotesView profile={profile} stage={stage} errorText={errorText} />
      </Workspace>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 6, border: 'none',
  background: BRAND, color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 500,
};

function NotesView({ profile, stage, errorText }: {
  profile: Partial<ScProfile>;
  stage: Stage;
  errorText: string | null;
}) {
  const hasAny = !!(profile.arenas_md || profile.vehicles_md
    || profile.differentiators_md || profile.staging_md
    || profile.economic_logic_md);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!hasAny && (
        <div style={{
          padding: '40px 24px', textAlign: 'center', color: '#94A3B8', fontSize: 13,
          background: '#fff', border: '1px dashed #E2E8F0', borderRadius: 12,
        }}>
          访谈开始后这里会出现钻石模型 5 大元素 — 竞争领域 / 方式 / 差异化 / 节奏 / 盈利模式。访谈结束后我会基于这 5 元素生成钻石模型整理 + 6 项质量测试。
        </div>
      )}

      {hasAny && (
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
          padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          <NoteSection
            label="① 竞争领域 (Arenas)"
            empty="(待 Q1 收集) 在哪里玩"
            done={!!profile.arenas_md}
          >
            {profile.arenas_md && renderMd(profile.arenas_md)}
          </NoteSection>

          <NoteSection
            label="② 方式 (Vehicles)"
            empty="(待 Q2 收集) 怎么到达那里"
            done={!!profile.vehicles_md}
          >
            {profile.vehicles_md && renderMd(profile.vehicles_md)}
          </NoteSection>

          <NoteSection
            label="③ 差异化 (Differentiators)"
            empty="(待 Q3 收集) 怎么获胜"
            done={!!profile.differentiators_md}
          >
            {profile.differentiators_md && renderMd(profile.differentiators_md)}
          </NoteSection>

          <NoteSection
            label="④ 节奏 (Staging)"
            empty="(待 Q4 收集) 什么先做什么后做"
            done={!!profile.staging_md}
          >
            {profile.staging_md && renderMd(profile.staging_md)}
          </NoteSection>

          <NoteSection
            label="⑤ 盈利模式 (Economic Logic)"
            empty="(待 Q5 收集) 怎么赚钱"
            done={!!profile.economic_logic_md}
          >
            {profile.economic_logic_md && renderMd(profile.economic_logic_md)}
          </NoteSection>
        </div>
      )}

      {stage === 'generating' && (
        <div style={{
          background: BRAND_TINT, border: `1px solid ${BRAND}33`, borderRadius: 12,
          padding: '18px 16px', textAlign: 'center', color: BRAND, fontSize: 13,
          fontWeight: 500,
        }}>
          正在整理钻石模型 + 跑 6 项质量测试...
        </div>
      )}
      {stage === 'done' && (
        <div style={{
          background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 12,
          padding: '18px 16px', color: '#059669', fontSize: 13, lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>战略澄清产出已生成</div>
          <div style={{ color: '#065F46' }}>
            上面"看战略澄清产出 →"按钮进入钻石模型视图。
          </div>
        </div>
      )}
      {stage === 'error' && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12,
          padding: '18px 16px', color: '#B91C1C', fontSize: 13,
          lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>钻石模型生成失败</div>
          <div>{errorText || '未知错误'}</div>
        </div>
      )}
    </div>
  );
}

function NoteSection({ label, empty, done, children }: {
  label: string;
  empty: string;
  done: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div style={{
        fontSize: 11, color: done ? '#475569' : '#CBD5E1',
        fontWeight: 600, marginBottom: 6,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: done ? BRAND : '#E2E8F0',
          display: 'inline-block',
        }} />
        {label}
      </div>
      {done ? children : (
        <div style={{ fontSize: 12, color: '#CBD5E1', paddingLeft: 12, fontStyle: 'italic' }}>
          {empty}
        </div>
      )}
    </div>
  );
}

function renderMd(text: string): React.ReactNode {
  const lines = text.split('\n').filter(l => l.trim());
  return (
    <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
      {lines.map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p, j) => {
          if (p.startsWith('**') && p.endsWith('**')) {
            return <span key={j} style={{ color: '#0F172A', fontWeight: 600 }}>{p.slice(2, -2)}</span>;
          }
          return <span key={j}>{p}</span>;
        });
        return <div key={i}>{parts}</div>;
      })}
    </div>
  );
}

function streamText(text: string, onTick: (s: string) => void, onDone?: () => void) {
  let i = 0;
  const tick = () => {
    if (i >= text.length) {
      onDone?.();
      return;
    }
    i = Math.min(i + 1, text.length);
    onTick(text.slice(0, i));
    if (i < text.length) setTimeout(tick, 25);
    else onDone?.();
  };
  tick();
}

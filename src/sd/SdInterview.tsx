/**
 * 战略澄清访谈 — LLM 驱动的多轮访谈,镜像 JeOnboarding 模式。
 *
 * 流程:
 *   Opening (LLM 生成开场) → SD_Q1 (愿景) → SD_Q2 (业务模式) → SD_Q3 (增长机会)
 *   → SD_Q4 (核心能力) → SD_Q5 (关键约束) → 提交 profile → LLM 生成战略解码地图
 *   → onComplete 跳到解码地图视图
 *
 * 跟 JeOnboarding 同款 SparkyPanel + Workspace 左右分栏。
 * 右侧实时同步访谈采集到的 5 个字段笔记。
 */
import { useEffect, useRef, useState } from 'react';
import SparkyPanel from '../components/layout/SparkyPanel';
import Workspace from '../components/layout/Workspace';
import { nextMsgId } from '../lib/msgId';
import type { Message } from '../types';
import {
  sdSaveProfile, sdGenerateDecoding, sdInterviewExtract,
  type SdProfile, type SdDecoding,
} from '../api/client';

const API_BASE = (import.meta.env as any).VITE_API_URL || '/api';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

export type Stage = 'interview' | 'generating' | 'done' | 'error';
type StepId = 'Opening' | 'SD_Q1' | 'SD_Q2' | 'SD_Q3' | 'SD_Q4' | 'SD_Q5';

const STEP_ORDER: StepId[] = ['SD_Q1', 'SD_Q2', 'SD_Q3', 'SD_Q4', 'SD_Q5'];

interface Props {
  onComplete: (profile: SdProfile, decoding: SdDecoding) => void;
  onSkip?: () => void;
}

export default function SdInterview({ onComplete, onSkip }: Props) {
  const [stage, setStage] = useState<Stage>('interview');
  const [profile, setProfile] = useState<Partial<SdProfile>>({
    vision_md: '', business_model_md: '', growth_opportunities_md: '',
    core_capabilities: [], constraints_md: '',
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);

  const stepRef = useRef<StepId>('Opening');
  const roundRef = useRef<number>(1);
  const isFollowUpRef = useRef<boolean>(false);
  const lastSparkyQuestionRef = useRef<string>('');
  const profileRef = useRef<Partial<SdProfile>>({
    vision_md: '', business_model_md: '', growth_opportunities_md: '',
    core_capabilities: [], constraints_md: '',
  });
  const initRef = useRef(false);
  const finishedDecodingRef = useRef<SdDecoding | null>(null);
  const finishedProfileRef = useRef<SdProfile | null>(null);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    setMessages([{ role: 'user', text: '我想做一次战略解码,把战略翻译到各部门和岗位' }]);
    setTimeout(() => callExtract('Opening', ''), 200);
    fetch(`${API_BASE}/sd/health`, { method: 'GET' }).catch(() => {});
  }, []);

  /** 同步 LLM 提取的字段到 profile state */
  const applyExtracted = (items: Array<{ field_name: string; value: string }>) => {
    setProfile(prev => {
      const next: Partial<SdProfile> = { ...prev };
      for (const item of items) {
        const v = (item.value || '').trim();
        if (!v) continue;
        if (item.field_name === 'vision_md') next.vision_md = v;
        else if (item.field_name === 'business_model_md') next.business_model_md = v;
        else if (item.field_name === 'growth_opportunities_md') next.growth_opportunities_md = v;
        else if (item.field_name === 'core_capabilities') {
          next.core_capabilities = parseListAnswer(v);
        }
        else if (item.field_name === 'constraints_md') next.constraints_md = v;
      }
      profileRef.current = next;
      return next;
    });
  };

  const buildContext = (): string => {
    const p = profileRef.current;
    const parts: string[] = [];
    if (p.vision_md) parts.push(`【愿景目标】${p.vision_md}`);
    if (p.business_model_md) parts.push(`【业务模式】${p.business_model_md}`);
    if (p.growth_opportunities_md) parts.push(`【增长机会】${p.growth_opportunities_md}`);
    if (p.core_capabilities && p.core_capabilities.length > 0) {
      parts.push(`【核心能力】${p.core_capabilities.join('、')}`);
    }
    if (p.constraints_md) parts.push(`【关键约束】${p.constraints_md}`);
    return parts.join('\n\n');
  };

  const getPreviousValue = (step: StepId): string => {
    const p = profileRef.current;
    if (step === 'SD_Q1') return p.vision_md || '';
    if (step === 'SD_Q2') return p.business_model_md || '';
    if (step === 'SD_Q3') return p.growth_opportunities_md || '';
    if (step === 'SD_Q4') return (p.core_capabilities || []).join('、');
    if (step === 'SD_Q5') return p.constraints_md || '';
    return '';
  };

  const callExtract = async (questionId: StepId, userAnswer: string) => {
    const loadingId = nextMsgId();
    setMessages(prev => [...prev, { id: loadingId, role: 'bot', text: 'Sparky 正在思考...' }]);

    try {
      const res = await sdInterviewExtract({
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
        stepRef.current = 'SD_Q1';
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
          // 最后一题收束 → 提交 profile + 生成解码地图
          setTimeout(() => submitProfile(), reply.length * 25 + 500);
        }
      }
    } catch (err: any) {
      console.error('[SdInterview] extract failed', err);
      const msg = err?.response?.data?.error || err?.message || '网络抖动,刚才那条没收到';
      setMessages(prev => prev.map(m => m.id === loadingId ? {
        ...m,
        text: `刚才有点小问题:${msg}。再说一遍试试,或者直接说"跳过"我们用现有信息生成解码。`,
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
          ? '解码地图生成中,等几秒...'
          : '访谈我都收完了,稍等会自动展示解码地图。',
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
    const finalProfile: SdProfile = {
      vision_md: p.vision_md || '',
      business_model_md: p.business_model_md || '',
      growth_opportunities_md: p.growth_opportunities_md || '',
      core_capabilities: p.core_capabilities || [],
      constraints_md: p.constraints_md || '',
    };

    const genId = nextMsgId();
    setMessages(prev => [...prev, { id: genId, role: 'bot', text: '' }]);
    streamText(
      `战略输入我都收齐了 — 愿景 / 业务模式 / 增长机会 / ${finalProfile.core_capabilities.length} 项核心能力 / 关键约束。\n\n现在我来基于钻石模型 + Korn Ferry 解码框架生成战略地图,会包含三大杠杆、部门翻译、关键岗位、能力建设、季度路线图、6 项一致性检查。这一步要 30-60 秒...`,
      (t) => setMessages(prev => prev.map(m => m.id === genId ? { ...m, text: t } : m)),
    );

    try {
      await sdSaveProfile(finalProfile);
      const result = await sdGenerateDecoding({ timeout: 0 });

      finishedProfileRef.current = finalProfile;
      finishedDecodingRef.current = result.data.decoding;

      const doneId = nextMsgId();
      setMessages(prev => [...prev, { id: doneId, role: 'bot', text: '' }]);
      streamText(
        `**战略解码地图已生成**\n\n包括:\n· 一句话战略表述\n· 三大杠杆\n· ${result.data.decoding.department_translations?.length || 0} 个部门的 critical outcomes + KPIs\n· ${result.data.decoding.critical_roles?.length || 0} 个关键岗位\n· 4 个季度的路线图\n· 6 项一致性检查\n\n点右上角"看战略解码地图 →"进入展示页。这页的对话历史 + 笔记都还在,需要时可以滚回去看。`,
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
        `生成解码失败 — ${detail}\n\n你可以:\n· 刷新页面重走访谈\n· 用上一版解码(如果有)`,
        (t) => setMessages(prev => prev.map(m => m.id === errId ? { ...m, text: t } : m)),
      );
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: '#FAFAFA' }}>
      {/* 左:Sparky 对话区 */}
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

      {/* 右:访谈笔记 */}
      <Workspace
        mode="wide"
        title="战略澄清笔记"
        subtitle="访谈中实时整理 5 个维度的输入,完成后用来生成战略解码地图"
        headerExtra={onSkip && stage === 'interview' ? (
          <span
            onClick={onSkip}
            style={{
              fontSize: 13, color: BRAND, cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            title="跳过访谈,直接进入解码地图视图(如果之前已经生成过)"
          >
            跳过访谈,看上一版解码 →
          </span>
        ) : undefined}
      >
        {stage === 'done' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button
              onClick={() => {
                if (finishedProfileRef.current && finishedDecodingRef.current) {
                  onComplete(finishedProfileRef.current, finishedDecodingRef.current);
                }
              }}
              style={primaryBtn}
            >
              看战略解码地图 →
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

// ============================================================================
// 右侧访谈笔记 — 5 段文字摘要
// ============================================================================
function NotesView({ profile, stage, errorText }: {
  profile: Partial<SdProfile>;
  stage: Stage;
  errorText: string | null;
}) {
  const hasAny = !!(profile.vision_md || profile.business_model_md
    || profile.growth_opportunities_md
    || (profile.core_capabilities?.length || 0) > 0
    || profile.constraints_md);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!hasAny && (
        <div style={{
          padding: '40px 24px', textAlign: 'center', color: '#94A3B8', fontSize: 13,
          background: '#fff', border: '1px dashed #E2E8F0', borderRadius: 12,
        }}>
          访谈开始后这里会逐段出现你们的战略输入 — 愿景 / 业务模式 / 增长机会 / 核心能力 / 关键约束。访谈结束后我会基于这些信息生成战略解码地图。
        </div>
      )}

      {hasAny && (
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
          padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          <NoteSection
            label="愿景与成功指标"
            empty="(待 Q1 收集)"
            done={!!profile.vision_md}
          >
            {profile.vision_md && renderMd(profile.vision_md)}
          </NoteSection>

          <NoteSection
            label="业务模式与客户价值"
            empty="(待 Q2 收集)"
            done={!!profile.business_model_md}
          >
            {profile.business_model_md && renderMd(profile.business_model_md)}
          </NoteSection>

          <NoteSection
            label="关键增长机会"
            empty="(待 Q3 收集)"
            done={!!profile.growth_opportunities_md}
          >
            {profile.growth_opportunities_md && renderMd(profile.growth_opportunities_md)}
          </NoteSection>

          <NoteSection
            label="核心能力"
            empty="(待 Q4 收集)"
            done={(profile.core_capabilities?.length || 0) > 0}
          >
            {(profile.core_capabilities?.length || 0) > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {profile.core_capabilities!.map(c => <Chip key={c}>{c}</Chip>)}
              </div>
            )}
          </NoteSection>

          <NoteSection
            label="关键约束与资源现状"
            empty="(待 Q5 收集)"
            done={!!profile.constraints_md}
          >
            {profile.constraints_md && renderMd(profile.constraints_md)}
          </NoteSection>
        </div>
      )}

      {stage === 'generating' && (
        <div style={{
          background: BRAND_TINT, border: `1px solid ${BRAND}33`, borderRadius: 12,
          padding: '18px 16px', textAlign: 'center', color: BRAND, fontSize: 13,
          fontWeight: 500,
        }}>
          正在基于战略输入生成解码地图...
        </div>
      )}
      {stage === 'done' && (
        <div style={{
          background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 12,
          padding: '18px 16px', color: '#059669', fontSize: 13, lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>战略解码地图已生成</div>
          <div style={{ color: '#065F46' }}>
            上面"看战略解码地图 →"按钮进入展示页。这里的对话历史 + 笔记都还在。
          </div>
        </div>
      )}
      {stage === 'error' && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12,
          padding: '18px 16px', color: '#B91C1C', fontSize: 13,
          lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>解码生成失败</div>
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

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 999, fontSize: 12,
      background: '#F1F5F9', color: '#475569',
    }}>
      {children}
    </span>
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

/** 解析顿号 / 逗号分隔的列表 */
function parseListAnswer(v: string): string[] {
  return v.replace(/，/g, '、').split('、').map(s => s.trim()).filter(Boolean);
}

/** 流式打字效果,跟 SparkyPanel 内置一致 */
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

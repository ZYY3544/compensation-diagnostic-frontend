/**
 * 员工敬业度调研 - Stage 3: 背景采集 (Background Interview).
 *
 * 流程:
 *   Welcome → BG_Q1 (公司基础) → BG_Q2 (调研关注点)
 *   → 提交 profile → 进入 survey 阶段 (诊断报告留到调研回收够后再生成)
 *
 * 设计:
 *   - 2 题轻量, 每题 1-2 轮就收束
 *   - 不再是诊断访谈, 是给报告补上下文 (LLM 生成时用)
 *   - 复用现有 SparkyPanel + Workspace 模式 (跟其他 tool 风格一致)
 */
import { useEffect, useRef, useState } from 'react';
import SparkyPanel from '../components/layout/SparkyPanel';
import Workspace from '../components/layout/Workspace';
import { nextMsgId } from '../lib/msgId';
import type { Message } from '../types';
import {
  odSaveProfile, odInterviewExtract,
  type OdProfile,
} from '../api/client';

const API_BASE = (import.meta.env as any).VITE_API_URL || '/api';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

export type Stage = 'interview' | 'generating' | 'done' | 'error';
type StepId = 'Opening' | 'BG_Q1' | 'BG_Q2';

const STEP_ORDER: StepId[] = ['BG_Q1', 'BG_Q2'];

const WELCOME_MESSAGE = `好的, 在启动员工调研之前, 我跟你做一次**轻量的 2 题背景采集** — 大概 2-3 分钟。

这一步不是诊断访谈, 是为了让最终报告里的优化建议能跟你公司的实际情况对得上, 而不是给你一堆模板话。

**两道题:**
1. 公司基础情况 (行业 / 规模 / 阶段 / 最近关键变化)
2. 这次调研最关心什么 (担心员工流失? 战略宣贯效果? 跨部门协作?)

每题我会基于你的回答简单追问 1-2 句, 不会深挖。如果时间紧也可以直接说"先这样吧", 我会尊重你的节奏。

**第一个问题: 你们公司是什么行业 + 大概多少人 + 最近 1-2 年有什么关键变化 (业务转型 / 大组织调整 / 关键人变动)?**`;

interface Props {
  onSaved: (profile: OdProfile) => void;
  onSkip?: () => void;
}

export default function OdInterview({ onSaved, onSkip }: Props) {
  const [stage, setStage] = useState<Stage>('interview');
  const [profile, setProfile] = useState<Partial<OdProfile>>({
    company_basics_md: '', survey_focus_md: '',
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);

  const stepRef = useRef<StepId>('Opening');
  const roundRef = useRef<number>(1);
  const isFollowUpRef = useRef<boolean>(false);
  const lastSparkyQuestionRef = useRef<string>('');
  const profileRef = useRef<Partial<OdProfile>>({
    company_basics_md: '', survey_focus_md: '',
  });
  const initRef = useRef(false);
  const finishedProfileRef = useRef<OdProfile | null>(null);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    setMessages([
      { role: 'user', text: '我准备做敬业度调研' },
      { id: nextMsgId(), role: 'bot', text: WELCOME_MESSAGE },
    ]);

    stepRef.current = 'BG_Q1';
    roundRef.current = 1;
    isFollowUpRef.current = true;
    lastSparkyQuestionRef.current = '你们公司是什么行业 + 大概多少人 + 最近 1-2 年有什么关键变化?';

    fetch(`${API_BASE}/od/health`, { method: 'GET' }).catch(() => {});
  }, []);

  const applyExtracted = (items: Array<{ field_name: string; value: string }>) => {
    setProfile(prev => {
      const next: Partial<OdProfile> = { ...prev };
      for (const item of items) {
        const v = (item.value || '').trim();
        if (!v) continue;
        if (item.field_name === 'company_basics_md') next.company_basics_md = v;
        else if (item.field_name === 'survey_focus_md') next.survey_focus_md = v;
      }
      profileRef.current = next;
      return next;
    });
  };

  const buildContext = (): string => {
    const p = profileRef.current;
    const parts: string[] = [];
    if (p.company_basics_md) parts.push(`【公司基础】${p.company_basics_md}`);
    if (p.survey_focus_md) parts.push(`【调研关注】${p.survey_focus_md}`);
    return parts.join('\n\n');
  };

  const getPreviousValue = (step: StepId): string => {
    const p = profileRef.current;
    if (step === 'BG_Q1') return p.company_basics_md || '';
    if (step === 'BG_Q2') return p.survey_focus_md || '';
    return '';
  };

  const callExtract = async (questionId: StepId, userAnswer: string) => {
    const loadingId = nextMsgId();
    setMessages(prev => [...prev, { id: loadingId, role: 'bot', text: 'Sparky 正在思考...' }]);

    try {
      const res = await odInterviewExtract({
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
        stepRef.current = 'BG_Q1';
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
      console.error('[OdInterview] extract failed', err);
      const msg = err?.response?.data?.error || err?.message || '网络抖动';
      setMessages(prev => prev.map(m => m.id === loadingId ? {
        ...m,
        text: `刚才有点小问题:${msg}。再说一遍试试。`,
      } : m));
    }
  };

  const handleUserAnswer = (text: string): boolean => {
    setMessages(prev => [...prev, { role: 'user', text }]);

    if (stage !== 'interview') {
      const replyId = nextMsgId();
      setMessages(prev => [...prev, { id: replyId, role: 'bot', text: '' }]);
      streamText(
        stage === 'generating' ? '正在保存背景采集...' : '背景采集已收完, 点上方"进入员工调研 →"开启调研环节。',
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
    const finalProfile: OdProfile = {
      company_basics_md: p.company_basics_md || '',
      survey_focus_md: p.survey_focus_md || '',
    };

    const filledCount = Object.values(finalProfile).filter(v => v).length;

    const genId = nextMsgId();
    setMessages(prev => [...prev, { id: genId, role: 'bot', text: '' }]);
    streamText(
      `背景采集完成 (${filledCount}/2 题), 已存盘。\n\n下一步: **员工 Double E 调研** — 我会帮你启动调研、生成员工填答链接、追踪回收进度, 等回收够 (≥ 门槛) 再用真实数据 + 你的背景上下文一起生成完整报告。`,
      (t) => setMessages(prev => prev.map(m => m.id === genId ? { ...m, text: t } : m)),
    );

    try {
      await odSaveProfile(finalProfile);
      finishedProfileRef.current = finalProfile;

      const doneId = nextMsgId();
      setMessages(prev => [...prev, { id: doneId, role: 'bot', text: '' }]);
      streamText(
        `点右上角 **"进入员工调研 →"** 启动 Double E 调研。`,
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
        ? '是网络问题, 可能是后端冷启动。'
        : `保存出错了:${msg}`;
      streamText(
        `保存背景采集失败 — ${detail}\n\n你可以:\n· 刷新页面重新采集\n· 联系管理员排查`,
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
        title="背景采集笔记"
        subtitle="2 题轻量背景, 给报告生成提供上下文"
        headerExtra={onSkip && stage === 'interview' ? (
          <span
            onClick={onSkip}
            style={{ fontSize: 13, color: BRAND, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            跳过, 看上一版报告 →
          </span>
        ) : undefined}
      >
        {stage === 'done' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button
              onClick={() => {
                if (finishedProfileRef.current) {
                  onSaved(finishedProfileRef.current);
                }
              }}
              style={primaryBtn}
            >
              进入员工调研 →
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
  profile: Partial<OdProfile>; stage: Stage; errorText: string | null;
}) {
  const hasAny = !!(profile.company_basics_md || profile.survey_focus_md);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!hasAny && (
        <div style={{
          padding: '40px 24px', textAlign: 'center', color: '#94A3B8', fontSize: 13,
          background: '#fff', border: '1px dashed #E2E8F0', borderRadius: 12,
        }}>
          访谈开始后这里会出现 2 题背景采集 — 公司基础情况 + 调研关注议题。完成后进入员工 Double E 调研环节。
        </div>
      )}

      {hasAny && (
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
          padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          <NoteSection label="① 公司基础情况" empty="(待 BG_Q1 收集)" done={!!profile.company_basics_md}>
            {profile.company_basics_md && renderMd(profile.company_basics_md)}
          </NoteSection>
          <NoteSection label="② 调研重点关注" empty="(待 BG_Q2 收集)" done={!!profile.survey_focus_md}>
            {profile.survey_focus_md && renderMd(profile.survey_focus_md)}
          </NoteSection>
        </div>
      )}

      {stage === 'generating' && (
        <div style={{
          background: BRAND_TINT, border: `1px solid ${BRAND}33`, borderRadius: 12,
          padding: '18px 16px', textAlign: 'center', color: BRAND, fontSize: 13, fontWeight: 500,
        }}>
          正在保存背景采集...
        </div>
      )}
      {stage === 'done' && (
        <div style={{
          background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 12,
          padding: '18px 16px', color: '#059669', fontSize: 13, lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>背景采集已保存</div>
          <div style={{ color: '#065F46' }}>点上方"进入员工调研 →"启动 Double E 调研, 这是诊断报告必需的数据。</div>
        </div>
      )}
      {stage === 'error' && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12,
          padding: '18px 16px', color: '#B91C1C', fontSize: 13, lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>保存失败</div>
          <div>{errorText || '未知错误'}</div>
        </div>
      )}
    </div>
  );
}

function NoteSection({ label, empty, done, children }: {
  label: string; empty: string; done: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{
        fontSize: 12, color: done ? BRAND : '#94A3B8', fontWeight: 600,
        marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {done ? '✓' : '○'} {label}
      </div>
      <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.7, paddingLeft: 18 }}>
        {done ? children : <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>{empty}</span>}
      </div>
    </div>
  );
}

function renderMd(text: string): React.ReactNode {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
    const html = line
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/^- /, '• ');
    return <div key={i} dangerouslySetInnerHTML={{ __html: html }} />;
  });
}

function streamText(text: string, onTick: (s: string) => void, onDone?: () => void) {
  let i = 0;
  const tick = () => {
    if (i >= text.length) {
      if (onDone) onDone();
      return;
    }
    i = Math.min(text.length, i + 3);
    onTick(text.slice(0, i));
    setTimeout(tick, 20);
  };
  tick();
}

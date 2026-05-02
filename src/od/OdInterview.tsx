/**
 * 组织诊断 (OD) 5 层访谈 — 镜像 SD V2 模式但产出不同。
 *
 * 流程:
 *   Welcome → OD_Q1 (战略层) → OD_Q2 (组织层) → OD_Q3 (人才层)
 *   → OD_Q4 (薪酬绩效层) → OD_Q5 (文化领导力层)
 *   → 提交 profile → LLM 生成完整诊断报告 → onComplete 跳到展示页
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
type StepId = 'Opening' | 'OD_Q1' | 'OD_Q2' | 'OD_Q3' | 'OD_Q4' | 'OD_Q5';

const STEP_ORDER: StepId[] = ['OD_Q1', 'OD_Q2', 'OD_Q3', 'OD_Q4', 'OD_Q5'];

const OD_WELCOME_MESSAGE = `你好,我是 Sparky,铭曦的组织诊断 AI 顾问。这是组织诊断 (OD) 工具。

**什么是组织诊断**

参考 Korn Ferry / Hay Group 的方法论,从 5 个层面给你的组织做"体检",识别现状与领先实践的差距,为后续优化提供方向。

5 层面 = 战略 / 组织 / 人才 / 薪酬绩效 / 文化领导力

**接下来 15-20 分钟,我会做 5 层访谈**

每层 1 道核心题, 我会基于你的回答深挖追问 (大概 2-3 轮/题)。访谈结束后我会基于 KF 战略-组织-领导三角框架生成完整诊断报告:

1. 一段话执行总览
2. 5 层面诊断 (现状 + 关键观察 + 痛点)
3. Top 3 优势 + Top 3 短板 (含证据)
4. 行业实践对标
5. 优化建议 (战略层 / 体系层 / 运营层 3 类)
6. 后续工具推荐 (诊断发现的问题 → 引导到铭曦其他工具)

**说在前面**

诊断访谈是为了发现真问题,我会主动挑战模糊的回答 — 你说"我们绩效管理还行",我会追问"绩效结果真的影响了薪酬调整和晋升吗?多少比例"。请耐心配合,这是诊断真有价值的关键。

**第一个问题:你们公司的战略目标是什么? 高管团队 / 中层 / 一线员工对战略的认知一致吗? 战略宣贯怎么做的?**`;

interface Props {
  onSaved: (profile: OdProfile) => void;     // 访谈完成 + profile 已存盘 → 进 survey 阶段
  onSkip?: () => void;                       // 已有诊断时让用户回看上版
}

export default function OdInterview({ onSaved, onSkip }: Props) {
  const [stage, setStage] = useState<Stage>('interview');
  const [profile, setProfile] = useState<Partial<OdProfile>>({
    strategy_md: '', organization_md: '', talent_md: '',
    comp_perf_md: '', culture_leadership_md: '',
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);

  const stepRef = useRef<StepId>('Opening');
  const roundRef = useRef<number>(1);
  const isFollowUpRef = useRef<boolean>(false);
  const lastSparkyQuestionRef = useRef<string>('');
  const profileRef = useRef<Partial<OdProfile>>({
    strategy_md: '', organization_md: '', talent_md: '',
    comp_perf_md: '', culture_leadership_md: '',
  });
  const initRef = useRef(false);
  const finishedProfileRef = useRef<OdProfile | null>(null);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    setMessages([
      { role: 'user', text: '我想做一次组织诊断' },
      { id: nextMsgId(), role: 'bot', text: OD_WELCOME_MESSAGE },
    ]);

    stepRef.current = 'OD_Q1';
    roundRef.current = 1;
    isFollowUpRef.current = true;
    lastSparkyQuestionRef.current = '你们公司的战略目标是什么? 高管团队 / 中层 / 一线员工对战略的认知一致吗? 战略宣贯怎么做的?';

    fetch(`${API_BASE}/od/health`, { method: 'GET' }).catch(() => {});
  }, []);

  const applyExtracted = (items: Array<{ field_name: string; value: string }>) => {
    setProfile(prev => {
      const next: Partial<OdProfile> = { ...prev };
      for (const item of items) {
        const v = (item.value || '').trim();
        if (!v) continue;
        if (item.field_name === 'strategy_md') next.strategy_md = v;
        else if (item.field_name === 'organization_md') next.organization_md = v;
        else if (item.field_name === 'talent_md') next.talent_md = v;
        else if (item.field_name === 'comp_perf_md') next.comp_perf_md = v;
        else if (item.field_name === 'culture_leadership_md') next.culture_leadership_md = v;
      }
      profileRef.current = next;
      return next;
    });
  };

  const buildContext = (): string => {
    const p = profileRef.current;
    const parts: string[] = [];
    if (p.strategy_md) parts.push(`【战略】${p.strategy_md}`);
    if (p.organization_md) parts.push(`【组织】${p.organization_md}`);
    if (p.talent_md) parts.push(`【人才】${p.talent_md}`);
    if (p.comp_perf_md) parts.push(`【薪酬绩效】${p.comp_perf_md}`);
    if (p.culture_leadership_md) parts.push(`【文化领导力】${p.culture_leadership_md}`);
    return parts.join('\n\n');
  };

  const getPreviousValue = (step: StepId): string => {
    const p = profileRef.current;
    if (step === 'OD_Q1') return p.strategy_md || '';
    if (step === 'OD_Q2') return p.organization_md || '';
    if (step === 'OD_Q3') return p.talent_md || '';
    if (step === 'OD_Q4') return p.comp_perf_md || '';
    if (step === 'OD_Q5') return p.culture_leadership_md || '';
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
        stepRef.current = 'OD_Q1';
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
        stage === 'generating' ? '正在保存访谈, 稍等...' : '访谈我都收完了, 已存盘 — 点上方"进入员工调研 →"开启下一步。',
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
      strategy_md: p.strategy_md || '',
      organization_md: p.organization_md || '',
      talent_md: p.talent_md || '',
      comp_perf_md: p.comp_perf_md || '',
      culture_leadership_md: p.culture_leadership_md || '',
    };

    const filledCount = Object.values(finalProfile).filter(v => v).length;

    const genId = nextMsgId();
    setMessages(prev => [...prev, { id: genId, role: 'bot', text: '' }]);
    streamText(
      `5 层访谈收齐了 (${filledCount}/5 维度), 已存盘。\n\n下一步是**员工 Double E 调研** — 这是组织诊断必不可少的另一半数据。你的访谈是高管视角, 调研是员工视角, 双源交叉才能出真正的诊断。\n\n我会帮你启动调研、生成员工填答链接、追踪回收进度, 然后再生成完整诊断报告。`,
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
        ? '是网络问题,可能是后端冷启动。'
        : `保存出错了:${msg}`;
      streamText(
        `保存访谈失败 — ${detail}\n\n你可以:\n· 刷新页面重走访谈\n· 联系管理员排查`,
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
        title="组织诊断笔记"
        subtitle="访谈中实时整理 5 层面诊断输入"
        headerExtra={onSkip && stage === 'interview' ? (
          <span
            onClick={onSkip}
            style={{ fontSize: 13, color: BRAND, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            跳过访谈,看上一版 →
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
  const hasAny = !!(
    profile.strategy_md || profile.organization_md || profile.talent_md
    || profile.comp_perf_md || profile.culture_leadership_md
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!hasAny && (
        <div style={{
          padding: '40px 24px', textAlign: 'center', color: '#94A3B8', fontSize: 13,
          background: '#fff', border: '1px dashed #E2E8F0', borderRadius: 12,
        }}>
          访谈开始后这里会出现 5 层面诊断输入 — 战略 / 组织 / 人才 / 薪酬绩效 / 文化领导力。访谈结束后会进入员工 Double E 调研环节, 双源数据齐了再生成完整诊断报告。
        </div>
      )}

      {hasAny && (
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
          padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          <NoteSection label="① 战略层" empty="(待 Q1 收集)" done={!!profile.strategy_md}>
            {profile.strategy_md && renderMd(profile.strategy_md)}
          </NoteSection>
          <NoteSection label="② 组织层" empty="(待 Q2 收集)" done={!!profile.organization_md}>
            {profile.organization_md && renderMd(profile.organization_md)}
          </NoteSection>
          <NoteSection label="③ 人才层" empty="(待 Q3 收集)" done={!!profile.talent_md}>
            {profile.talent_md && renderMd(profile.talent_md)}
          </NoteSection>
          <NoteSection label="④ 薪酬绩效层" empty="(待 Q4 收集)" done={!!profile.comp_perf_md}>
            {profile.comp_perf_md && renderMd(profile.comp_perf_md)}
          </NoteSection>
          <NoteSection label="⑤ 文化领导力层" empty="(待 Q5 收集)" done={!!profile.culture_leadership_md}>
            {profile.culture_leadership_md && renderMd(profile.culture_leadership_md)}
          </NoteSection>
        </div>
      )}

      {stage === 'generating' && (
        <div style={{
          background: BRAND_TINT, border: `1px solid ${BRAND}33`, borderRadius: 12,
          padding: '18px 16px', textAlign: 'center', color: BRAND, fontSize: 13, fontWeight: 500,
        }}>
          正在保存 5 层访谈结果...
        </div>
      )}
      {stage === 'done' && (
        <div style={{
          background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 12,
          padding: '18px 16px', color: '#059669', fontSize: 13, lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>访谈已保存</div>
          <div style={{ color: '#065F46' }}>点上方"进入员工调研 →"启动 Double E 调研, 这是诊断报告必需的另一半数据。</div>
        </div>
      )}
      {stage === 'error' && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12,
          padding: '18px 16px', color: '#B91C1C', fontSize: 13, lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>诊断生成失败</div>
          <div>{errorText || '未知错误'}</div>
        </div>
      )}
    </div>
  );
}

function NoteSection({ label, empty, done, children }: {
  label: string; empty: string; done: boolean; children?: React.ReactNode;
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
    if (i >= text.length) { onDone?.(); return; }
    i = Math.min(i + 1, text.length);
    onTick(text.slice(0, i));
    if (i < text.length) setTimeout(tick, 25);
    else onDone?.();
  };
  tick();
}

/**
 * 长期激励 (LTI) 5 维度访谈 — 镜像 OD/SD 模式.
 *
 * 流程:
 *   Welcome → LTI_Q1 (公司基础) → LTI_Q2 (股权与股东) → LTI_Q3 (LTI 目的)
 *   → LTI_Q4 (财务现状) → LTI_Q5 (激励对象与人才)
 *   → 提交 profile → LLM 生成 LTI 方案设计书 → onComplete 跳到展示页
 */
import { useEffect, useRef, useState } from 'react';
import SparkyPanel from '../components/layout/SparkyPanel';
import Workspace from '../components/layout/Workspace';
import { nextMsgId } from '../lib/msgId';
import type { Message } from '../types';
import {
  ltiSaveProfile, ltiGeneratePlan, ltiInterviewExtract,
  type LtiProfile, type LtiPlan,
} from '../api/client';

const API_BASE = (import.meta.env as any).VITE_API_URL || '/api';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

export type Stage = 'interview' | 'generating' | 'done' | 'error';
type StepId = 'Opening' | 'LTI_Q1' | 'LTI_Q2' | 'LTI_Q3' | 'LTI_Q4' | 'LTI_Q5';

const STEP_ORDER: StepId[] = ['LTI_Q1', 'LTI_Q2', 'LTI_Q3', 'LTI_Q4', 'LTI_Q5'];

const LTI_WELCOME_MESSAGE = `你好,我是 Sparky,铭曦的薪酬激励 AI 顾问。这是长期激励 (LTI - Long Term Incentive) 工具。

**什么是长期激励**

激励周期 3 年及以上的、与公司中长期价值挂钩的激励机制。LTI 是工具化非常成熟的领域 — 通过结构化访谈, 我能为你输出一份**起点级别的 LTI 方案**,供后续找律师 / 财税顾问深化。

**LTI 8 大工具** (3 股权 + 5 现金):
- 股权: 出资入股 / 股票期权 / 限制性股票
- 现金: 中长期业绩奖金 / 价值增值分享 / 虚拟股票 / 业绩单元 / 投资跟投

**接下来 15-20 分钟,我会做 5 维度访谈**

1. 公司基础情况 (行业 / 规模 / 上市规划)
2. 股权结构与股东意愿
3. LTI 目的 (公司治理 / 战略驱动 / 市值管理 / 人才竞争 4 选 1-2)
4. 财务现状 (现金流 / 当前薪酬 / LTI 预算)
5. 激励对象与人才情况

**输出方案包括 6 大模块**:

· 公司画像总结
· 推荐工具 (主推荐 + 备选 + 不推荐工具及理由)
· 方案设计 6 要点 (持股模式 / 参与范围 / 总量分配 / 授予生效 / 业绩链接 / 特殊情况)
· 个人激励测算示例
· 风险提示 (法律 / 税务 / 监管 / 财务 / 员工 5 类)
· 后续动作清单 (法务 / 财务 / 工商 / 税务 / HR 5 大方向, 含 P0/P1/P2 优先级)

**说在前面**

LTI 决策的核心是"上市规划"和"股东意愿" — 这两个最影响工具选型. 我会主动追问这两块, 请尽量给具体答案.

**第一个问题:你们公司目前所在行业、规模 (员工数 / 营收) 是? 上市状态如何 (已上市 / 拟上市 / 暂无规划)? 如果拟上市, 计划上市地和大致时间是?**`;

interface Props {
  onComplete: (profile: LtiProfile, plan: LtiPlan) => void;
  onSkip?: () => void;
}

export default function LtiInterview({ onComplete, onSkip }: Props) {
  const [stage, setStage] = useState<Stage>('interview');
  const [profile, setProfile] = useState<Partial<LtiProfile>>({
    company_basics_md: '', ownership_md: '', lti_purpose_md: '',
    financial_md: '', talent_md: '',
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);

  const stepRef = useRef<StepId>('Opening');
  const roundRef = useRef<number>(1);
  const isFollowUpRef = useRef<boolean>(false);
  const lastSparkyQuestionRef = useRef<string>('');
  const profileRef = useRef<Partial<LtiProfile>>({
    company_basics_md: '', ownership_md: '', lti_purpose_md: '',
    financial_md: '', talent_md: '',
  });
  const initRef = useRef(false);
  const finishedPlanRef = useRef<LtiPlan | null>(null);
  const finishedProfileRef = useRef<LtiProfile | null>(null);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    setMessages([
      { role: 'user', text: '我想做一次长期激励方案设计' },
      { id: nextMsgId(), role: 'bot', text: LTI_WELCOME_MESSAGE },
    ]);

    stepRef.current = 'LTI_Q1';
    roundRef.current = 1;
    isFollowUpRef.current = true;
    lastSparkyQuestionRef.current = '你们公司目前所在行业、规模 (员工数 / 营收) 是? 上市状态如何 (已上市 / 拟上市 / 暂无规划)? 如果拟上市, 计划上市地和大致时间是?';

    fetch(`${API_BASE}/lti/health`, { method: 'GET' }).catch(() => {});
  }, []);

  const applyExtracted = (items: Array<{ field_name: string; value: string }>) => {
    setProfile(prev => {
      const next: Partial<LtiProfile> = { ...prev };
      for (const item of items) {
        const v = (item.value || '').trim();
        if (!v) continue;
        if (item.field_name === 'company_basics_md') next.company_basics_md = v;
        else if (item.field_name === 'ownership_md') next.ownership_md = v;
        else if (item.field_name === 'lti_purpose_md') next.lti_purpose_md = v;
        else if (item.field_name === 'financial_md') next.financial_md = v;
        else if (item.field_name === 'talent_md') next.talent_md = v;
      }
      profileRef.current = next;
      return next;
    });
  };

  const buildContext = (): string => {
    const p = profileRef.current;
    const parts: string[] = [];
    if (p.company_basics_md) parts.push(`【公司基础】${p.company_basics_md}`);
    if (p.ownership_md) parts.push(`【股权结构】${p.ownership_md}`);
    if (p.lti_purpose_md) parts.push(`【LTI 目的】${p.lti_purpose_md}`);
    if (p.financial_md) parts.push(`【财务】${p.financial_md}`);
    if (p.talent_md) parts.push(`【激励对象】${p.talent_md}`);
    return parts.join('\n\n');
  };

  const getPreviousValue = (step: StepId): string => {
    const p = profileRef.current;
    if (step === 'LTI_Q1') return p.company_basics_md || '';
    if (step === 'LTI_Q2') return p.ownership_md || '';
    if (step === 'LTI_Q3') return p.lti_purpose_md || '';
    if (step === 'LTI_Q4') return p.financial_md || '';
    if (step === 'LTI_Q5') return p.talent_md || '';
    return '';
  };

  const callExtract = async (questionId: StepId, userAnswer: string) => {
    const loadingId = nextMsgId();
    setMessages(prev => [...prev, { id: loadingId, role: 'bot', text: 'Sparky 正在思考...' }]);

    try {
      const res = await ltiInterviewExtract({
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
        stepRef.current = 'LTI_Q1';
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
      console.error('[LtiInterview] extract failed', err);
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
        stage === 'generating' ? 'LTI 方案生成中,等几秒...' : '访谈我都收完了,稍等会自动展示方案设计书。',
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
    const finalProfile: LtiProfile = {
      company_basics_md: p.company_basics_md || '',
      ownership_md: p.ownership_md || '',
      lti_purpose_md: p.lti_purpose_md || '',
      financial_md: p.financial_md || '',
      talent_md: p.talent_md || '',
    };

    const filledCount = Object.values(finalProfile).filter(v => v).length;

    const genId = nextMsgId();
    setMessages(prev => [...prev, { id: genId, role: 'bot', text: '' }]);
    streamText(
      `5 维度访谈收齐了 (${filledCount}/5 维度)。\n\n现在我基于 WTW / Korn Ferry LTI 方法论生成完整方案设计书:\n\n· 公司画像总结\n· 推荐工具 (主推荐 + 备选 + 不推荐)\n· 方案设计 6 要点 (持股模式 / 参与范围 / 总量 / 授予生效 / 业绩链接 / 特殊情况)\n· 个人激励测算示例\n· 风险提示 (5 类)\n· 后续动作清单 (5 大方向, 含优先级)\n\n这一步要 60-90 秒...`,
      (t) => setMessages(prev => prev.map(m => m.id === genId ? { ...m, text: t } : m)),
    );

    try {
      await ltiSaveProfile(finalProfile);
      const result = await ltiGeneratePlan({ timeout: 0 });

      finishedProfileRef.current = finalProfile;
      finishedPlanRef.current = result.data.plan;

      const d = result.data.plan;
      const doneId = nextMsgId();
      setMessages(prev => [...prev, { id: doneId, role: 'bot', text: '' }]);
      streamText(
        `**LTI 方案设计书已生成**\n\n包括:\n· 主推荐工具: ${d.recommended_tools?.primary?.tool_cn || '(待补充)'}\n· ${d.recommended_tools?.secondary?.length || 0} 个备选工具\n· 方案设计 6 要点 (持股模式: ${d.plan_design?.holding_model?.primary || '?'})\n· ${d.individual_simulation?.length || 0} 个角色测算\n· ${d.risks?.length || 0} 项风险提示\n· ${d.next_steps?.length || 0} 条后续动作\n\n点右上角"看 LTI 方案 →"进入完整展示页。`,
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
        ? '是网络问题, 可能是后端冷启动或 LLM 那边超时.'
        : `LLM 那边报错了:${msg}`;
      streamText(
        `生成方案失败 — ${detail}\n\n你可以:\n· 刷新页面重走访谈\n· 用上一版方案 (如果有)`,
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
        title="LTI 方案笔记"
        subtitle="访谈中实时整理 5 维度 LTI 输入"
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
                if (finishedProfileRef.current && finishedPlanRef.current) {
                  onComplete(finishedProfileRef.current, finishedPlanRef.current);
                }
              }}
              style={primaryBtn}
            >
              看 LTI 方案 →
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
  profile: Partial<LtiProfile>; stage: Stage; errorText: string | null;
}) {
  const hasAny = !!(
    profile.company_basics_md || profile.ownership_md || profile.lti_purpose_md
    || profile.financial_md || profile.talent_md
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!hasAny && (
        <div style={{
          padding: '40px 24px', textAlign: 'center', color: '#94A3B8', fontSize: 13,
          background: '#fff', border: '1px dashed #E2E8F0', borderRadius: 12,
        }}>
          访谈开始后这里会出现 5 维度 LTI 输入 — 公司基础 / 股权结构 / LTI 目的 / 财务现状 / 激励对象.访谈结束后我会基于 WTW / KF LTI 方法论生成完整方案设计书.
        </div>
      )}

      {hasAny && (
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
          padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          <NoteSection label="① 公司基础情况" empty="(待 Q1 收集)" done={!!profile.company_basics_md}>
            {profile.company_basics_md && renderMd(profile.company_basics_md)}
          </NoteSection>
          <NoteSection label="② 股权结构与股东意愿" empty="(待 Q2 收集)" done={!!profile.ownership_md}>
            {profile.ownership_md && renderMd(profile.ownership_md)}
          </NoteSection>
          <NoteSection label="③ LTI 目的" empty="(待 Q3 收集)" done={!!profile.lti_purpose_md}>
            {profile.lti_purpose_md && renderMd(profile.lti_purpose_md)}
          </NoteSection>
          <NoteSection label="④ 财务现状" empty="(待 Q4 收集)" done={!!profile.financial_md}>
            {profile.financial_md && renderMd(profile.financial_md)}
          </NoteSection>
          <NoteSection label="⑤ 激励对象与人才" empty="(待 Q5 收集)" done={!!profile.talent_md}>
            {profile.talent_md && renderMd(profile.talent_md)}
          </NoteSection>
        </div>
      )}

      {stage === 'generating' && (
        <div style={{
          background: BRAND_TINT, border: `1px solid ${BRAND}33`, borderRadius: 12,
          padding: '18px 16px', textAlign: 'center', color: BRAND, fontSize: 13, fontWeight: 500,
        }}>
          正在生成 LTI 方案设计书 (推荐工具 + 6 要点设计 + 个人测算 + 风险 + 动作清单)... 60-90 秒
        </div>
      )}
      {stage === 'done' && (
        <div style={{
          background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 12,
          padding: '18px 16px', color: '#059669', fontSize: 13, lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>LTI 方案已生成</div>
          <div style={{ color: '#065F46' }}>上面"看 LTI 方案 →"按钮进入完整展示页.</div>
        </div>
      )}
      {stage === 'error' && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12,
          padding: '18px 16px', color: '#B91C1C', fontSize: 13, lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>方案生成失败</div>
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

/**
 * 战略解码 V2 — 7 道访谈题, 围绕 KF 5 层分解模型 (公司战略 → BSC → MWB → 部门 OGSM → PPC)。
 *
 * 流程:
 *   Welcome → SD2_Q1 (愿景目标) → SD2_Q2 (业务模式) → SD2_Q3 (差异化)
 *   → SD2_Q4 (价值链) → SD2_Q5 (必赢之仗候选) → SD2_Q6 (约束) → SD2_Q7 (核心部门)
 *   → 提交 profile → LLM 生成 V2 解码地图 → onComplete 跳到展示页
 *
 * V2 跟 V1 区别:
 *   - 5 题 → 7 题 (加价值链、必赢之仗候选、核心部门 3 题, 删了核心能力 1 题)
 *   - 字段名变化 (vision_md → vision_targets_md, growth_opportunities_md → mwb_candidates_md, etc.)
 *   - 输出 schema 完全不同 (BSC + MWB + OGSM + PPC, 而不是 V1 的"三大杠杆+部门翻译")
 */
import { useEffect, useRef, useState } from 'react';
import SparkyPanel from '../components/layout/SparkyPanel';
import Workspace from '../components/layout/Workspace';
import { nextMsgId } from '../lib/msgId';
import type { Message } from '../types';
import {
  sdSaveProfile, sdGenerateDecoding, sdProfileFromSc, scGetProfile,
  sdInterviewExtract,
  type SdProfile, type SdDecoding,
} from '../api/client';

const API_BASE = (import.meta.env as any).VITE_API_URL || '/api';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

export type Stage = 'interview' | 'generating' | 'done' | 'error';
type StepId = 'Opening' | 'SD2_Q1' | 'SD2_Q2' | 'SD2_Q3' | 'SD2_Q4' | 'SD2_Q5' | 'SD2_Q6' | 'SD2_Q7';

const STEP_ORDER: StepId[] = ['SD2_Q1', 'SD2_Q2', 'SD2_Q3', 'SD2_Q4', 'SD2_Q5', 'SD2_Q6', 'SD2_Q7'];

const SD_WELCOME_MESSAGE = `你好,我是 Sparky,铭曦的战略顾问 AI。这是战略解码工具 V2 (基于 Korn Ferry 5 层分解模型重构)。

**什么是战略解码 V2**

把战略翻译成完整的执行地图,落到部门和岗位层面。区别于战略澄清(那是从 0 到 1 把战略想清楚),战略解码是从 1 到 100 把战略落到组织上。

V2 输出 7 大模块:
1. 一句话战略表述
2. **BSC 战略地图** (财务 / 客户 / 内部流程 / 学习成长 4 层面因果链)
3. **必须打赢的仗 MWB** (3-7 场战役, 每场 5 维度描述 + 主帅副帅 + 一级行动计划)
4. **部门 OGSM** (核心部门的使命/目标/策略/衡量)
5. 季度路线图
6. 一致性检查 (6 大维度)
7. 高管 PPC 雏形

**接下来 15-20 分钟,我会用 7 道题挖完战略输入**

愿景目标 → 业务模式 → 差异化 → 价值链分析 → 必赢之仗候选 → 关键约束 → 核心部门

**说在前面**

过程中我会主动挑战空话 — 你说"做行业第一",我会追问"第一具体什么指标"。这是工具最值钱的部分,请耐心跟我对话。

**第一个问题:你们公司未来 3-5 年的战略愿景是什么? 量化的成功画像 / 北极星指标是什么? 时间窗口呢?**`;

interface Props {
  onComplete: (profile: SdProfile, decoding: SdDecoding) => void;
  onSkip?: () => void;
}

export default function SdInterview({ onComplete, onSkip }: Props) {
  const [stage, setStage] = useState<Stage>('interview');
  const [profile, setProfile] = useState<Partial<SdProfile>>({
    vision_targets_md: '', business_model_md: '', differentiators_md: '',
    value_chain_md: '', mwb_candidates_md: '', constraints_md: '',
    core_departments_md: '',
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [hasSc, setHasSc] = useState(false);
  const [scLoaded, setScLoaded] = useState(false);

  const stepRef = useRef<StepId>('Opening');
  const roundRef = useRef<number>(1);
  const isFollowUpRef = useRef<boolean>(false);
  const lastSparkyQuestionRef = useRef<string>('');
  const profileRef = useRef<Partial<SdProfile>>({
    vision_targets_md: '', business_model_md: '', differentiators_md: '',
    value_chain_md: '', mwb_candidates_md: '', constraints_md: '',
    core_departments_md: '',
  });
  const initRef = useRef(false);
  const finishedDecodingRef = useRef<SdDecoding | null>(null);
  const finishedProfileRef = useRef<SdProfile | null>(null);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    setMessages([
      { role: 'user', text: '我想做一次战略解码 V2' },
      { id: nextMsgId(), role: 'bot', text: SD_WELCOME_MESSAGE },
    ]);

    stepRef.current = 'SD2_Q1';
    roundRef.current = 1;
    isFollowUpRef.current = true;
    lastSparkyQuestionRef.current = '你们公司未来 3-5 年的战略愿景是什么? 量化的成功画像 / 北极星指标是什么? 时间窗口呢?';

    fetch(`${API_BASE}/sd/health`, { method: 'GET' }).catch(() => {});

    // 检测 SC 是否做过 — 如果做过, 在右侧 NotesView 上方提供"从 SC 拉数据"按钮
    scGetProfile()
      .then(res => {
        if (res.data.profile && res.data.diamond) {
          setHasSc(true);
        }
      })
      .catch(() => {});
  }, []);

  /** 从 SC 拉数据初始填充 profile */
  const handleLoadFromSc = async () => {
    try {
      const res = await sdProfileFromSc();
      if (res.data.profile) {
        setProfile(res.data.profile);
        profileRef.current = res.data.profile;
        setScLoaded(true);
        const noticeId = nextMsgId();
        setMessages(prev => [...prev, { id: noticeId, role: 'bot', text: '' }]);
        streamText(
          `已从战略澄清拉了初始数据 — ${res.data.message}\n\n你看右边笔记区,前 3 个字段已经有内容了 (来自 SC 钻石模型)。继续访谈我会逐步完善其他字段;也可以直接说"跳过到生成解码"我用现有数据生成。`,
          (t) => setMessages(prev => prev.map(m => m.id === noticeId ? { ...m, text: t } : m)),
        );
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || '拉取失败';
      const noticeId = nextMsgId();
      setMessages(prev => [...prev, { id: noticeId, role: 'bot', text: '' }]);
      streamText(
        `从 SC 拉数据失败: ${msg}\n\n继续访谈即可。`,
        (t) => setMessages(prev => prev.map(m => m.id === noticeId ? { ...m, text: t } : m)),
      );
    }
  };

  const applyExtracted = (items: Array<{ field_name: string; value: string }>) => {
    setProfile(prev => {
      const next: Partial<SdProfile> = { ...prev };
      for (const item of items) {
        const v = (item.value || '').trim();
        if (!v) continue;
        if (item.field_name === 'vision_targets_md') next.vision_targets_md = v;
        else if (item.field_name === 'business_model_md') next.business_model_md = v;
        else if (item.field_name === 'differentiators_md') next.differentiators_md = v;
        else if (item.field_name === 'value_chain_md') next.value_chain_md = v;
        else if (item.field_name === 'mwb_candidates_md') next.mwb_candidates_md = v;
        else if (item.field_name === 'constraints_md') next.constraints_md = v;
        else if (item.field_name === 'core_departments_md') next.core_departments_md = v;
      }
      profileRef.current = next;
      return next;
    });
  };

  const buildContext = (): string => {
    const p = profileRef.current;
    const parts: string[] = [];
    if (p.vision_targets_md) parts.push(`【愿景目标】${p.vision_targets_md}`);
    if (p.business_model_md) parts.push(`【业务模式】${p.business_model_md}`);
    if (p.differentiators_md) parts.push(`【差异化】${p.differentiators_md}`);
    if (p.value_chain_md) parts.push(`【价值链】${p.value_chain_md}`);
    if (p.mwb_candidates_md) parts.push(`【必赢之仗候选】${p.mwb_candidates_md}`);
    if (p.constraints_md) parts.push(`【关键约束】${p.constraints_md}`);
    if (p.core_departments_md) parts.push(`【核心部门】${p.core_departments_md}`);
    return parts.join('\n\n');
  };

  const getPreviousValue = (step: StepId): string => {
    const p = profileRef.current;
    if (step === 'SD2_Q1') return p.vision_targets_md || '';
    if (step === 'SD2_Q2') return p.business_model_md || '';
    if (step === 'SD2_Q3') return p.differentiators_md || '';
    if (step === 'SD2_Q4') return p.value_chain_md || '';
    if (step === 'SD2_Q5') return p.mwb_candidates_md || '';
    if (step === 'SD2_Q6') return p.constraints_md || '';
    if (step === 'SD2_Q7') return p.core_departments_md || '';
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
        stepRef.current = 'SD2_Q1';
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
      console.error('[SdInterview V2] extract failed', err);
      const msg = err?.response?.data?.error || err?.message || '网络抖动';
      setMessages(prev => prev.map(m => m.id === loadingId ? {
        ...m,
        text: `刚才有点小问题:${msg}。再说一遍试试,或者说"跳过"用现有信息生成解码。`,
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
      vision_targets_md: p.vision_targets_md || '',
      business_model_md: p.business_model_md || '',
      differentiators_md: p.differentiators_md || '',
      value_chain_md: p.value_chain_md || '',
      mwb_candidates_md: p.mwb_candidates_md || '',
      constraints_md: p.constraints_md || '',
      core_departments_md: p.core_departments_md || '',
    };

    const filledCount = Object.values(finalProfile).filter(v => v).length;

    const genId = nextMsgId();
    setMessages(prev => [...prev, { id: genId, role: 'bot', text: '' }]);
    streamText(
      `战略输入收齐了 (${filledCount}/7 维度)。\n\n现在我基于 Korn Ferry 5 层分解模型生成完整战略解码地图,7 大模块全做出来:\n\n· 一句话战略表述\n· BSC 战略地图 (财务/客户/内部流程/学习成长)\n· 3-7 场必赢之仗 (每场 5 维度描述 + 主帅 + 行动计划)\n· 核心部门 OGSM (使命/目标/策略/衡量)\n· 4 季度路线图\n· 6 项一致性检查\n· 高管 PPC 雏形\n\n这一步要 60-90 秒,内容比较重...`,
      (t) => setMessages(prev => prev.map(m => m.id === genId ? { ...m, text: t } : m)),
    );

    try {
      await sdSaveProfile(finalProfile);
      const result = await sdGenerateDecoding({ timeout: 0 });

      finishedProfileRef.current = finalProfile;
      finishedDecodingRef.current = result.data.decoding;

      const d = result.data.decoding;
      const doneId = nextMsgId();
      setMessages(prev => [...prev, { id: doneId, role: 'bot', text: '' }]);
      streamText(
        `**战略解码地图已生成** (V2 完整版)\n\n包括:\n· 一句话战略表述\n· BSC 战略地图 ${d.bsc_map?.financial?.length || 0}+${d.bsc_map?.customer?.length || 0}+${d.bsc_map?.internal_process?.length || 0}+${d.bsc_map?.learning_growth?.length || 0} 个目标\n· ${d.mwbs?.length || 0} 场必赢之仗\n· ${d.department_ogsms?.length || 0} 个部门 OGSM\n· ${d.roadmap?.length || 0} 个季度路线图\n· ${d.consistency_checks?.length || 0} 项一致性检查\n· ${d.exec_ppcs?.length || 0} 位高管 PPC\n\n点右上角"看战略解码地图 →"进入完整展示页。`,
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
        title="战略解码笔记 (V2)"
        subtitle="访谈中实时整理 7 维度战略输入,完成后生成完整解码地图"
        headerExtra={
          <div style={{ display: 'flex', gap: 10 }}>
            {hasSc && !scLoaded && stage === 'interview' && (
              <span
                onClick={handleLoadFromSc}
                style={{
                  fontSize: 13, color: BRAND, cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                title="从战略澄清 SC 工具拉初始数据,自动填充 3 个字段"
              >
                从 SC 拉数据 →
              </span>
            )}
            {onSkip && stage === 'interview' && (
              <span
                onClick={onSkip}
                style={{
                  fontSize: 13, color: BRAND, cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                跳过访谈,看上一版 →
              </span>
            )}
          </div>
        }
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

function NotesView({ profile, stage, errorText }: {
  profile: Partial<SdProfile>;
  stage: Stage;
  errorText: string | null;
}) {
  const hasAny = !!(
    profile.vision_targets_md || profile.business_model_md
    || profile.differentiators_md || profile.value_chain_md
    || profile.mwb_candidates_md || profile.constraints_md
    || profile.core_departments_md
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!hasAny && (
        <div style={{
          padding: '40px 24px', textAlign: 'center', color: '#94A3B8', fontSize: 13,
          background: '#fff', border: '1px dashed #E2E8F0', borderRadius: 12,
        }}>
          访谈开始后这里会出现 7 维度战略输入 — 愿景目标 / 业务模式 / 差异化 / 价值链 / 必赢之仗候选 / 约束 / 核心部门。访谈结束后我会基于 Korn Ferry 5 层分解模型生成完整战略解码地图。
        </div>
      )}

      {hasAny && (
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
          padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          <NoteSection label="① 战略愿景 + 量化目标" empty="(待 Q1 收集)" done={!!profile.vision_targets_md}>
            {profile.vision_targets_md && renderMd(profile.vision_targets_md)}
          </NoteSection>
          <NoteSection label="② 业务模式 + 价值主张" empty="(待 Q2 收集)" done={!!profile.business_model_md}>
            {profile.business_model_md && renderMd(profile.business_model_md)}
          </NoteSection>
          <NoteSection label="③ 关键差异化 + 竞争壁垒" empty="(待 Q3 收集)" done={!!profile.differentiators_md}>
            {profile.differentiators_md && renderMd(profile.differentiators_md)}
          </NoteSection>
          <NoteSection label="④ 价值链关键环节 + 制约" empty="(待 Q4 收集)" done={!!profile.value_chain_md}>
            {profile.value_chain_md && renderMd(profile.value_chain_md)}
          </NoteSection>
          <NoteSection label="⑤ 必赢之仗候选" empty="(待 Q5 收集)" done={!!profile.mwb_candidates_md}>
            {profile.mwb_candidates_md && renderMd(profile.mwb_candidates_md)}
          </NoteSection>
          <NoteSection label="⑥ 关键约束" empty="(待 Q6 收集)" done={!!profile.constraints_md}>
            {profile.constraints_md && renderMd(profile.constraints_md)}
          </NoteSection>
          <NoteSection label="⑦ 核心部门" empty="(待 Q7 收集)" done={!!profile.core_departments_md}>
            {profile.core_departments_md && renderMd(profile.core_departments_md)}
          </NoteSection>
        </div>
      )}

      {stage === 'generating' && (
        <div style={{
          background: BRAND_TINT, border: `1px solid ${BRAND}33`, borderRadius: 12,
          padding: '18px 16px', textAlign: 'center', color: BRAND, fontSize: 13,
          fontWeight: 500,
        }}>
          正在生成完整战略解码地图 (BSC + MWB + OGSM + PPC)... 60-90 秒
        </div>
      )}
      {stage === 'done' && (
        <div style={{
          background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 12,
          padding: '18px 16px', color: '#059669', fontSize: 13, lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>战略解码地图已生成</div>
          <div style={{ color: '#065F46' }}>
            上面"看战略解码地图 →"按钮进入完整展示页。
          </div>
        </div>
      )}
      {stage === 'error' && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12,
          padding: '18px 16px', color: '#B91C1C', fontSize: 13, lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>解码生成失败</div>
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

/**
 * 路径 C 组织访谈 (建立体系) — LLM 驱动的多轮访谈,镜像薪酬诊断的 InterviewView 模式。
 *
 * 跟之前硬编码 4 道死题 + 简单 regex 解析的版本不同,这个版本:
 *   · 每轮都调后端 POST /je/onboarding/extract,LLM 出 reply + extracted + follow_up
 *   · LLM 决定要不要追问 (follow_up=true 时同 step 增加 round_num,follow_up=false 进下一题)
 *   · 用户问元问题 (能不能截图 / 你的问题啥意思) LLM 会正面回答而不是硬跳下一题
 *   · 右侧"组织骨架"实时同步 extracted 字段:Q1 公司概况、Q2 部门、Q3 层级、Q4 现有体系
 *
 * 流程:
 *   Opening (LLM 生成开场) → JE_Q1 (公司概况) → JE_Q2 (部门) → JE_Q3 (层级) → JE_Q4 (现有体系)
 *   → 提交画像 → LLM 生成 20-40 个推荐岗位库 → onComplete → matrix 视图
 *
 * 跟 JeEntryView / SingleEvalView 同款 SparkyPanel + Workspace 左右分栏。
 */
import { useEffect, useRef, useState } from 'react';
import SparkyPanel from '../components/layout/SparkyPanel';
import Workspace from '../components/layout/Workspace';
import { nextMsgId } from '../lib/msgId';
import type { Message } from '../types';
import {
  jeSaveProfile, jeGenerateLibrary, jeOnboardingExtract,
  type JeOrgProfile, type JeLibrary,
} from '../api/client';

// 后端预热用 — JeOnboarding 进入即 ping /api/health 把 Render 免费档冷启动开掉
const API_BASE = (import.meta.env as any).VITE_API_URL || '/api';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

export type Stage = 'interview' | 'generating' | 'done' | 'error';
type StepId = 'Opening' | 'JE_Q1' | 'JE_Q2' | 'JE_Q3' | 'JE_Q4';

const STEP_ORDER: StepId[] = ['JE_Q1', 'JE_Q2', 'JE_Q3', 'JE_Q4'];

interface Props {
  onComplete: (profile: JeOrgProfile, library: JeLibrary) => void;
  /**
   * 用户点"跳过访谈,直接构建岗位"时的回调。
   * 跟薪酬诊断的"已准备好数据? 直接上传 →"是同一个套路 — 给那些已经知道
   * 自己要建什么岗位、不需要 Sparky 帮忙做组织摸底的用户一个出口。
   * 父组件一般直接 setView('matrix') 跳到图谱视图。
   */
  onSkip?: () => void;
}

export default function JeOnboarding({ onComplete, onSkip }: Props) {
  const [stage, setStage] = useState<Stage>('interview');
  const [profile, setProfile] = useState<Partial<JeOrgProfile>>({
    departments: [], layers: [],
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);

  // 访谈状态机:用 ref 避免闭包陷阱 (handleUserAnswer 是回调,会被 SparkyPanel 持有)
  const stepRef = useRef<StepId>('Opening');
  const roundRef = useRef<number>(1);
  const isFollowUpRef = useRef<boolean>(false);
  const lastSparkyQuestionRef = useRef<string>('');
  const profileRef = useRef<Partial<JeOrgProfile>>({ departments: [], layers: [] });
  const initRef = useRef(false);
  // 库生成完成后,把成果暂存在 ref 上 — done 阶段用户点'看推荐岗位库'再 onComplete
  // (之前是 setTimeout 800ms 自动跳走,导致访谈对话历史 + 右侧笔记被强制销毁,
  //  用户反馈'对话框里访谈的输入输出都没了')
  const finishedLibraryRef = useRef<JeLibrary | null>(null);
  const finishedProfileRef = useRef<JeOrgProfile | null>(null);

  // 进入即让 LLM 生成开场白 (走 question_id='Opening') + 后端预热
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    setMessages([{ role: 'user', text: '我要建职级体系,从头开始评估全公司岗位' }]);
    setTimeout(() => callExtract('Opening', ''), 200);

    // 进入访谈即预热后端 — Render 免费档冷启动 + 我们 LLM 库生成调用 30-60 秒,
    // 趁用户答 4 道题的 2-3 分钟把后端搞热,等 submitProfile 时就不会被
    // Render 边缘代理 / Cloudflare 切连接 (返回 502/504 + 没 CORS 头)
    fetch(`${API_BASE}/health`, { method: 'GET' }).catch(() => {});
  }, []);

  /** 把 extracted 字段同步到 profile state (LLM 输出格式见 interview_je_extract.txt) */
  const applyExtracted = (items: Array<{ field_name: string; value: string }>) => {
    setProfile(prev => {
      const next = { ...prev };
      for (const item of items) {
        const v = (item.value || '').trim();
        if (!v) continue;
        if (item.field_name === 'company_profile') {
          // 解析 markdown 出 industry / headcount tag (其他字段在卡片上整体展示)
          const ind = v.match(/\*\*行业\*\*[:：]\s*([^\n]+)/);
          if (ind) next.industry = ind[1].trim();
          const hc = v.match(/(\d{2,7})\s*人/);
          if (hc) next.headcount = parseInt(hc[1], 10);
          (next as any).company_profile_md = v;
        } else if (item.field_name === 'departments') {
          next.departments = parseListAnswer(v);
        } else if (item.field_name === 'layers') {
          next.layers = parseListAnswer(v);
        } else if (item.field_name === 'existing_grade_system') {
          next.existing_grade_system = /^(无|没有|暂无)$/.test(v) ? null : v;
        }
      }
      profileRef.current = next;
      return next;
    });
  };

  /** 把当前 profile 浓缩成一段上下文,给 LLM 复习用 */
  const buildContext = (): string => {
    const p = profileRef.current;
    const parts: string[] = [];
    if ((p as any).company_profile_md) parts.push(`【公司概况】${(p as any).company_profile_md}`);
    if (p.departments && p.departments.length > 0) parts.push(`【部门】${p.departments.join('、')}`);
    if (p.layers && p.layers.length > 0) parts.push(`【层级】${p.layers.join('、')}`);
    if (p.existing_grade_system) parts.push(`【现有职级】${p.existing_grade_system}`);
    return parts.join('\n');
  };

  const getPreviousValue = (step: StepId): string => {
    const p = profileRef.current as any;
    if (step === 'JE_Q1') return p.company_profile_md || '';
    if (step === 'JE_Q2') return (p.departments || []).join('、');
    if (step === 'JE_Q3') return (p.layers || []).join('、');
    if (step === 'JE_Q4') return p.existing_grade_system || '';
    return '';
  };

  /** 核心调用:打 extract endpoint → 更新 profile + 流式说 reply + 决定下一步 */
  const callExtract = async (questionId: StepId, userAnswer: string) => {
    // Loading 气泡
    const loadingId = nextMsgId();
    setMessages(prev => [...prev, { id: loadingId, role: 'bot', text: 'Sparky 正在思考...' }]);

    try {
      const res = await jeOnboardingExtract({
        question_id: questionId,
        answer: userAnswer,
        previous_value: getPreviousValue(questionId),
        is_follow_up: isFollowUpRef.current,
        round: roundRef.current,
        follow_up_question: isFollowUpRef.current ? lastSparkyQuestionRef.current : '',
        context: buildContext(),
      });

      const { extracted, reply, follow_up } = res.data;

      // 1. 同步右侧
      if (Array.isArray(extracted)) applyExtracted(extracted);

      // 2. 把 loading 替换成空 bot 气泡,流式打 reply
      setMessages(prev => prev.map(m => m.id === loadingId ? { ...m, text: '' } : m));
      streamText(reply, (t) => {
        setMessages(prev => prev.map(m => m.id === loadingId ? { ...m, text: t } : m));
      });

      // 3. 提取 reply 里加粗的追问问题作为下一轮上下文 (LLM 把追问用 **包裹)
      const boldMatch = reply.match(/\*\*([^*]+)\*\*/);
      lastSparkyQuestionRef.current = boldMatch ? boldMatch[1] : reply.slice(-60);

      // 4. 状态机推进
      if (questionId === 'Opening') {
        // 开场之后等用户答 JE_Q1
        stepRef.current = 'JE_Q1';
        roundRef.current = 1;
        isFollowUpRef.current = true;     // Opening 永远 follow_up=true
        return;
      }

      if (follow_up) {
        // 留在当前题继续追问
        roundRef.current += 1;
        isFollowUpRef.current = true;
      } else {
        // 进下一题
        const idx = STEP_ORDER.indexOf(questionId);
        if (idx >= 0 && idx + 1 < STEP_ORDER.length) {
          stepRef.current = STEP_ORDER[idx + 1];
          roundRef.current = 1;
          isFollowUpRef.current = false;
          lastSparkyQuestionRef.current = '';
        } else {
          // 最后一题收束 → 提交画像 + 生成岗位库
          // 等 reply 流式打完再触发 (大约 reply.length * 25ms)
          setTimeout(() => submitProfile(), reply.length * 25 + 500);
        }
      }
    } catch (err: any) {
      console.error('[JeOnboarding] extract failed', err);
      // 把 loading 改成错误提示
      const msg = err?.response?.data?.error || err?.message || '网络抖动,刚才那条没收到';
      setMessages(prev => prev.map(m => m.id === loadingId ? {
        ...m,
        text: `刚才有点小问题:${msg}。再说一遍试试,或者直接说"跳过"我们就用现有信息进入下一步。`,
      } : m));
    }
  };

  /** SparkyPanel 用户输入回调 — 阻止默认主诊断 chat,走我们的 extract */
  const handleUserAnswer = (text: string): boolean => {
    setMessages(prev => [...prev, { role: 'user', text }]);

    // 用户在生成阶段或完成态还在输入,给个引导
    if (stage !== 'interview') {
      const replyId = nextMsgId();
      setMessages(prev => [...prev, { id: replyId, role: 'bot', text: '' }]);
      streamText(
        stage === 'generating'
          ? '岗位库生成中,等几秒,完成后会自动进入选岗。'
          : '访谈我都收完了,稍等会自动进入选岗界面。',
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
    const finalProfile: JeOrgProfile = {
      industry: p.industry || null,
      headcount: p.headcount ?? null,
      departments: p.departments || [],
      layers: p.layers || [],
      existing_grade_system: p.existing_grade_system || null,
    };

    // 先告诉用户在生成
    const genId = nextMsgId();
    setMessages(prev => [...prev, { id: genId, role: 'bot', text: '' }]);
    streamText(
      `画像信息我都收齐了 — ${finalProfile.industry || '未指定行业'} · ${finalProfile.headcount ?? '?'} 人 · ${finalProfile.departments.length} 个部门 · ${finalProfile.layers.length} 个管理层级。\n\n我从我们的标准岗位库里挑跟你们行业匹配的岗位...`,
      (t) => setMessages(prev => prev.map(m => m.id === genId ? { ...m, text: t } : m)),
    );

    try {
      await jeSaveProfile(finalProfile);
      const result = await tryGenerateLibraryWithRetry((retryNum) => {
        // 重试时给用户一个反馈,知道我们在做什么
        const noticeId = nextMsgId();
        setMessages(prev => [...prev, { id: noticeId, role: 'bot', text: '' }]);
        streamText(
          `刚才那次没成功 (Render 免费档可能是冷启动了),自动重试中,第 ${retryNum + 1} 次...`,
          (t) => setMessages(prev => prev.map(m => m.id === noticeId ? { ...m, text: t } : m)),
        );
      });

      finishedProfileRef.current = finalProfile;

      // 行业不命中 standard library — 给友好的引导文案,允许用户进图谱手动建岗
      if (!result.library) {
        finishedLibraryRef.current = {
          entries: [], generated_at: new Date().toISOString(), model_used: 'none',
        };
        const noticeId = nextMsgId();
        setMessages(prev => [...prev, { id: noticeId, role: 'bot', text: '' }]);
        streamText(
          `**抱歉,我们暂时没有"${finalProfile.industry || '你们行业'}"的标准岗位库**\n\n${result.hint || '我们的标准岗位库还在持续扩展中。'}\n\n你可以先用其他方式建岗:\n· 单评一个岗位(粘 JD 最准)\n· 批量上传 Excel 清单\n· 进图谱后手动加岗位\n\n后续我们补上你们行业模板后,你重新走一次访谈就能看到匹配的标准岗位。\n\n点右下角"进入图谱"开始。`,
          (t) => setMessages(prev => prev.map(m => m.id === noticeId ? { ...m, text: t } : m)),
          () => setStage('done'),
        );
        return;
      }

      // 命中,展示标准库岗位
      finishedLibraryRef.current = result.library;
      const doneId = nextMsgId();
      setMessages(prev => [...prev, { id: doneId, role: 'bot', text: '' }]);
      streamText(
        `从我们的标准岗位库里给你挑了 ${result.library.entries.length} 个跟"${finalProfile.industry || '你们行业'}"匹配的岗位。准备好后点右下角"看推荐岗位库"进入选岗界面,挑跟你们实际匹配的就行。\n\n如果对刚才的访谈内容或推荐有疑问,直接问我。`,
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
        ? '是网络问题,可能是 Render 后端冷启动或 LLM 那边超时。重试 3 次都没成功。'
        : `LLM 那边报错了:${msg}`;
      streamText(
        `生成岗位库失败 — ${detail}\n\n两个选择:\n· 刷新页面重走一次访谈(2 分钟,信息我会重新收集)\n· 直接进选岗界面手动建岗(画像信息已存,后续可以让我重新生成)`,
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

      {/* 右:访谈笔记 — 文字摘要,不再用部门×层级矩阵 */}
      <Workspace
        mode="wide"
        title="访谈笔记"
        subtitle="访谈中实时整理,完成后用来生成推荐岗位库"
        headerExtra={onSkip && stage === 'interview' ? (
          // 仅在访谈中阶段才显示跳过链接 — 已经走到 generating/done/error,跳过没意义
          <span
            onClick={onSkip}
            style={{
              fontSize: 13, color: BRAND, cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            title="跳过组织访谈,直接进入图谱视图自己建岗位"
          >
            跳过访谈,直接建岗 →
          </span>
        ) : undefined}
      >
        {/* done 状态下顶部 CTA — 用户主动决定什么时候离开访谈视图,这样
            访谈对话历史 + 笔记都能被回看,不会因为自动跳转被销毁 */}
        {stage === 'done' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button
              onClick={() => {
                if (finishedProfileRef.current && finishedLibraryRef.current) {
                  onComplete(finishedProfileRef.current, finishedLibraryRef.current);
                }
              }}
              style={primaryBtn}
            >
              {(finishedLibraryRef.current?.entries.length || 0) > 0
                ? '看推荐岗位库 →'
                : '进入图谱视图 →'}
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
// 右侧访谈笔记 — 4 段文字摘要,顾问随手记的样子。
// 访谈完成 → submitProfile → onComplete 跳到 matrix 视图,那边直接展示
// 推荐岗位库,所以这里不再尝试'实时构建组织矩阵'(那种结构化展示对 LLM
// 提取的自由文本不友好)。
// ============================================================================
export function NotesView({ profile, stage, errorText }: {
  profile: Partial<JeOrgProfile>;
  stage: Stage;
  errorText: string | null;
}) {
  const profileMd = (profile as any).company_profile_md as string | undefined;
  const hasAny = profileMd
    || (profile.departments?.length || 0) > 0
    || (profile.layers?.length || 0) > 0
    || profile.existing_grade_system != null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!hasAny && (
        <div style={{
          padding: '40px 24px', textAlign: 'center', color: '#94A3B8', fontSize: 13,
          background: '#fff', border: '1px dashed #E2E8F0', borderRadius: 12,
        }}>
          访谈开始后这里会逐段出现你们公司的关键信息 — 行业 / 规模 / 部门 / 层级 / 现有职级体系。访谈结束后我会基于这些信息生成推荐岗位库。
        </div>
      )}

      {hasAny && (
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
          padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          <NoteSection
            label="公司概况"
            empty="(待 Q1 收集)"
            done={!!profileMd}
          >
            {profileMd && renderMd(profileMd)}
          </NoteSection>

          <NoteSection
            label="部门 / 团队"
            empty="(待 Q2 收集)"
            done={(profile.departments?.length || 0) > 0}
          >
            {(profile.departments?.length || 0) > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {profile.departments!.map(d => <Chip key={d}>{d}</Chip>)}
              </div>
            )}
          </NoteSection>

          <NoteSection
            label="管理层级"
            empty="(待 Q3 收集)"
            done={(profile.layers?.length || 0) > 0}
          >
            {(profile.layers?.length || 0) > 0 && (
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
                {profile.layers!.join(' → ')}
              </div>
            )}
          </NoteSection>

          <NoteSection
            label="现有职级体系"
            empty="(待 Q4 收集)"
            done={profile.existing_grade_system != null || stage !== 'interview'}
          >
            {profile.existing_grade_system != null ? (
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
                {profile.existing_grade_system}
              </div>
            ) : stage !== 'interview' ? (
              <div style={{ fontSize: 13, color: '#94A3B8' }}>暂无正式体系</div>
            ) : null}
          </NoteSection>
        </div>
      )}

      {/* 状态条 */}
      {stage === 'generating' && (
        <div style={{
          background: BRAND_TINT, border: `1px solid ${BRAND}33`, borderRadius: 12,
          padding: '18px 16px', textAlign: 'center', color: BRAND, fontSize: 13,
          fontWeight: 500,
        }}>
          正在从标准岗位库里挑跟你们行业匹配的岗位...
        </div>
      )}
      {stage === 'done' && (
        <div style={{
          background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 12,
          padding: '18px 16px', color: '#059669', fontSize: 13, lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>岗位库已生成</div>
          <div style={{ color: '#065F46' }}>
            上面"看推荐岗位库 →"按钮进入选岗界面。这页的对话历史 + 笔记都还在,需要时可以滚回去看。
          </div>
        </div>
      )}
      {stage === 'error' && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12,
          padding: '18px 16px', color: '#B91C1C', fontSize: 13,
          lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>岗位库生成失败</div>
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

/** 把 LLM 输出的 **加粗** markdown 渲染成行。SparkyPanel 的 markdown 是块级的不通用,
 *  这里专门给笔记区做轻量 inline 加粗渲染。 */
function renderMd(text: string): React.ReactNode {
  return (
    <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
      {text.split('\n').map((line, i) => (
        <div key={i}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <span key={j} style={{ fontWeight: 600, color: '#0F172A' }}>{part.slice(2, -2)}</span>;
            }
            return <span key={j}>{part}</span>;
          })}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// 工具函数
// ============================================================================

function parseListAnswer(text: string): string[] {
  // 顿号 / 逗号 / 中英文逗号 / 斜杠 / 分号 / 换行 / 多空白都当分隔符
  return text
    .split(/[、,，;；\/\n]+|\s{2,}/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.length < 30);
}

/**
 * jeGenerateLibrary 带 3 次重试 + 指数退避。
 *
 * 失败常见原因:
 *  · Render 免费档冷启动 (前面 health ping 已经预热,但偶发还是会冷)
 *  · LLM 那边超时 (生成 20-40 个岗位 + 8 因子的 JSON,慢的时候 60s+)
 *  · 网络/Cloudflare 切连接 (502/504 没带 CORS 头,axios 报 Network Error)
 *
 * 策略:第一次失败等 4s,第二次等 8s,共 3 次。
 * 期间在 Sparky 里告诉用户'重试中,第 N 次',不用让用户对着白屏猜。
 */
async function tryGenerateLibraryWithRetry(
  onRetry: (retryNum: number) => void,
): Promise<{ library: JeLibrary | null; hint?: string }> {
  let lastErr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      onRetry(attempt);
      await new Promise(r => setTimeout(r, 4000 * attempt));
    }
    try {
      // 现在不调 LLM 了,纯查表很快;timeout 留 30s 兜底就行
      const res = await jeGenerateLibrary({ timeout: 30_000 });
      return res.data;     // {library, hint}
    } catch (e: any) {
      lastErr = e;
      console.warn(`[je-library] generate attempt ${attempt + 1} failed:`,
        e?.message, e?.response?.status);
    }
  }
  throw lastErr;
}

// 流式打字 (跟 SingleEvalView/BatchEvalView/JeEntryView 同款)
// 后续应该提取到 src/lib/streamText.ts 共用
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

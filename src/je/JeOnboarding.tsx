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

type Stage = 'interview' | 'generating' | 'done' | 'error';
type StepId = 'Opening' | 'JE_Q1' | 'JE_Q2' | 'JE_Q3' | 'JE_Q4';

const STEP_ORDER: StepId[] = ['JE_Q1', 'JE_Q2', 'JE_Q3', 'JE_Q4'];

interface Props {
  onComplete: (profile: JeOrgProfile, library: JeLibrary) => void;
}

export default function JeOnboarding({ onComplete }: Props) {
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
      `画像信息我都收齐了 — ${finalProfile.industry || '未指定行业'} · ${finalProfile.headcount ?? '?'} 人 · ${finalProfile.departments.length} 个部门 · ${finalProfile.layers.length} 个管理层级。\n\n现在我用这些信息让 LLM 给你们生成一套推荐岗位库(大概 20-30 秒)...`,
      (t) => setMessages(prev => prev.map(m => m.id === genId ? { ...m, text: t } : m)),
    );

    try {
      await jeSaveProfile(finalProfile);
      const library = await tryGenerateLibraryWithRetry((retryNum) => {
        // 重试时给用户一个反馈,知道我们在做什么
        const noticeId = nextMsgId();
        setMessages(prev => [...prev, { id: noticeId, role: 'bot', text: '' }]);
        streamText(
          `刚才那次没成功 (Render 免费档可能是冷启动了),自动重试中,第 ${retryNum + 1} 次...`,
          (t) => setMessages(prev => prev.map(m => m.id === noticeId ? { ...m, text: t } : m)),
        );
      });

      const doneId = nextMsgId();
      setMessages(prev => [...prev, { id: doneId, role: 'bot', text: '' }]);
      streamText(
        `生成完成 — 我为你们公司推荐了 ${library.entries.length} 个岗位。\n\n右边可以看到按部门分组的列表,每个岗位都带了 Hay 职级和 8 因子建议。从里面挑跟你们实际匹配的,或者告诉我需要增减哪些。`,
        (t) => setMessages(prev => prev.map(m => m.id === doneId ? { ...m, text: t } : m)),
        () => {
          setStage('done');
          setTimeout(() => onComplete(finalProfile, library), 800);
        },
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

      {/* 右:组织骨架 (实时构建) */}
      <Workspace mode="wide" title="组织骨架" subtitle="访谈中实时构建">
        <SkeletonView profile={profile} stage={stage} errorText={errorText} />
      </Workspace>
    </div>
  );
}

// ============================================================================
// 右侧骨架视图 — 根据 profile 当前完成度展示不同形态
// ============================================================================
function SkeletonView({ profile, stage, errorText }: {
  profile: Partial<JeOrgProfile>;
  stage: Stage;
  errorText: string | null;
}) {
  const hasOrg = !!profile.industry || profile.headcount != null;
  const hasDept = (profile.departments?.length || 0) > 0;
  const hasLayers = (profile.layers?.length || 0) > 0;
  const profileMd = (profile as any).company_profile_md as string | undefined;

  if (!hasOrg && !hasDept && !hasLayers) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
        访谈开始后这里会逐步出现你们公司的组织骨架
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 公司概况 — 行业 / 规模 / (现有体系) tag + 完整 markdown */}
      {hasOrg && (
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16,
        }}>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>公司概况</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: profileMd ? 12 : 0 }}>
            {profile.industry && <Tag>{profile.industry}</Tag>}
            {profile.headcount != null && <Tag>{profile.headcount} 人</Tag>}
            {profile.existing_grade_system && <Tag accent>{profile.existing_grade_system}</Tag>}
          </div>
          {profileMd && (
            <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {profileMd.replace(/\*\*([^*]+)\*\*/g, '$1')}
            </div>
          )}
        </div>
      )}

      {/* 部门 × 层级 矩阵 */}
      {hasDept && (
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16,
          overflowX: 'auto',
        }}>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 12 }}>
            {hasLayers ? '部门 × 层级' : '部门列表'}
          </div>
          {hasLayers ? (
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 64, textAlign: 'right', paddingRight: 12 }}>层级</th>
                  {profile.departments!.map(d => (
                    <th key={d} style={thStyle}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profile.layers!.map(layer => (
                  <tr key={layer}>
                    <td style={layerCellStyle}>{layer}</td>
                    {profile.departments!.map(d => (
                      <td key={`${layer}_${d}`} style={cellStyle}>
                        <div style={cellPlaceholder}>·</div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {profile.departments!.map(d => <Tag key={d}>{d}</Tag>)}
            </div>
          )}
          <div style={{ marginTop: 12, fontSize: 11, color: '#94A3B8' }}>
            · = 待填入岗位(访谈完成后会用 AI 推荐填进去)
          </div>
        </div>
      )}

      {/* 状态条 */}
      {stage === 'generating' && (
        <div style={{
          background: BRAND_TINT, border: `1px solid ${BRAND}33`, borderRadius: 12,
          padding: '20px 16px', textAlign: 'center', color: BRAND, fontSize: 13,
        }}>
          正在根据组织画像生成推荐岗位库(约 20-30 秒)...
        </div>
      )}
      {stage === 'done' && (
        <div style={{
          background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 12,
          padding: '20px 16px', textAlign: 'center', color: '#059669', fontSize: 13,
        }}>
          岗位库生成完成,进入选岗界面...
        </div>
      )}
      {stage === 'error' && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12,
          padding: '20px 16px', textAlign: 'center', color: '#B91C1C', fontSize: 13,
        }}>
          岗位库生成失败:{errorText || '未知错误'}
        </div>
      )}
    </div>
  );
}

function Tag({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span style={{
      padding: '4px 10px', borderRadius: 999, fontSize: 12,
      background: accent ? BRAND_TINT : '#F1F5F9',
      color: accent ? BRAND : '#475569',
      border: `1px solid ${accent ? BRAND : 'transparent'}`,
      fontWeight: accent ? 600 : 400,
    }}>
      {children}
    </span>
  );
}

const thStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, color: '#64748B',
  padding: '8px 6px', textAlign: 'left',
  borderBottom: '1px solid #E2E8F0',
};
const layerCellStyle: React.CSSProperties = {
  fontSize: 11, color: '#64748B', textAlign: 'right',
  paddingRight: 12, paddingTop: 8, paddingBottom: 8,
  borderRight: '1px solid #F1F5F9', verticalAlign: 'top',
  fontFamily: 'ui-monospace, monospace',
};
const cellStyle: React.CSSProperties = {
  padding: 6, verticalAlign: 'top', minWidth: 80,
  borderRight: '1px dashed #F1F5F9', borderBottom: '1px dashed #F1F5F9',
};
const cellPlaceholder: React.CSSProperties = {
  minHeight: 24, color: '#CBD5E1', fontSize: 14, textAlign: 'center', padding: 4,
};

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
): Promise<JeLibrary> {
  let lastErr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      onRetry(attempt);
      await new Promise(r => setTimeout(r, 4000 * attempt));
    }
    try {
      // 这个调用本来就慢 (LLM 生成 20-40 个岗位,30-90s),150s timeout 比较合理
      // — 跟 Render gunicorn 300s 配置留余量
      const res = await jeGenerateLibrary({ timeout: 150_000 });
      return res.data.library;
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

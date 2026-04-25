/**
 * JE Step 0：组织画像访谈 + 实时构建组织骨架矩阵。
 *
 * 用户旅程（v2 设计文档第三章）：
 *  Q1 → 行业 + 规模     → 顶部出现"公司概况"标签
 *  Q2 → 部门列表        → 右侧出现横向排列的部门列
 *  Q3 → 管理层级        → 部门 × 层级形成空白骨架矩阵
 *  Q4 → 现有职级体系    → 顶部补充"现有体系"标签
 *  → 提交画像 → LLM 生成 20-40 个推荐岗位库 → 进入 Step 1
 *
 * 跟 JeSparkyChat 的关系：本组件**替换** JeSparkyChat 在访谈期间出现，
 * 同样用 SparkyPanel 渲染对话区，唯一区别是 onNonChatSend 走访谈状态机。
 *
 * 访谈结束后 onComplete 回调 → JeApp 切到 matrix 视图，library 已存在 DB。
 */
import { useEffect, useRef, useState } from 'react';
import SparkyPanel from '../components/layout/SparkyPanel';
import Workspace from '../components/layout/Workspace';
import { nextMsgId } from '../lib/msgId';
import type { Message } from '../types';
import {
  jeSaveProfile, jeGenerateLibrary,
  type JeOrgProfile, type JeLibrary,
} from '../api/client';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

type Step = 'q1_intro' | 'q1' | 'q2' | 'q3' | 'q4' | 'generating' | 'done' | 'error';

interface Props {
  onComplete: (profile: JeOrgProfile, library: JeLibrary) => void;
}

export default function JeOnboarding({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('q1_intro');
  const [profile, setProfile] = useState<Partial<JeOrgProfile>>({
    departments: [],
    layers: [],
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const initRef = useRef(false);
  const errorRef = useRef<string | null>(null);

  // 进入即触发：用户气泡 + Sparky 流式开场 + Q1
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    setMessages([{ role: 'user', text: '我要建职级体系，从头开始评估全公司岗位' }]);
    setTimeout(() => askWithStream(buildIntro(), 'q1'), 200);
  }, []);

  const askWithStream = (text: string, nextStep: Step) => {
    const replyId = nextMsgId();
    setMessages(prev => [...prev, { id: replyId, role: 'bot', text: '' }]);
    streamText(text, (t) => {
      setMessages(prev => prev.map(m => m.id === replyId ? { ...m, text: t } : m));
    }, () => {
      setStep(nextStep);
    });
  };

  // ---- 用户回答处理 ----
  const handleUserAnswer = (text: string): boolean => {
    setMessages(prev => [...prev, { role: 'user', text }]);

    // 状态机：根据当前 step 解析答案
    if (step === 'q1') {
      const { industry, headcount } = parseQ1(text);
      setProfile(p => ({ ...p, industry: industry || p.industry, headcount: headcount ?? p.headcount }));
      setTimeout(() => askWithStream(buildQ2Question(), 'q2'), 300);
    } else if (step === 'q2') {
      const departments = parseListAnswer(text);
      setProfile(p => ({ ...p, departments }));
      setTimeout(() => askWithStream(buildQ3Question(departments), 'q3'), 300);
    } else if (step === 'q3') {
      const layers = parseListAnswer(text);
      setProfile(p => ({ ...p, layers }));
      setTimeout(() => askWithStream(buildQ4Question(), 'q4'), 300);
    } else if (step === 'q4') {
      const existing = text.trim().match(/没|无|暂无|不/) ? null : text.trim();
      const finalProfile: JeOrgProfile = {
        industry: profile.industry || null,
        headcount: profile.headcount ?? null,
        departments: profile.departments || [],
        layers: profile.layers || [],
        existing_grade_system: existing,
      };
      setProfile(finalProfile);
      submitProfile(finalProfile);
    } else {
      // 已完成访谈但用户还在输入 — 给个引导
      const replyId = nextMsgId();
      setMessages(prev => [...prev, { id: replyId, role: 'bot', text: '' }]);
      streamText('画像信息我已经收集完了，你可以等岗位库生成完，或者刷新页面重新走一遍访谈。', (t) => {
        setMessages(prev => prev.map(m => m.id === replyId ? { ...m, text: t } : m));
      });
    }
    return true;     // 阻止 SparkyPanel 调主诊断 chat 端点
  };

  const submitProfile = async (p: JeOrgProfile) => {
    setStep('generating');
    askWithStream(buildGeneratingMessage(p), 'generating');

    try {
      // 先保存画像
      await jeSaveProfile(p);
      // 再触发 LLM 生成岗位库（30 秒级，期待用户耐心等）
      const libRes = await jeGenerateLibrary();
      const library = libRes.data.library;
      // 流式说一句完成 → 触发 onComplete
      const replyId = nextMsgId();
      setMessages(prev => [...prev, { id: replyId, role: 'bot', text: '' }]);
      streamText(
        `生成完成 —— 我为你们公司推荐了 ${library.entries.length} 个岗位。\n\n` +
        `右边可以看到按部门分组的列表，每个岗位都带了 Hay 职级和 8 因子建议。从里面挑跟你们实际匹配的，或者告诉我需要增减哪些。`,
        (t) => {
          setMessages(prev => prev.map(m => m.id === replyId ? { ...m, text: t } : m));
        },
        () => {
          setStep('done');
          setTimeout(() => onComplete(p, library), 800);
        },
      );
    } catch (err: any) {
      errorRef.current = err?.response?.data?.reason || err?.message || '未知错误';
      setStep('error');
      const replyId = nextMsgId();
      setMessages(prev => [...prev, { id: replyId, role: 'bot', text: '' }]);
      streamText(
        `生成岗位库时遇到问题：${errorRef.current}\n\n` +
        `刷新页面重新走访谈，或者直接进入选岗界面（我会先用空岗位库让你手动建岗）。`,
        (t) => {
          setMessages(prev => prev.map(m => m.id === replyId ? { ...m, text: t } : m));
        },
      );
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: '#FAFAFA' }}>
      {/* 左：Sparky 对话区 */}
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

      {/* 右：组织骨架矩阵（实时构建） */}
      <Workspace mode="wide" title="组织骨架" subtitle="访谈中实时构建">
        <SkeletonView profile={profile} step={step} />
      </Workspace>
    </div>
  );
}

// ============================================================================
// 右侧骨架渲染：根据 profile 当前完成度展示不同形态
// ============================================================================
function SkeletonView({ profile, step }: { profile: Partial<JeOrgProfile>; step: Step }) {
  const hasOrg = !!profile.industry || profile.headcount != null;
  const hasDept = (profile.departments?.length || 0) > 0;
  const hasLayers = (profile.layers?.length || 0) > 0;

  if (!hasOrg && !hasDept && !hasLayers) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
        访谈开始后这里会逐步出现你们公司的组织骨架
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 顶部：公司概况 + 现有体系标签 */}
      {hasOrg && (
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
          padding: 16,
        }}>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>公司概况</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 13 }}>
            {profile.industry && <Tag>{profile.industry}</Tag>}
            {profile.headcount != null && <Tag>{profile.headcount} 人</Tag>}
            {profile.existing_grade_system && <Tag accent>{profile.existing_grade_system}</Tag>}
          </div>
        </div>
      )}

      {/* 中部：部门 × 层级 骨架矩阵 */}
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
              {profile.departments!.map(d => (
                <Tag key={d}>{d}</Tag>
              ))}
            </div>
          )}

          <div style={{ marginTop: 12, fontSize: 11, color: '#94A3B8' }}>
            · = 待填入岗位（访谈完成后会用 AI 推荐填进去）
          </div>
        </div>
      )}

      {/* 生成态 / 完成态 */}
      {step === 'generating' && (
        <div style={{
          background: BRAND_TINT, border: `1px solid ${BRAND}33`, borderRadius: 12,
          padding: '20px 16px', textAlign: 'center', color: BRAND, fontSize: 13,
        }}>
          正在根据组织画像生成推荐岗位库（约 20-30 秒）…
        </div>
      )}
      {step === 'done' && (
        <div style={{
          background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 12,
          padding: '20px 16px', textAlign: 'center', color: '#059669', fontSize: 13,
        }}>
          岗位库生成完成，进入选岗界面…
        </div>
      )}
      {step === 'error' && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12,
          padding: '20px 16px', textAlign: 'center', color: '#B91C1C', fontSize: 13,
        }}>
          岗位库生成失败，请刷新重试。
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
// Sparky 文案
// ============================================================================

function buildIntro(): string {
  return [
    '你好，我是 Sparky，岗位价值评估的 AI 助手。',
    '',
    '建职级体系前，我需要先了解一下你们公司的基本情况 — 4 个简单的问题，大概 2 分钟。访谈过程中右边会实时构建你们的"组织骨架"。',
    '',
    '**第 1 题：你们公司是什么行业？大概多少人？**',
    '直接告诉我就行，比如"互联网，200 人"或者"制造业，1500 人"。',
  ].join('\n');
}

function buildQ2Question(): string {
  return [
    '好的，记下来了。',
    '',
    '**第 2 题：你们公司有哪些部门？**',
    '逗号分隔列出来就行，比如"产品部、技术部、市场部、HR、财务"。如果没有正式的部门划分，告诉我大致几个团队也可以。',
  ].join('\n');
}

function buildQ3Question(departments: string[]): string {
  return [
    `好，${departments.length} 个部门记下来了。`,
    '',
    '**第 3 题：从最高层到最基层有几个管理层级？**',
    '逗号分隔，从高到低列，比如"CEO、VP、总监、经理、专员"。如果不同部门层级不一样，先给一个最常见的就好，后面可以单独调。',
  ].join('\n');
}

function buildQ4Question(): string {
  return [
    '骨架成型了，右边可以看到部门 × 层级的矩阵。',
    '',
    '**第 4 题（最后一题）：你们现在用什么职级体系？**',
    '比如"P1-P10 序列"、"M1-M5 管理序列"、"E 级技术序列+M 级管理序列"。如果还没有正式职级，说"暂无"就行。',
  ].join('\n');
}

function buildGeneratingMessage(p: JeOrgProfile): string {
  return [
    '画像信息我都收齐了 —— ',
    `${p.industry || '未指定行业'} · ${p.headcount ?? '?'} 人 · ${p.departments.length} 个部门 · ${p.layers.length} 个管理层级。`,
    '',
    '现在我用这些信息让 LLM 给你们生成一套推荐岗位库（大概 20-30 秒）…',
  ].join('\n');
}

// ============================================================================
// 用户回答解析（轻量、不调 LLM）
// ============================================================================

function parseQ1(text: string): { industry?: string; headcount?: number } {
  // 提取数字（可能带"人"、"位"等单位）
  const numMatch = text.match(/(\d+(?:[,，]\d+)?)\s*(?:人|位|名|members|employees)?/i);
  const headcount = numMatch ? parseInt(numMatch[1].replace(/[,，]/g, ''), 10) : undefined;

  // 行业 = 去掉数字部分剩下的文字
  let industry = text;
  if (numMatch) industry = industry.replace(numMatch[0], '');
  industry = industry.replace(/[，,。.；;\s]+/g, ' ').trim();
  if (industry.length > 30) industry = industry.slice(0, 30);

  return { industry: industry || undefined, headcount };
}

function parseListAnswer(text: string): string[] {
  // 支持各种分隔符：逗号 / 顿号 / 空格 / 斜杠
  return text
    .split(/[,，、\/\s\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.length < 30);
}

// ============================================================================
// 流式打字（跟 JeSparkyChat 一致，25ms / 字）
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

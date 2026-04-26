/**
 * 路径 B 批量评估 — 全程左右分栏 + 原地过渡(替换之前的 BatchUpload 模态)。
 *
 * 跟 SingleEvalView 同构造:
 *   左:SparkyPanel 流式开场 + 进度评论 + 完成总结
 *   右:Workspace 工作台,五段原地过渡
 *
 * 阶段 (Stage):
 *   upload      上传前 — 拖拽区 + 列说明
 *   uploading   上传中 — multipart 提交,等后端解析校验
 *   running     评估中 — 1.5s 轮询 GET /batches/<id>,展示进度条 + 当前评估列表
 *   done        完成   — 成功/失败统计 + 失败行原因 + 跳"看图谱"
 *   error       上传失败 — 解析错误兜底
 *
 * Sparky 节奏 (避免刷屏,只在阶段切换时各发一次):
 *   - 进入即开场:介绍 Excel 列要求 + 评估流程预期
 *   - upload → running:解析完成,识别到 N 个岗位,开始并行评估
 *   - running → done:总结成功率 + AI 推断比例 + 建议下一步
 *   - 任何阶段 → error:用 Sparky 给出友好的错误说明
 */
import { useEffect, useRef, useState } from 'react';
import SparkyPanel from '../components/layout/SparkyPanel';
import Workspace from '../components/layout/Workspace';
import { jeCreateBatch, jeGetBatch, type JeBatch } from '../api/client';
import { nextMsgId } from '../lib/msgId';
import type { Message } from '../types';

const BRAND = '#D85A30';
const POLL_INTERVAL_MS = 1500;

type Stage = 'upload' | 'uploading' | 'running' | 'done' | 'error';

interface Props {
  /** 完成 + 跳图谱 — 父组件刷新岗位列表 + 切到 matrix 视图 */
  onComplete: () => void;
  /** 用户手动回到入口选择页 */
  onBackToEntry: () => void;
}

export default function BatchEvalView({ onComplete, onBackToEntry }: Props) {
  const [stage, setStage] = useState<Stage>('upload');
  const [messages, setMessages] = useState<Message[]>([]);
  const [batch, setBatch] = useState<JeBatch | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [createMeta, setCreateMeta] = useState<{ total: number; parseErrors: string[] } | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<number | null>(null);
  const initRef = useRef(false);
  const parseDoneFiredRef = useRef(false);
  const summaryFiredRef = useRef(false);

  // 进入即触发 Sparky 开场
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    setMessages([{ role: 'user', text: '我有岗位清单要批量评' }]);
    const replyId = nextMsgId();
    setTimeout(() => {
      setMessages(prev => [...prev, { id: replyId, role: 'bot', text: '' }]);
      streamText(buildIntroText(), (t) => {
        setMessages(prev => prev.map(m => m.id === replyId ? { ...m, text: t } : m));
      });
    }, 200);
  }, []);

  const sparkySay = (text: string) => {
    const id = nextMsgId();
    setMessages(prev => [...prev, { id, role: 'bot', text: '' }]);
    streamText(text, (t) => {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, text: t } : m));
    });
  };

  // 文件提交 → 后端解析校验 → 进入 running
  const handleFile = async (file: File) => {
    setStage('uploading');
    setErrorMsg(null);
    setParseErrors([]);
    try {
      const res = await jeCreateBatch(file);
      setBatchId(res.data.batch_id);
      setParseErrors(res.data.parse_errors || []);
      setCreateMeta({ total: res.data.total, parseErrors: res.data.parse_errors || [] });
      setStage('running');
    } catch (e: any) {
      const data = e?.response?.data;
      const msg = data?.error === 'no_valid_rows'
        ? (data.hint || '未识别到有效数据行')
        : (data?.hint || data?.error || '上传失败,请重试');
      setErrorMsg(msg);
      setParseErrors(data?.parse_errors || []);
      setStage('error');
      setTimeout(() => sparkySay(`上传出问题了:${msg}\n\n检查一下 Excel 格式,首列是岗位名 / 职位,然后点"重新上传"再试一次。`), 200);
    }
  };

  // 进 running 阶段一次性 Sparky 通知
  useEffect(() => {
    if (stage !== 'running' || !createMeta || parseDoneFiredRef.current) return;
    parseDoneFiredRef.current = true;
    const { total, parseErrors: errs } = createMeta;
    // 估个时间区间:每个岗位 5-15 秒(并行,LLM 跨岗位负载均衡)
    const minM = Math.max(1, Math.ceil(total * 5 / 60));
    const maxM = Math.max(1, Math.ceil(total * 15 / 60));
    const skipNote = errs.length > 0
      ? `(另有 ${errs.length} 行没识别到岗位名,被跳过 — 详见右侧)`
      : '';
    setTimeout(() => {
      sparkySay(`**Excel 解析完成 — 识别到 ${total} 个岗位**${skipNote ? '\n\n' + skipNote : ''}\n\n开始并行跑评估,大概要 ${minM}–${maxM} 分钟(每个岗位 5-15 秒,跨岗位负载均衡到不同 LLM 模型加速)。完成后我会给你一份职级分布总结。`);
    }, 300);
  }, [stage, createMeta]);

  // 轮询批次进度
  useEffect(() => {
    if (stage !== 'running' || !batchId) return;
    const tick = async () => {
      try {
        const res = await jeGetBatch(batchId);
        const b = res.data.batch;
        setBatch(b);
        if (b.status === 'completed' || b.status === 'failed') {
          setStage('done');
          return;
        }
      } catch (e) {
        console.warn('[batch poll] failed', e);
      }
      pollTimerRef.current = window.setTimeout(tick, POLL_INTERVAL_MS);
    };
    tick();
    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [stage, batchId]);

  // 进 done 阶段一次性 Sparky 总结
  useEffect(() => {
    if (stage !== 'done' || !batch || summaryFiredRef.current) return;
    summaryFiredRef.current = true;
    setTimeout(() => sparkySay(buildDoneSummary(batch, parseErrors)), 400);
  }, [stage, batch, parseErrors]);

  const handleRetry = () => {
    setStage('upload');
    setErrorMsg(null);
    setBatch(null);
    setBatchId(null);
    setCreateMeta(null);
    setParseErrors([]);
    parseDoneFiredRef.current = false;
    summaryFiredRef.current = false;
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: '#FAFAFA' }}>
      {/* 左:Sparky 对话 */}
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
          onNonChatSend={() => true}
          embedded={true}
        />
      </div>

      {/* 右:Workspace */}
      <Workspace mode="wide"
        title="批量评估"
        subtitle="一次评全公司岗位 — 拖个 Excel 进来"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button onClick={onBackToEntry} style={ghostBtn}>← 回到入口</button>
          {stage === 'done' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleRetry} style={ghostBtn}>再上传一批</button>
              <button onClick={onComplete} style={primaryBtn}>看职级图谱</button>
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <FadeBlock visible={stage === 'upload'}>
            <UploadView onFileSelected={handleFile} fileInputRef={fileInputRef} />
          </FadeBlock>

          <FadeBlock visible={stage === 'uploading'}>
            <Spinner text="正在解析 Excel..." />
          </FadeBlock>

          <FadeBlock visible={stage === 'running'}>
            {batch
              ? <RunningView batch={batch} parseErrors={parseErrors} />
              : <Spinner text="正在启动评估..." />
            }
          </FadeBlock>

          <FadeBlock visible={stage === 'done'}>
            {batch && <DoneView batch={batch} parseErrors={parseErrors} />}
          </FadeBlock>

          <FadeBlock visible={stage === 'error'}>
            <ErrorView message={errorMsg} parseErrors={parseErrors} onRetry={handleRetry} />
          </FadeBlock>
        </div>
      </Workspace>
    </div>
  );
}

// ============================================================================
// 各阶段子视图
// ============================================================================

function UploadView({ onFileSelected, fileInputRef }: {
  onFileSelected: (f: File) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 24 }}>
      <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.7, marginBottom: 18 }}>
        只有 <strong style={{ color: '#0F172A' }}>岗位名</strong> 是必填的,其他列按字段完备度自动决定评估深度:
        <ul style={{ margin: '10px 0', paddingLeft: 22 }}>
          <li><strong>岗位名 / 职位</strong>(必填)</li>
          <li><strong>JD / 岗位说明书</strong>(推荐)— 给了走深度分析,结果置信度高</li>
          <li>业务职能(可选)— 没给会回落到"通用职能",岗位名清晰时影响不大</li>
          <li>部门(可选)</li>
        </ul>
        没 JD 的岗位结果会标"AI 推断",建议后续单独点进去补 JD 重评。
      </div>

      <div
        onDrop={e => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) onFileSelected(f);
        }}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? BRAND : '#CBD5E1'}`,
          background: dragOver ? '#FEF7F4' : '#FAFAFA',
          borderRadius: 12, padding: '48px 24px', textAlign: 'center',
          cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        <div style={{ fontSize: 14, color: '#0F172A', marginBottom: 8 }}>
          点击选择文件,或拖拽 Excel 到这里
        </div>
        <div style={{ fontSize: 12, color: '#94A3B8' }}>
          支持 .xlsx 格式,单批建议不超过 200 个岗位
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) onFileSelected(f);
          }}
        />
      </div>
    </div>
  );
}

function Spinner({ text }: { text: string }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: '60px 24px', textAlign: 'center', color: '#64748B',
    }}>
      <div style={{ fontSize: 14, marginBottom: 8 }}>{text}</div>
      <div style={{ fontSize: 12, color: '#94A3B8' }}>左侧能看到分析进度</div>
    </div>
  );
}

function RunningView({ batch, parseErrors }: { batch: JeBatch; parseErrors: string[] }) {
  const pct = Math.round(batch.progress * 100);
  const inProgress = batch.items.filter(i => i.status === 'pending' || i.status === 'running').slice(0, 5);
  const recentDone = batch.items.filter(i => i.status === 'done').slice(-3).reverse();

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 24 }}>
      <div style={{ fontSize: 14, color: '#0F172A', marginBottom: 12 }}>
        正在评估 <strong>{batch.total}</strong> 个岗位 — 已完成 <strong>{batch.completed}</strong>,
        失败 <strong style={{ color: batch.failed ? '#DC2626' : '#0F172A' }}>{batch.failed}</strong>
      </div>
      <ProgressBar pct={pct} />
      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 8 }}>
        每个岗位的所有 LLM 调用走同一个模型,跨岗位负载均衡到不同模型 — 单批同时跑得更快、也避免单点故障。
      </div>

      {parseErrors.length > 0 && (
        <div style={{ marginTop: 16, padding: 12, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#92400E', fontWeight: 600, marginBottom: 6 }}>
            {parseErrors.length} 行未进入评估
          </div>
          {parseErrors.slice(0, 5).map((e, i) => (
            <div key={i} style={{ fontSize: 11, color: '#92400E', lineHeight: 1.5 }}>{e}</div>
          ))}
          {parseErrors.length > 5 && (
            <div style={{ fontSize: 11, color: '#92400E' }}>… 还有 {parseErrors.length - 5} 条</div>
          )}
        </div>
      )}

      {inProgress.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>当前评估中:</div>
          {inProgress.map(item => (
            <div key={item.index} style={{ fontSize: 13, color: '#475569', padding: '5px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              · {item.title}
              <span style={{ color: '#94A3B8', fontSize: 11 }}>({item.function})</span>
              {item.has_jd === false && <DepthBadge depth="lite" />}
            </div>
          ))}
        </div>
      )}

      {recentDone.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>刚刚完成:</div>
          {recentDone.map(item => (
            <div key={item.index} style={{ fontSize: 13, color: '#64748B', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#059669' }}>✓</span> {item.title}
              <span style={{ color: '#94A3B8', fontSize: 11 }}>({item.function})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DoneView({ batch, parseErrors }: { batch: JeBatch; parseErrors: string[] }) {
  const failed = batch.items.filter(i => i.status === 'failed');
  const succeeded = batch.items.filter(i => i.status === 'done');
  const liteCount = succeeded.filter(i => i.has_jd === false).length;
  const deepCount = succeeded.length - liteCount;

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 24 }}>
      <div style={{ fontSize: 16, color: '#0F172A', fontWeight: 600, marginBottom: 8 }}>
        评估完成
      </div>
      <div style={{ fontSize: 13, color: '#64748B', marginBottom: 14, lineHeight: 1.7 }}>
        共 {batch.total} 个岗位 · 成功 <strong style={{ color: '#059669' }}>{batch.completed}</strong>
        {batch.failed > 0 && <> · 失败 <strong style={{ color: '#DC2626' }}>{batch.failed}</strong></>}
      </div>

      {liteCount > 0 && (
        <div style={{ fontSize: 12, color: '#92400E', marginBottom: 16, padding: '10px 14px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, lineHeight: 1.7 }}>
          <strong>{liteCount}</strong> 个岗位是 AI 根据岗位名推断的(标"AI 推断"徽章),<strong>{deepCount}</strong> 个走了 JD 深度分析。建议进入图谱后,对置信度低的岗位补 JD 重新评估。
        </div>
      )}

      {failed.length > 0 && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 14, marginBottom: 16, maxHeight: 280, overflowY: 'auto' }}>
          <div style={{ fontSize: 12, color: '#991B1B', fontWeight: 600, marginBottom: 8 }}>失败列表:</div>
          {failed.map((item, idx) => (
            <div key={item.index} style={{ fontSize: 12, color: '#7F1D1D', padding: '5px 0', borderTop: idx > 0 ? '1px dashed #FECACA' : 'none' }}>
              <strong>{item.title}</strong>(职能:{item.function})
              <div style={{ color: '#991B1B', marginTop: 2 }}>{item.error || '未知错误'}</div>
            </div>
          ))}
        </div>
      )}

      {parseErrors.length > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#92400E', fontWeight: 600, marginBottom: 6 }}>
            另有 {parseErrors.length} 行未进入评估(解析阶段被跳过)
          </div>
          {parseErrors.slice(0, 3).map((e, i) => (
            <div key={i} style={{ fontSize: 11, color: '#92400E', lineHeight: 1.5 }}>{e}</div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.7 }}>
        所有成功评估的岗位已经入库,点上方"看职级图谱"即可看到全公司分布。
      </div>
    </div>
  );
}

function ErrorView({ message, parseErrors, onRetry }: {
  message: string | null;
  parseErrors: string[];
  onRetry: () => void;
}) {
  return (
    <div style={{ background: '#fff', border: '1px solid #FECACA', borderRadius: 12, padding: 24 }}>
      <div style={{ fontSize: 16, color: '#DC2626', fontWeight: 600, marginBottom: 10 }}>
        上传失败
      </div>
      <div style={{ fontSize: 13, color: '#64748B', marginBottom: 16, lineHeight: 1.7 }}>
        {message || '请稍后再试'}
      </div>
      {parseErrors.length > 0 && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 12, marginBottom: 16, maxHeight: 220, overflowY: 'auto' }}>
          {parseErrors.map((e, i) => (
            <div key={i} style={{ fontSize: 11, color: '#7F1D1D', lineHeight: 1.6 }}>{e}</div>
          ))}
        </div>
      )}
      <button onClick={onRetry} style={primaryBtn}>重新上传</button>
    </div>
  );
}

// ============================================================================
// 公共小组件
// ============================================================================
function ProgressBar({ pct }: { pct: number }) {
  return (
    <div style={{ height: 10, background: '#F1F5F9', borderRadius: 5, overflow: 'hidden' }}>
      <div style={{
        width: `${pct}%`, height: '100%', background: BRAND,
        transition: 'width 0.4s ease',
      }} />
    </div>
  );
}

function DepthBadge({ depth }: { depth: 'deep' | 'lite' }) {
  const isLite = depth === 'lite';
  return (
    <span style={{
      padding: '1px 6px', fontSize: 10, fontWeight: 500, borderRadius: 3,
      background: isLite ? '#FEF3C7' : '#DBEAFE',
      color: isLite ? '#92400E' : '#1E40AF',
    }}>
      {isLite ? 'AI 推断' : '深度分析'}
    </span>
  );
}

function FadeBlock({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div style={{
      opacity: visible ? 1 : 0,
      pointerEvents: visible ? 'auto' : 'none',
      transition: 'opacity 0.25s',
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
  // 注: SparkyPanel 把 **xxx** 渲染成块级 brand-orange div,会把 bullet
  // 行切断。所以列表项内只能用普通文本,**bold** 只用在独立标题行。
  return [
    '准备好了。把岗位清单的 Excel 拖到右边就行。',
    '',
    '· 只有"岗位名 / 职位"是必填的,其他列按完备度自动决定评估深度',
    '· 有 JD / 岗位说明书列的话,我会走深度分析,结果置信度更高',
    '· 没 JD 的岗位会标"AI 推断",建议后续单独点进去补 JD 重评',
    '',
    '单批建议不超过 200 个岗位。开始评估后,我会实时报进度,完成后给你一份职级分布总结。',
  ].join('\n');
}

function buildDoneSummary(batch: JeBatch, parseErrors: string[]): string {
  const succeeded = batch.items.filter(i => i.status === 'done');
  const failed = batch.items.filter(i => i.status === 'failed');
  const liteCount = succeeded.filter(i => i.has_jd === false).length;
  const deepCount = succeeded.length - liteCount;

  const head = `**评估完成 — 共评了 ${batch.total} 个岗位**`;

  const successLine = `成功 ${batch.completed} 个${batch.failed > 0 ? `,失败 ${batch.failed} 个` : ''}${parseErrors.length > 0 ? `,另有 ${parseErrors.length} 行解析阶段被跳过` : ''}。`;

  let depthLine = '';
  if (deepCount > 0 && liteCount > 0) {
    depthLine = `\n\n其中 ${deepCount} 个走了 JD 深度分析,${liteCount} 个是 AI 根据岗位名推断的(标"AI 推断"徽章)。建议你后面对 AI 推断的岗位单独补 JD 重评,结果会更准。`;
  } else if (liteCount > 0) {
    depthLine = `\n\n这次没给 JD,所有 ${liteCount} 个岗位都是 AI 根据岗位名推断的,置信度偏低。强烈建议补 JD 后逐个重评 — 现在的结果只能当作起点参考。`;
  } else if (deepCount > 0) {
    depthLine = `\n\n所有 ${deepCount} 个岗位都走了 JD 深度分析,结果置信度高,可以直接用。`;
  }

  let failedLine = '';
  if (failed.length > 0) {
    const examples = failed.slice(0, 3).map(f => `· ${f.title} — ${f.error || '未知错误'}`).join('\n');
    failedLine = `\n\n失败的 ${failed.length} 个岗位详见右侧列表:\n${examples}${failed.length > 3 ? `\n…(还有 ${failed.length - 3} 个)` : ''}`;
  }

  const next = '\n\n点上方"看职级图谱"就能看到全公司岗位分布。如果对评估结果或 Hay 方法论有疑问,直接问我。';

  return `${head}\n\n${successLine}${depthLine}${failedLine}${next}`;
}

// ============================================================================
// 流式打字 — 跟 SingleEvalView / JeOnboarding / JeEntryView 同款
// (后续应该提取到 src/lib/streamText.ts 共用)
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

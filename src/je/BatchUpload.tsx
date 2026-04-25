/**
 * 批量上传 JD 表 → 启动批量评估 → 实时进度展示。
 *
 * 三种状态：
 *  1. 上传前 (idle) — 拖拽区 + 必填列说明
 *  2. 上传中 (uploading) — 提交 multipart 等后端解析校验
 *  3. 评估中 (running) — 后端开始跑 batch，前端 1.5s 轮询 GET /batches/<id>
 *  4. 完成 (done) — 显示成功/失败统计 + 失败行的报错原因
 *
 * 评估完成后调 onComplete()，父组件刷新岗位列表 + 关闭模态。
 */
import { useEffect, useRef, useState } from 'react';
import { jeCreateBatch, jeGetBatch } from '../api/client';
import type { JeBatch } from '../api/client';

type Stage = 'idle' | 'uploading' | 'running' | 'done' | 'error';

const BRAND = '#D85A30';
const POLL_INTERVAL_MS = 1500;

interface Props {
  onClose: () => void;
  onComplete: () => void;
}

export default function BatchUpload({ onClose, onComplete }: Props) {
  const [stage, setStage] = useState<Stage>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [batch, setBatch] = useState<JeBatch | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<number | null>(null);

  // ---- 上传 + 启动批次 ----
  const handleFile = async (file: File) => {
    setStage('uploading');
    setErrorMsg(null);
    setParseErrors([]);
    try {
      const res = await jeCreateBatch(file);
      setBatchId(res.data.batch_id);
      setParseErrors(res.data.parse_errors || []);
      setStage('running');
    } catch (e: any) {
      const data = e?.response?.data;
      if (data?.error === 'no_valid_rows') {
        setErrorMsg(data.hint || '未识别到有效数据行');
        setParseErrors(data.parse_errors || []);
      } else {
        setErrorMsg(data?.hint || data?.error || '上传失败，请重试');
      }
      setStage('error');
    }
  };

  // ---- 轮询批次进度 ----
  useEffect(() => {
    if (stage !== 'running' || !batchId) return;

    const tick = async () => {
      try {
        const res = await jeGetBatch(batchId);
        const b = res.data.batch;
        setBatch(b);
        if (b.status === 'completed' || b.status === 'failed') {
          setStage('done');
          return;     // 停止轮询
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

  return (
    <div style={modalBackdrop} onClick={stage !== 'running' ? onClose : undefined}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        <div style={modalHeader}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#0F172A' }}>批量上传 JD 表</div>
          {stage !== 'running' && (
            <button onClick={onClose} style={closeBtn}>×</button>
          )}
        </div>

        <div style={{ padding: 24 }}>
          {stage === 'idle' && <IdleView onFileSelected={handleFile} fileInputRef={fileInputRef} />}
          {stage === 'uploading' && <Spinner text="正在解析 Excel…" />}
          {stage === 'running' && batch && <RunningView batch={batch} parseErrors={parseErrors} />}
          {stage === 'running' && !batch && <Spinner text="正在启动评估…" />}
          {stage === 'done' && batch && <DoneView batch={batch} parseErrors={parseErrors} onClose={() => { onComplete(); onClose(); }} />}
          {stage === 'error' && <ErrorView message={errorMsg} parseErrors={parseErrors} onRetry={() => setStage('idle')} />}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function IdleView({ onFileSelected, fileInputRef }: {
  onFileSelected: (f: File) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div>
      <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.7, marginBottom: 16 }}>
        只有<strong>岗位名</strong>是必填的，其他列按字段完备度自动决定评估深度：
        <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
          <li><strong>岗位名 / 职位</strong>（必填）</li>
          <li><strong>JD / 岗位说明书</strong>（推荐）— 给了走深度分析，结果置信度高</li>
          <li>业务职能（可选）— 没给会回落到"通用职能"，岗位名清晰时影响不大</li>
          <li>部门（可选）</li>
        </ul>
        没 JD 的岗位结果会标"AI 推断"，建议后续单独点进去补 JD 重评。
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
          borderRadius: 12, padding: '40px 24px', textAlign: 'center',
          cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        <div style={{ fontSize: 14, color: '#0F172A', marginBottom: 8 }}>
          点击选择文件，或拖拽 Excel 到这里
        </div>
        <div style={{ fontSize: 12, color: '#94A3B8' }}>
          支持 .xlsx 格式，单批建议不超过 200 个岗位
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
    <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748B', fontSize: 13 }}>
      {text}
    </div>
  );
}

function RunningView({ batch, parseErrors }: { batch: JeBatch; parseErrors: string[] }) {
  const pct = Math.round(batch.progress * 100);
  const inProgress = batch.items.filter(i => i.status === 'pending' || i.status === 'running').slice(0, 5);
  return (
    <div>
      <div style={{ fontSize: 13, color: '#0F172A', marginBottom: 12 }}>
        正在评估 <strong>{batch.total}</strong> 个岗位，已完成 <strong>{batch.completed}</strong>，
        失败 <strong style={{ color: batch.failed ? '#DC2626' : '#0F172A' }}>{batch.failed}</strong>
      </div>
      <ProgressBar pct={pct} />
      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 8 }}>
        每个岗位的所有 LLM 调用走同一个模型，跨岗位负载均衡到不同模型 — 这能让单批同时跑得更快、也避免单点故障。
      </div>

      {parseErrors.length > 0 && (
        <div style={{ marginTop: 16, padding: 12, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#92400E', fontWeight: 600, marginBottom: 6 }}>
            {parseErrors.length} 行未进入评估
          </div>
          {parseErrors.slice(0, 5).map((e, i) => (
            <div key={i} style={{ fontSize: 11, color: '#92400E', lineHeight: 1.5 }}>{e}</div>
          ))}
          {parseErrors.length > 5 && <div style={{ fontSize: 11, color: '#92400E' }}>… 还有 {parseErrors.length - 5} 条</div>}
        </div>
      )}

      {inProgress.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>当前评估中：</div>
          {inProgress.map(item => (
            <div key={item.index} style={{ fontSize: 12, color: '#475569', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              · {item.title}
              <span style={{ color: '#94A3B8', fontSize: 11 }}>({item.function})</span>
              {item.has_jd === false && <DepthBadge depth="lite" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DoneView({ batch, parseErrors, onClose }: { batch: JeBatch; parseErrors: string[]; onClose: () => void }) {
  const failed = batch.items.filter(i => i.status === 'failed');
  const succeeded = batch.items.filter(i => i.status === 'done');
  const liteCount = succeeded.filter(i => i.has_jd === false).length;
  const deepCount = succeeded.length - liteCount;

  return (
    <div>
      <div style={{ fontSize: 14, color: '#0F172A', fontWeight: 600, marginBottom: 8 }}>
        评估完成
      </div>
      <div style={{ fontSize: 13, color: '#64748B', marginBottom: 12, lineHeight: 1.7 }}>
        共 {batch.total} 个岗位 · 成功 <strong style={{ color: '#059669' }}>{batch.completed}</strong>
        {batch.failed > 0 && <> · 失败 <strong style={{ color: '#DC2626' }}>{batch.failed}</strong></>}
      </div>
      {liteCount > 0 && (
        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16, padding: '8px 12px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 6 }}>
          <strong>{liteCount}</strong> 个岗位是 AI 根据岗位名推断的（标"AI 推断"徽章），<strong>{deepCount}</strong> 个走了 JD 深度分析。
          建议进入图谱后，对置信度低的岗位补 JD 重新评估。
        </div>
      )}

      {failed.length > 0 && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 12, marginBottom: 16, maxHeight: 240, overflowY: 'auto' }}>
          <div style={{ fontSize: 12, color: '#991B1B', fontWeight: 600, marginBottom: 8 }}>失败列表：</div>
          {failed.map(item => (
            <div key={item.index} style={{ fontSize: 11, color: '#7F1D1D', padding: '4px 0', borderTop: item.index > 0 ? '1px dashed #FECACA' : 'none' }}>
              <strong>{item.title}</strong>（{item.function}）
              <div style={{ color: '#991B1B', marginTop: 2 }}>{item.error || '未知错误'}</div>
            </div>
          ))}
        </div>
      )}

      {parseErrors.length > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#92400E', fontWeight: 600, marginBottom: 6 }}>
            另有 {parseErrors.length} 行未进入评估（解析阶段被跳过）
          </div>
          {parseErrors.slice(0, 3).map((e, i) => (
            <div key={i} style={{ fontSize: 11, color: '#92400E', lineHeight: 1.5 }}>{e}</div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{
          padding: '8px 20px', borderRadius: 8, border: 'none',
          background: BRAND, color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 500,
        }}>查看图谱</button>
      </div>
    </div>
  );
}

function ErrorView({ message, parseErrors, onRetry }: { message: string | null; parseErrors: string[]; onRetry: () => void }) {
  return (
    <div>
      <div style={{ fontSize: 14, color: '#DC2626', fontWeight: 600, marginBottom: 8 }}>
        上传失败
      </div>
      <div style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
        {message || '请稍后再试'}
      </div>
      {parseErrors.length > 0 && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 12, marginBottom: 16, maxHeight: 200, overflowY: 'auto' }}>
          {parseErrors.map((e, i) => (
            <div key={i} style={{ fontSize: 11, color: '#7F1D1D', lineHeight: 1.6 }}>{e}</div>
          ))}
        </div>
      )}
      <button onClick={onRetry} style={{
        padding: '8px 16px', borderRadius: 8, border: '1px solid #E2E8F0',
        background: '#fff', color: '#475569', fontSize: 13, cursor: 'pointer',
      }}>重新上传</button>
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

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div style={{ height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{
        width: `${pct}%`, height: '100%', background: BRAND,
        transition: 'width 0.4s ease',
      }} />
    </div>
  );
}

// ---- 样式 ----
const modalBackdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};

const modalBox: React.CSSProperties = {
  background: '#fff', borderRadius: 12, width: 560, maxWidth: '92vw', maxHeight: '92vh',
  boxShadow: '0 20px 60px rgba(15, 23, 42, 0.2)',
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
};

const modalHeader: React.CSSProperties = {
  padding: '14px 20px', borderBottom: '1px solid #F1F5F9',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};

const closeBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', fontSize: 24, color: '#94A3B8',
  cursor: 'pointer', lineHeight: 1, padding: 0, width: 28, height: 28,
};

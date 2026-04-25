/**
 * 上传现行职级体系 → 跟 AI 评估对比 → 显示差异报告。
 *
 * 三阶段：
 *   1. idle      — 拖拽 / 点选 Excel
 *   2. analyzing — POST /api/je/compare 阻塞等结果（< 5 秒纯本地匹配，不调 LLM）
 *   3. report    — 顶部 summary 数字 + 三段表格（一致 / AI 高 / AI 低）+ 未匹配岗位
 *
 * 报告里每行可点击跳转到对应岗位详情（onJobSelect 回调）。
 *
 * 简化设计:
 * - 只支持 Hay 数字职级格式 (G12 / 12)，P 序列等让用户自己换算
 * - 不做"应用差异 → 把 AI 职级覆盖回去"这种动作 (后续迭代)
 */
import { useRef, useState } from 'react';
import { jeCompare, type JeCompareResult, type JeCompareMatched } from '../api/client';

const BRAND = '#D85A30';
const OK = '#059669';
const WARN_HIGH = '#DC2626';
const WARN_LOW = '#0EA5E9';
const NEUTRAL = '#94A3B8';

type Stage = 'idle' | 'analyzing' | 'report' | 'error';

interface Props {
  onClose: () => void;
  onJobSelect: (jobId: string) => void;
}

export default function CompareLegacyModal({ onClose, onJobSelect }: Props) {
  const [stage, setStage] = useState<Stage>('idle');
  const [report, setReport] = useState<JeCompareResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setStage('analyzing');
    setErrorMsg(null);
    setParseErrors([]);
    try {
      const res = await jeCompare(file);
      setReport(res.data);
      setParseErrors(res.data.parse_errors || []);
      setStage('report');
    } catch (e: any) {
      const data = e?.response?.data;
      setErrorMsg(data?.hint || data?.error || '对比失败');
      setParseErrors(data?.parse_errors || []);
      setStage('error');
    }
  };

  return (
    <div style={modalBackdrop} onClick={stage !== 'analyzing' ? onClose : undefined}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        <div style={modalHeader}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#0F172A' }}>对照现行职级体系</div>
          {stage !== 'analyzing' && (
            <button onClick={onClose} style={closeBtn}>×</button>
          )}
        </div>

        <div style={{ padding: 24, overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {stage === 'idle' && <IdleView onFileSelected={handleFile} fileInputRef={fileInputRef} />}
          {stage === 'analyzing' && <Spinner text="正在跟 AI 评估对比…" />}
          {stage === 'report' && report && (
            <ReportView report={report} parseErrors={parseErrors} onJobSelect={(id) => { onJobSelect(id); onClose(); }} />
          )}
          {stage === 'error' && (
            <ErrorView message={errorMsg} parseErrors={parseErrors} onRetry={() => setStage('idle')} />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 阶段 1：上传引导
// ============================================================================
function IdleView({ onFileSelected, fileInputRef }: {
  onFileSelected: (f: File) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div>
      <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.7, marginBottom: 16 }}>
        上传你们公司当前的职级表，跟 AI 评估结果对比，找出差异。
        <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
          <li><strong>岗位名</strong>（必填）</li>
          <li><strong>当前职级</strong>（必填）— 支持 G12 / 12 / Hay 12 这种含数字格式</li>
          <li>部门（可选）— 提高匹配精度</li>
        </ul>
        <div style={{ padding: '8px 12px', background: '#FEF3C7', borderRadius: 6, fontSize: 12, marginTop: 8 }}>
          ⚠️ 如果你们用 P 序列 / M 序列（如 P5），需要先在 Excel 里换算成 Hay 数字职级（如 G14）。
          后续会支持体系映射配置。
        </div>
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
          borderRadius: 12, padding: '32px 24px', textAlign: 'center',
          cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        <div style={{ fontSize: 14, color: '#0F172A', marginBottom: 6 }}>
          点击选择文件，或拖拽 Excel 到这里
        </div>
        <div style={{ fontSize: 11, color: '#94A3B8' }}>支持 .xlsx 格式</div>
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

// ============================================================================
// 阶段 3：差异报告
// ============================================================================
function ReportView({ report, parseErrors, onJobSelect }: {
  report: JeCompareResult;
  parseErrors: string[];
  onJobSelect: (jobId: string) => void;
}) {
  const [filter, setFilter] = useState<'all' | 'aligned' | 'ai_higher' | 'ai_lower' | 'parse_failed'>('all');

  const filtered = report.matched.filter(m => filter === 'all' || m.status === filter);
  // 按 |gap| 降序，差异大的排前面
  const sorted = [...filtered].sort((a, b) => Math.abs(b.gap ?? 0) - Math.abs(a.gap ?? 0));

  return (
    <div>
      {/* 顶部 summary */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12,
        marginBottom: 16, padding: 14,
        background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
      }}>
        <SummaryStat label="对比总数" value={report.summary.matched_count} />
        <SummaryStat label="对齐 (差距 ≤ 1)" value={report.summary.aligned} color={OK} />
        <SummaryStat label="AI 高 ≥ 2 级" value={report.summary.ai_higher} color={WARN_HIGH} />
        <SummaryStat label="AI 低 ≥ 2 级" value={report.summary.ai_lower} color={WARN_LOW} />
        <SummaryStat label="解析失败" value={report.summary.parse_failed} color={NEUTRAL} />
      </div>

      {/* 过滤 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {(['all', 'aligned', 'ai_higher', 'ai_lower', 'parse_failed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '4px 10px', fontSize: 11, borderRadius: 4,
            background: filter === f ? '#FEF7F4' : '#fff',
            color: filter === f ? BRAND : '#64748B',
            border: `1px solid ${filter === f ? BRAND : '#E2E8F0'}`,
            cursor: 'pointer', fontWeight: filter === f ? 600 : 400,
          }}>
            {f === 'all' ? '全部' : f === 'aligned' ? '对齐' : f === 'ai_higher' ? 'AI 高' : f === 'ai_lower' ? 'AI 低' : '解析失败'}
          </button>
        ))}
      </div>

      {/* 匹配表 */}
      {sorted.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
          当前过滤条件下没有数据
        </div>
      ) : (
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden',
          marginBottom: 16,
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ background: '#FAFBFC', position: 'sticky', top: 0 }}>
              <tr>
                <Th>岗位</Th>
                <Th>部门</Th>
                <Th>现职级</Th>
                <Th>AI 职级</Th>
                <Th>差距</Th>
                <Th>匹配方式</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m, i) => (
                <CompareRow key={i} item={m} onJobSelect={onJobSelect} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 未匹配的现行体系岗位 */}
      {report.unmatched_legacy.length > 0 && (
        <UnmatchedSection
          title={`你列出但 AI 还没评估的 (${report.unmatched_legacy.length})`}
          hint="建议把这些岗位也评估一下，再回来对比"
          rows={report.unmatched_legacy.map(r => ({
            title: r.title, dept: r.department, grade: r.raw_grade || (r.current_grade != null ? `G${r.current_grade}` : '—'),
          }))}
        />
      )}

      {/* 未匹配的 AI 岗位 */}
      {report.unmatched_ai.length > 0 && (
        <UnmatchedSection
          title={`AI 评了但你没列的 (${report.unmatched_ai.length})`}
          hint="可能是 AI 推荐的标准岗位你们公司其实没有，或者岗位名不一致"
          rows={report.unmatched_ai.map(r => ({
            title: r.title, dept: r.department, grade: r.ai_grade != null ? `G${r.ai_grade}` : '—',
            jobId: r.job_id,
          }))}
          onClick={(jobId) => jobId && onJobSelect(jobId)}
        />
      )}

      {parseErrors.length > 0 && (
        <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 12, color: '#92400E', fontWeight: 600, marginBottom: 6 }}>
            另有 {parseErrors.length} 条解析问题
          </div>
          {parseErrors.slice(0, 5).map((e, i) => (
            <div key={i} style={{ fontSize: 11, color: '#92400E', lineHeight: 1.5 }}>{e}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function CompareRow({ item, onJobSelect }: { item: JeCompareMatched; onJobSelect: (jobId: string) => void }) {
  const statusColor = item.status === 'aligned' ? OK
    : item.status === 'ai_higher' ? WARN_HIGH
    : item.status === 'ai_lower' ? WARN_LOW
    : NEUTRAL;
  const statusLabel = item.status === 'aligned' ? `对齐${item.gap !== null ? ` ${item.gap >= 0 ? '+' : ''}${item.gap}` : ''}`
    : item.status === 'ai_higher' ? `AI 高 +${item.gap}`
    : item.status === 'ai_lower' ? `AI 低 ${item.gap}`
    : '解析失败';

  return (
    <tr style={{ borderTop: '1px solid #F1F5F9' }}>
      <Td>
        <button onClick={() => onJobSelect(item.job_id)} style={{
          background: 'transparent', border: 'none', padding: 0,
          color: BRAND, cursor: 'pointer', textDecoration: 'underline',
          fontSize: 12, fontFamily: 'inherit', textAlign: 'left',
        }}>
          {item.title}
        </button>
        {item.title !== item.job_title && (
          <div style={{ fontSize: 10, color: '#94A3B8' }}>AI: {item.job_title}</div>
        )}
      </Td>
      <Td>{item.department || '—'}</Td>
      <Td>{item.current_grade != null ? `G${item.current_grade}` : <span style={{ color: '#DC2626' }}>{item.raw_grade}</span>}</Td>
      <Td>{item.ai_grade != null ? `G${item.ai_grade}` : '—'}</Td>
      <Td>
        <span style={{
          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
          color: statusColor,
          background: item.status === 'aligned' ? '#D1FAE5'
            : item.status === 'ai_higher' ? '#FEE2E2'
            : item.status === 'ai_lower' ? '#E0F2FE'
            : '#F1F5F9',
        }}>
          {statusLabel}
        </span>
      </Td>
      <Td>
        <span style={{ fontSize: 10, color: '#94A3B8' }}>
          {item.match_strategy === 'dept+title' ? '精确' : item.match_strategy === 'title' ? '同名' : '模糊'}
        </span>
      </Td>
    </tr>
  );
}

function UnmatchedSection({ title, hint, rows, onClick }: {
  title: string;
  hint: string;
  rows: Array<{ title: string; dept: string | null; grade: string; jobId?: string }>;
  onClick?: (jobId?: string) => void;
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
      marginBottom: 12, overflow: 'hidden',
    }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #F1F5F9' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{title}</div>
        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{hint}</div>
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}
                onClick={() => onClick?.(r.jobId)}
                style={{
                  borderTop: '1px solid #F1F5F9',
                  cursor: r.jobId ? 'pointer' : 'default',
                }}
              >
                <Td>{r.title}</Td>
                <Td>{r.dept || '—'}</Td>
                <Td>{r.grade}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || '#0F172A' }}>{value}</div>
    </div>
  );
}

function ErrorView({ message, parseErrors, onRetry }: {
  message: string | null;
  parseErrors: string[];
  onRetry: () => void;
}) {
  return (
    <div>
      <div style={{ fontSize: 14, color: '#DC2626', fontWeight: 600, marginBottom: 8 }}>对比失败</div>
      <div style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>{message || '请稍后重试'}</div>
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
      }}>
        重新上传
      </button>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: '#64748B' }}>{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>{children}</td>;
}

const modalBackdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};

const modalBox: React.CSSProperties = {
  background: '#fff', borderRadius: 12,
  width: 880, maxWidth: '95vw', maxHeight: '90vh',
  boxShadow: '0 20px 60px rgba(15,23,42,0.2)',
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
};

const modalHeader: React.CSSProperties = {
  padding: '14px 20px', borderBottom: '1px solid #F1F5F9',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  flexShrink: 0,
};

const closeBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', fontSize: 24, color: '#94A3B8',
  cursor: 'pointer', lineHeight: 1, padding: 0, width: 28, height: 28,
};

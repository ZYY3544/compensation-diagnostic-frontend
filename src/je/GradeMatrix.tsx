/**
 * 职级图谱主视图（v3 左右两栏布局）。
 *
 * v3 相比 v2 的关键变化：
 *  - 改成左右两栏：左 Sparky 对话（固定宽度 380）+ 右工作台（flex），
 *    跟主诊断的"左对话 + 右工作台"范式一致
 *  - 左侧 chat 占满高度，输入框沉底，对话历史向上滚
 *  - 右侧工作台分三段：异常告警 → 标题栏 → 矩阵/列表
 *
 * 状态切换：
 *  - 完全空 / 仍在评估 → 整页只有左 chat（右侧给空态引导）
 *  - 1-4 个岗位 → 右侧用卡片列表（密度低，空格不刺眼）
 *  - ≥ 5 个岗位 → 右侧用矩阵（X 部门/职能、Y 职级）
 */
import { useMemo, useState } from 'react';
import type { JeJob, JeAnomaly } from '../api/client';
import JeSparkyChat from './JeSparkyChat';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

const KH_COLOR = '#4F46E5';
const PS_COLOR = '#0EA5E9';
const ACC_COLOR = '#F59E0B';
const NEUTRAL = '#94A3B8';

const SPARSE_THRESHOLD = 10;
const MATRIX_MIN_JOBS = 5;
const CHAT_WIDTH = 380;

interface Props {
  jobs: JeJob[];
  anomalies: JeAnomaly[];
  onJobSelect: (jobId: string) => void;
  onBatchUpload: () => void;
  onSingleEval: () => void;
  onPersonJobMatch: () => void;
  selectedJobId?: string | null;
}

type AxisMode = 'department' | 'function';

export default function GradeMatrix({
  jobs, anomalies, onJobSelect, onBatchUpload, onSingleEval, onPersonJobMatch, selectedJobId,
}: Props) {
  const [axisMode, setAxisMode] = useState<AxisMode>('department');

  const evaluated = useMemo(
    () => jobs.filter(j => j.result?.job_grade != null),
    [jobs],
  );

  const handleJobByTitle = (title: string) => {
    const j = jobs.find(x => x.title === title);
    if (j) onJobSelect(j.id);
  };

  const useMatrix = evaluated.length >= MATRIX_MIN_JOBS;

  return (
    <div style={{
      display: 'flex', height: '100%',
      background: '#FAFAFA',
    }}>
      {/* ---- 左：Sparky 对话区 ---- */}
      <div style={{
        width: CHAT_WIDTH, flexShrink: 0,
        borderRight: '1px solid #E2E8F0', background: '#fff',
        display: 'flex', flexDirection: 'column',
        height: '100%', overflow: 'hidden',
      }}>
        <JeSparkyChat
          jobs={jobs}
          anomalies={anomalies}
          onBatchUpload={onBatchUpload}
          onSingleEval={onSingleEval}
          onPersonJobMatch={onPersonJobMatch}
          onJobByTitle={handleJobByTitle}
        />
      </div>

      {/* ---- 右：工作台 ---- */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 32px' }}>
        {jobs.length === 0 ? (
          <RightEmptyHint onBatchUpload={onBatchUpload} onSingleEval={onSingleEval} />
        ) : evaluated.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
            正在评估岗位…评估完成后这里会显示职级分布
          </div>
        ) : (
          <>
            {anomalies.length > 0 && <AnomalyBar anomalies={anomalies} onJobSelect={onJobSelect} />}

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>
                {useMatrix ? '职级图谱' : '岗位列表'}
                <span style={{ marginLeft: 8, fontSize: 11, color: '#94A3B8', fontWeight: 400 }}>
                  {evaluated.length} 个
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {useMatrix && <AxisToggle mode={axisMode} onChange={setAxisMode} />}
                <button onClick={onBatchUpload} style={primaryBtn}>批量上传</button>
              </div>
            </div>

            {useMatrix
              ? <Matrix evaluated={evaluated} axisMode={axisMode} selectedJobId={selectedJobId} onJobSelect={onJobSelect} />
              : <CardList evaluated={evaluated} selectedJobId={selectedJobId} onJobSelect={onJobSelect} />
            }

            {evaluated.length < SPARSE_THRESHOLD && (
              <div style={{
                marginTop: 12, fontSize: 11, color: '#94A3B8', textAlign: 'center',
              }}>
                已评估 {evaluated.length} / 建议 {SPARSE_THRESHOLD} 个 — 数据更多时图谱才能反映完整组织结构
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 右侧空态引导（左侧 chat 已经够引导了，这里只是个简短补充）
// ============================================================================
function RightEmptyHint({ onBatchUpload, onSingleEval }: {
  onBatchUpload: () => void;
  onSingleEval: () => void;
}) {
  return (
    <div style={{ padding: '60px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 14, color: '#475569', fontWeight: 500, marginBottom: 8 }}>
        还没有岗位
      </div>
      <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 24, lineHeight: 1.7 }}>
        在左边的 Sparky 那里说"批量上传"或"评一个岗位"开始
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button onClick={onSingleEval} style={ghostBtn}>+ 单个评估</button>
        <button onClick={onBatchUpload} style={primaryBtn}>批量上传</button>
      </div>
    </div>
  );
}

// ============================================================================
// 卡片列表（岗位 < 5 时用）
// ============================================================================
function CardList({ evaluated, selectedJobId, onJobSelect }: {
  evaluated: JeJob[];
  selectedJobId?: string | null;
  onJobSelect: (id: string) => void;
}) {
  const byDept: Record<string, JeJob[]> = {};
  evaluated.forEach(j => {
    const dept = j.department || '未分组';
    (byDept[dept] ||= []).push(j);
  });

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }}>
      {Object.entries(byDept).map(([dept, items]) => (
        <div key={dept} style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 11, color: '#94A3B8', fontWeight: 500,
            paddingBottom: 6, marginBottom: 8, borderBottom: '1px dashed #F1F5F9',
          }}>
            {dept} · {items.length}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {items.map(j => <JobCard key={j.id} job={j} selected={j.id === selectedJobId} onClick={() => onJobSelect(j.id)} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function JobCard({ job, selected, onClick }: { job: JeJob; selected: boolean; onClick: () => void }) {
  const dom = pickDominant(job);
  const grade = job.result?.job_grade;
  const total = job.result?.total_score;

  return (
    <div onClick={onClick} style={{
      padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
      background: selected ? BRAND_TINT : '#fff',
      border: `1px solid ${selected ? BRAND : '#E2E8F0'}`,
      borderLeft: `3px solid ${dom.color}`,
      transition: 'all 0.12s',
    }}
      onMouseOver={e => { if (!selected) e.currentTarget.style.background = '#FAFAFA'; }}
      onMouseOut={e => { if (!selected) e.currentTarget.style.background = '#fff'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: 13, color: '#0F172A', fontWeight: selected ? 600 : 500 }}>
          {job.title}
        </div>
        {grade != null && (
          <div style={{ fontSize: 13, color: BRAND, fontWeight: 700 }}>G{grade}</div>
        )}
      </div>
      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
        {dom.label} 主导{total != null && ` · ${total} 分`}
      </div>
    </div>
  );
}

// ============================================================================
// 矩阵（岗位 ≥ 5 时用）
// ============================================================================
function Matrix({ evaluated, axisMode, selectedJobId, onJobSelect }: {
  evaluated: JeJob[];
  axisMode: AxisMode;
  selectedJobId?: string | null;
  onJobSelect: (id: string) => void;
}) {
  const labelKey = axisMode === 'department'
    ? (j: JeJob) => j.department || '未分组'
    : (j: JeJob) => j.function || '未知';

  const labels = new Set<string>();
  let minG = Infinity, maxG = -Infinity;
  const cells: Record<string, JeJob[]> = {};

  for (const j of evaluated) {
    const grade = j.result!.job_grade!;
    const lab = labelKey(j);
    labels.add(lab);
    minG = Math.min(minG, grade);
    maxG = Math.max(maxG, grade);
    const k = `${lab}::${grade}`;
    (cells[k] ||= []).push(j);
  }

  const axisLabels = Array.from(labels).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const grades: number[] = [];
  for (let g = maxG; g >= minG; g--) grades.push(g);

  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: 16, overflowX: 'auto',
    }}>
      <table style={{
        borderCollapse: 'separate', borderSpacing: 0,
        width: '100%', minWidth: axisLabels.length * 160 + 60,
      }}>
        <thead>
          <tr>
            <th style={{ ...thBase, width: 50, textAlign: 'right', paddingRight: 12 }} />
            {axisLabels.map(lab => (
              <th key={lab} style={thBase}>{lab}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grades.map(g => (
            <tr key={g}>
              <td style={gradeColStyle}>G{g}</td>
              {axisLabels.map(lab => {
                const k = `${lab}::${g}`;
                const cellJobs = cells[k] || [];
                return (
                  <td key={lab} style={cellTdStyle}>
                    {cellJobs.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {cellJobs.map(j => (
                          <CellCard key={j.id} job={j} selected={j.id === selectedJobId} onClick={() => onJobSelect(j.id)} />
                        ))}
                      </div>
                    ) : (
                      <div style={{ minHeight: 36 }} />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CellCard({ job, selected, onClick }: { job: JeJob; selected: boolean; onClick: () => void }) {
  const dom = pickDominant(job);
  const total = job.result?.total_score;

  return (
    <div onClick={onClick}
      title={`${job.title} · ${dom.label} 主导 · ${total ?? '—'} 分`}
      style={{
        padding: '6px 8px',
        background: selected ? BRAND_TINT : '#fff',
        border: `1px solid ${selected ? BRAND : '#E2E8F0'}`,
        borderLeft: `3px solid ${dom.color}`,
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 12, color: '#0F172A',
        fontWeight: selected ? 600 : 400,
      }}
      onMouseOver={e => { if (!selected) e.currentTarget.style.background = '#FAFAFA'; }}
      onMouseOut={e => { if (!selected) e.currentTarget.style.background = '#fff'; }}
    >
      <div>{job.title}</div>
    </div>
  );
}

function pickDominant(job: JeJob): { color: string; label: string } {
  const kh = job.result?.kh_score || 0;
  const ps = job.result?.ps_score || 0;
  const acc = job.result?.acc_score || 0;
  const total = kh + ps + acc;
  if (total === 0) return { color: NEUTRAL, label: '—' };
  const max = Math.max(kh, ps, acc);
  if (max === kh) return { color: KH_COLOR, label: 'KH' };
  if (max === ps) return { color: PS_COLOR, label: 'PS' };
  return { color: ACC_COLOR, label: 'ACC' };
}

// ============================================================================
// 异常告警条
// ============================================================================
function AnomalyBar({ anomalies, onJobSelect }: { anomalies: JeAnomaly[]; onJobSelect: (id: string) => void }) {
  const high = anomalies.filter(a => a.severity === 'high').length;
  const [expanded, setExpanded] = useState(high > 0);
  const medium = anomalies.filter(a => a.severity === 'medium').length;
  const low = anomalies.filter(a => a.severity === 'low').length;

  return (
    <div style={{
      background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10,
      padding: '10px 14px', marginBottom: 12,
    }}>
      <div onClick={() => setExpanded(e => !e)} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
      }}>
        <div style={{ fontSize: 12, color: '#0F172A' }}>
          检测到 <strong>{anomalies.length}</strong> 个异常
          <span style={{ marginLeft: 10, fontSize: 11, color: '#64748B' }}>
            {high > 0 && <span style={{ color: '#DC2626', marginRight: 6 }}>高 {high}</span>}
            {medium > 0 && <span style={{ color: '#D97706', marginRight: 6 }}>中 {medium}</span>}
            {low > 0 && <span style={{ color: '#94A3B8' }}>低 {low}</span>}
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#64748B' }}>{expanded ? '收起' : '展开'}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: 10, borderTop: '1px solid #FED7AA', paddingTop: 10 }}>
          {anomalies.map((a, i) => (
            <div key={i} style={{
              fontSize: 12, padding: '6px 0',
              borderBottom: i < anomalies.length - 1 ? '1px dashed #FED7AA' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: a.severity === 'high' ? '#DC2626'
                    : a.severity === 'medium' ? '#D97706' : '#94A3B8',
                  display: 'inline-block',
                }} />
                <strong style={{ color: '#0F172A' }}>{a.title}</strong>
              </div>
              <div style={{ color: '#64748B', marginLeft: 14 }}>{a.message}</div>
              {a.evidence.length > 0 && (
                <div style={{ marginTop: 4, marginLeft: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {a.evidence.map(jobId => (
                    <button key={jobId} onClick={() => onJobSelect(jobId)} style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 3,
                      border: '1px solid #FED7AA', background: '#fff', color: BRAND, cursor: 'pointer',
                    }}>
                      查看
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 共享小组件 + 样式
// ============================================================================
function AxisToggle({ mode, onChange }: { mode: AxisMode; onChange: (m: AxisMode) => void }) {
  return (
    <div style={{ display: 'inline-flex', background: '#F1F5F9', borderRadius: 6, padding: 2 }}>
      {(['department', 'function'] as const).map(m => (
        <button key={m} onClick={() => onChange(m)} style={{
          padding: '4px 10px', fontSize: 11, border: 'none', cursor: 'pointer', borderRadius: 4,
          background: mode === m ? '#fff' : 'transparent',
          color: mode === m ? '#0F172A' : '#64748B',
          fontWeight: mode === m ? 600 : 400,
        }}>
          {m === 'department' ? '按部门' : '按职能'}
        </button>
      ))}
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 6, border: 'none',
  background: BRAND, color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 500,
};

const ghostBtn: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 6, border: '1px solid #E2E8F0',
  background: '#fff', color: '#475569', fontSize: 12, cursor: 'pointer',
};

const thBase: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, color: '#64748B',
  padding: '6px 6px', textAlign: 'left',
  borderBottom: '1px solid #E2E8F0',
};

const gradeColStyle: React.CSSProperties = {
  fontSize: 11, fontFamily: 'ui-monospace, monospace',
  textAlign: 'right', paddingRight: 12, paddingTop: 6, paddingBottom: 6,
  borderRight: '1px solid #F1F5F9', verticalAlign: 'top',
  color: '#64748B',
};

const cellTdStyle: React.CSSProperties = {
  padding: 5, verticalAlign: 'top', minWidth: 140,
  borderBottom: '1px dashed #F1F5F9',
};

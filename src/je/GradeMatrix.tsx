/**
 * 职级图谱主视图。
 *
 * 架构：
 *  - X 轴：部门 / 职能（可切换）
 *  - Y 轴：Hay 职级（按当前数据动态计算 [min, max]）
 *  - 单元格：该 X×Y 下的所有岗位卡片，颜色按 KH/PS/ACC 主导成分编码
 *  - 顶部：异常告警条（高/中/低三档颜色）
 *  - 稀疏提示（< 10 岗位）：提示用户继续添加岗位以获得完整图谱分析
 *
 * 职责边界：本组件只做"展示 + 让用户选岗位"，不直接调评估、不持久化。
 *  - 父组件传 jobs / anomalies
 *  - 用户点岗位卡 → onJobSelect(id)
 *  - 用户点"上传 / 单评" → onBatchUpload / onSingleEval（父组件接管模态）
 */
import { useMemo, useState } from 'react';
import type { JeJob, JeAnomaly } from '../api/client';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

// 主导成分配色：跟主诊断模块的语义保持一致
const KH_COLOR = '#4F46E5';   // 蓝紫，专家路线
const PS_COLOR = '#0EA5E9';   // 浅蓝，策略路线
const ACC_COLOR = '#F59E0B';  // 橙色，管理路线
const NEUTRAL = '#94A3B8';

const SPARSE_THRESHOLD = 10;

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
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  // 只统计已评估完成的岗位（result.job_grade 有值）
  const evaluated = useMemo(
    () => jobs.filter(j => j.result?.job_grade != null),
    [jobs],
  );

  // 维度切换需要的轴标签 + 职级范围
  const { axisLabels, gradeRange, cellMap } = useMemo(() => {
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

    // 留 1 级 padding 让矩阵不那么贴边
    const range = isFinite(minG) ? { min: Math.max(1, minG - 1), max: maxG + 1 } : { min: 8, max: 18 };
    return {
      axisLabels: Array.from(labels).sort((a, b) => a.localeCompare(b, 'zh-CN')),
      gradeRange: range,
      cellMap: cells,
    };
  }, [evaluated, axisMode]);

  // 完全空 → 居中引导卡（HR 还没录任何岗位）
  if (jobs.length === 0) {
    return <EmptyState onBatchUpload={onBatchUpload} onSingleEval={onSingleEval} />;
  }

  // 已经有岗位但还没任何一个评估完成 → 给个等待提示
  if (evaluated.length === 0) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center', color: '#64748B' }}>
        <div style={{ fontSize: 14, marginBottom: 8 }}>正在评估岗位…</div>
        <div style={{ fontSize: 12 }}>评估完成后这里会显示职级图谱</div>
      </div>
    );
  }

  const sparse = evaluated.length < SPARSE_THRESHOLD;
  const grades: number[] = [];
  for (let g = gradeRange.max; g >= gradeRange.min; g--) grades.push(g);

  return (
    <div style={{ padding: '0 24px 32px', maxWidth: '100%' }}>
      {/* ---- 顶部工具条 ---- */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 0',
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
            职级图谱
          </div>
          <div style={{ fontSize: 12, color: '#64748B' }}>
            {evaluated.length} 个岗位 · 职级 G{gradeRange.min + 1} – G{gradeRange.max - 1}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <AxisToggle mode={axisMode} onChange={setAxisMode} />
          <button onClick={onPersonJobMatch} style={ghostBtn}>人岗匹配</button>
          <button onClick={onSingleEval} style={ghostBtn}>+ 单个评估</button>
          <button onClick={onBatchUpload} style={primaryBtn}>批量上传</button>
        </div>
      </div>

      {/* ---- 异常告警条 ---- */}
      {anomalies.length > 0 && <AnomalyBar anomalies={anomalies} onJobSelect={onJobSelect} />}

      {/* ---- 矩阵 ---- */}
      <div style={{
        background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
        padding: 16, overflowX: 'auto',
      }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: axisLabels.length * 160 + 80 }}>
          <thead>
            <tr>
              <th style={{ ...thBase, width: 60, textAlign: 'right', paddingRight: 12 }}>职级</th>
              {axisLabels.map(lab => (
                <th key={lab} style={thBase}>{lab}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grades.map(g => (
              <tr key={g}>
                <td style={{ ...gradeColStyle, color: g % 5 === 0 ? '#0F172A' : '#94A3B8' }}>
                  G{g}
                </td>
                {axisLabels.map(lab => {
                  const k = `${lab}::${g}`;
                  const cellJobs = cellMap[k] || [];
                  const cellId = `${lab}_${g}`;
                  return (
                    <td key={lab} style={cellTdStyle}
                      onMouseEnter={() => setHoveredCell(cellId)}
                      onMouseLeave={() => setHoveredCell(null)}>
                      <Cell
                        jobs={cellJobs}
                        selectedJobId={selectedJobId}
                        highlighted={hoveredCell === cellId}
                        onJobSelect={onJobSelect}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---- 稀疏提示 ---- */}
      {sparse && (
        <SparseHint
          current={evaluated.length}
          threshold={SPARSE_THRESHOLD}
          onBatchUpload={onBatchUpload}
          onSingleEval={onSingleEval}
        />
      )}

      {/* ---- 配色图例 ---- */}
      <div style={{ marginTop: 16, fontSize: 11, color: '#64748B', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Legend color={KH_COLOR} label="Know-How 主导（专家路线）" />
        <Legend color={PS_COLOR} label="Problem Solving 主导（策略路线）" />
        <Legend color={ACC_COLOR} label="Accountability 主导（管理路线）" />
      </div>
    </div>
  );
}

// ============================================================================
// 子组件
// ============================================================================

function AxisToggle({ mode, onChange }: { mode: AxisMode; onChange: (m: AxisMode) => void }) {
  return (
    <div style={{ display: 'inline-flex', background: '#F1F5F9', borderRadius: 8, padding: 2 }}>
      {(['department', 'function'] as const).map(m => (
        <button key={m} onClick={() => onChange(m)} style={{
          padding: '6px 12px', fontSize: 12, border: 'none', cursor: 'pointer',
          borderRadius: 6,
          background: mode === m ? '#fff' : 'transparent',
          color: mode === m ? '#0F172A' : '#64748B',
          fontWeight: mode === m ? 600 : 400,
          boxShadow: mode === m ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
        }}>
          {m === 'department' ? '按部门' : '按职能'}
        </button>
      ))}
    </div>
  );
}

function AnomalyBar({ anomalies, onJobSelect }: { anomalies: JeAnomaly[]; onJobSelect: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const high = anomalies.filter(a => a.severity === 'high').length;
  const medium = anomalies.filter(a => a.severity === 'medium').length;
  const low = anomalies.filter(a => a.severity === 'low').length;

  return (
    <div style={{
      background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10,
      padding: '12px 16px', marginBottom: 16,
    }}>
      <div onClick={() => setExpanded(e => !e)} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
      }}>
        <div style={{ fontSize: 13, color: '#0F172A' }}>
          <strong>检测到 {anomalies.length} 个异常</strong>
          <span style={{ marginLeft: 12, color: '#64748B', fontSize: 12 }}>
            {high > 0 && <span style={{ color: '#DC2626', marginRight: 8 }}>高 {high}</span>}
            {medium > 0 && <span style={{ color: '#D97706', marginRight: 8 }}>中 {medium}</span>}
            {low > 0 && <span style={{ color: '#94A3B8' }}>低 {low}</span>}
          </span>
        </div>
        <span style={{ fontSize: 12, color: '#64748B' }}>{expanded ? '收起' : '展开'}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: 12, borderTop: '1px solid #FED7AA', paddingTop: 12 }}>
          {anomalies.map((a, i) => (
            <div key={i} style={{
              fontSize: 12, padding: '8px 0', borderBottom: i < anomalies.length - 1 ? '1px dashed #FED7AA' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <SeverityDot severity={a.severity} />
                <strong style={{ color: '#0F172A' }}>{a.title}</strong>
              </div>
              <div style={{ color: '#64748B', marginLeft: 16 }}>{a.message}</div>
              {a.evidence.length > 0 && (
                <div style={{ marginTop: 4, marginLeft: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {a.evidence.map(jobId => (
                    <button key={jobId} onClick={() => onJobSelect(jobId)} style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid #FED7AA',
                      background: '#fff', color: BRAND, cursor: 'pointer',
                    }}>
                      查看岗位
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

function SeverityDot({ severity }: { severity: 'high' | 'medium' | 'low' }) {
  const color = severity === 'high' ? '#DC2626' : severity === 'medium' ? '#D97706' : '#94A3B8';
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />;
}

function Cell({ jobs, selectedJobId, highlighted, onJobSelect }: {
  jobs: JeJob[];
  selectedJobId?: string | null;
  highlighted: boolean;
  onJobSelect: (id: string) => void;
}) {
  if (jobs.length === 0) {
    return <div style={{
      minHeight: 48,
      background: highlighted ? '#FAFAFA' : 'transparent',
      borderRadius: 6,
    }} />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {jobs.map(j => {
        const dominant = pickDominant(j);
        const isSelected = j.id === selectedJobId;
        return (
          <div key={j.id} onClick={() => onJobSelect(j.id)} style={{
            padding: '6px 8px',
            background: isSelected ? BRAND_TINT : '#fff',
            border: `1px solid ${isSelected ? BRAND : '#E2E8F0'}`,
            borderLeft: `3px solid ${dominant.color}`,
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 12,
            color: '#0F172A',
            fontWeight: isSelected ? 600 : 400,
            transition: 'all 0.12s',
          }}
            onMouseOver={e => {
              if (!isSelected) e.currentTarget.style.background = '#FAFAFA';
            }}
            onMouseOut={e => {
              if (!isSelected) e.currentTarget.style.background = '#fff';
            }}
          >
            <div>{j.title}</div>
            <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
              {dominant.label} · {j.result?.total_score ?? '—'} 分
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 判断岗位的主导成分（KH/PS/ACC 谁占比最高）。total_score 为 0 时降级为 NEUTRAL。 */
function pickDominant(job: JeJob): { color: string; label: string } {
  const kh = job.result?.kh_score || 0;
  const ps = job.result?.ps_score || 0;
  const acc = job.result?.acc_score || 0;
  const total = kh + ps + acc;
  if (total === 0) return { color: NEUTRAL, label: '未评估' };
  const max = Math.max(kh, ps, acc);
  if (max === kh) return { color: KH_COLOR, label: 'KH' };
  if (max === ps) return { color: PS_COLOR, label: 'PS' };
  return { color: ACC_COLOR, label: 'ACC' };
}

function SparseHint({ current, threshold, onBatchUpload, onSingleEval }: {
  current: number; threshold: number;
  onBatchUpload: () => void; onSingleEval: () => void;
}) {
  return (
    <div style={{
      marginTop: 16, padding: '14px 16px',
      background: BRAND_TINT, border: `1px dashed ${BRAND}`, borderRadius: 10,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
    }}>
      <div style={{ fontSize: 13, color: '#0F172A', lineHeight: 1.6 }}>
        已评估 {current} 个岗位，建议达到 {threshold} 个以上才能看到完整的职级图谱分析。
        <span style={{ color: '#64748B', fontSize: 12, display: 'block', marginTop: 2 }}>
          数据少时跨部门对比、职级分布、异常检测的可信度都会偏低。
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={onSingleEval} style={ghostBtn}>再评一个</button>
        <button onClick={onBatchUpload} style={primaryBtn}>继续上传</button>
      </div>
    </div>
  );
}

function EmptyState({ onBatchUpload, onSingleEval }: { onBatchUpload: () => void; onSingleEval: () => void }) {
  return (
    <div style={{ maxWidth: 520, margin: '80px auto', textAlign: 'center', padding: 24 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
        岗位价值评估
      </div>
      <div style={{ fontSize: 13, color: '#64748B', marginBottom: 28, lineHeight: 1.7 }}>
        基于 Hay 体系评估岗位价值，输出 8 因子档位、三维子分、Hay 标准职级。
        批量上传后会自动生成全公司职级图谱，识别倒挂、膨胀、断层等异常。
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button onClick={onBatchUpload} style={{ ...primaryBtn, padding: '10px 24px', fontSize: 14 }}>
          批量上传 JD 表
        </button>
        <button onClick={onSingleEval} style={{ ...ghostBtn, padding: '10px 24px', fontSize: 14 }}>
          单个岗位评估
        </button>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 12, height: 4, background: color, borderRadius: 2 }} />
      {label}
    </span>
  );
}

// ---- 共享样式 ----
const primaryBtn: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8, border: 'none',
  background: BRAND, color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 500,
};

const ghostBtn: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8, border: '1px solid #E2E8F0',
  background: '#fff', color: '#475569', fontSize: 13, cursor: 'pointer',
};

const thBase: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: '#64748B',
  padding: '8px 6px', textAlign: 'left', borderBottom: '1px solid #E2E8F0',
};

const gradeColStyle: React.CSSProperties = {
  fontSize: 11, fontFamily: 'ui-monospace, monospace',
  textAlign: 'right', paddingRight: 12, paddingTop: 8, paddingBottom: 8,
  borderRight: '1px solid #F1F5F9', verticalAlign: 'top',
};

const cellTdStyle: React.CSSProperties = {
  padding: 6, verticalAlign: 'top', minWidth: 140,
  borderRight: '1px dashed #F1F5F9',
  borderBottom: '1px dashed #F1F5F9',
};

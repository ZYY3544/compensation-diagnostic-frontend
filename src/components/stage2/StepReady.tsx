import type { ParseResult } from '../../types';

interface StepReadyProps {
  onStart: () => void;
  onStepClick: (step: number) => void;
  onReupload: () => void;
  parseResult?: ParseResult | null;
  interviewNotes?: any;
}

// Mock fallback modules
const mockModules: { name: string; available: boolean; reason?: string }[] = [
  { name: '外部竞争力分析', available: true },
  { name: '内部公平性分析', available: true },
  { name: '薪酬固浮比分析', available: true },
  { name: '绩效关联分析', available: false, reason: '缺少绩效字段' },
  { name: '人工成本趋势分析', available: false, reason: '缺少公司经营数据' },
];

export default function StepReady({ onStart, onStepClick, onReupload, parseResult, interviewNotes }: StepReadyProps) {
  // Build modules list from parseResult if available
  const modules: { name: string; available: boolean; reason?: string }[] = parseResult
    ? [
        ...parseResult.unlocked_modules.map(name => ({ name, available: true })),
        ...parseResult.locked_modules.map(m => ({ name: m.name, available: false, reason: m.reason })),
      ]
    : mockModules;

  const completenessScore = parseResult?.data_completeness_score ?? 78;
  const rowMissingCount = parseResult?.completeness_issues?.row_missing?.length ?? 3;
  const correctionCount = parseResult?.cleansing_corrections?.length ?? 3;
  const gradeTotal = parseResult?.grade_matching?.length ?? 6;
  const funcTotal = parseResult?.function_matching?.length ?? 5;

  return (
    <div className="wizard-content">
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>准备就绪</h3>

      {/* 汇总卡片 - 可点击回看 */}
      <div className="ready-summary" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="ready-card" style={{ cursor: 'pointer' }} onClick={() => onStepClick(2)}>
          <div className="ready-card-value">{rowMissingCount} 项排除</div>
          <div className="ready-card-label">完整性</div>
        </div>
        <div className="ready-card" style={{ cursor: 'pointer' }} onClick={() => onStepClick(3)}>
          <div className="ready-card-value">{correctionCount} 项</div>
          <div className="ready-card-label">数据修正</div>
        </div>
        <div className="ready-card" style={{ cursor: 'pointer' }} onClick={() => onStepClick(4)}>
          <div className="ready-card-value">{gradeTotal}/{gradeTotal}</div>
          <div className="ready-card-label">职级匹配</div>
        </div>
        <div className="ready-card" style={{ cursor: 'pointer' }} onClick={() => onStepClick(5)}>
          <div className="ready-card-value">{funcTotal}/{funcTotal}</div>
          <div className="ready-card-label">职能匹配</div>
        </div>
      </div>
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 6, marginBottom: 20 }}>点击可回看详情</div>

      {/* 模块可用性 */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">分析模块可用性</span>
        </div>
        {modules.map((m, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < modules.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: m.available ? 'var(--green)' : 'var(--amber)', fontSize: 14 }}>{m.available ? '✅' : '⚠️'}</span>
              <span style={{ color: m.available ? 'var(--text-primary)' : 'var(--text-muted)' }}>{m.name}</span>
            </div>
            <span style={{ fontSize: 12, color: m.available ? 'var(--green)' : 'var(--amber)' }}>
              {m.available ? '可用' : `不可用 — ${m.reason || '数据不足'}`}
            </span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            数据完整度 {completenessScore}%
            <span className="progress-bar-track" style={{ width: 120 }}>
              <span className="progress-bar-fill" style={{ width: `${completenessScore}%` }}></span>
            </span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--blue)', cursor: 'pointer' }} onClick={onReupload}>补充数据，重新上传</span>
        </div>
      </div>

      <button className="start-btn" onClick={onStart}>开始诊断分析 →</button>
      <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        {interviewNotes
          ? 'Sparky 将结合数据与访谈信息生成诊断报告'
          : 'Sparky 将基于数据生成诊断报告'}
      </div>
    </div>
  );
}

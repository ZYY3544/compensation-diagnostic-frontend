import type { ParseResult } from '../../types';

interface DataOverviewProps {
  parseResult: ParseResult;
  onConfirm: () => void;
}

export default function DataOverview({ parseResult, onConfirm }: DataOverviewProps) {
  const columns = parseResult.all_columns_status || [];
  const filledCols = columns.filter(c => c.has_data);
  const emptyCols = columns.filter(c => !c.has_data);
  const sheetCount = parseResult.sheet_count || 1;
  const sheetNames = parseResult.sheet_names || [];
  const sheet2 = parseResult.sheet2_summary;
  const hasSheet2 = sheetCount >= 2;
  const deptPreview = parseResult.departments.slice(0, 3).join(' / ') + (parseResult.departments.length > 3 ? ' / ...' : '');
  const gradeRange = parseResult.grades.length > 0
    ? `${parseResult.grades[0]}-${parseResult.grades[parseResult.grades.length - 1]}`
    : '—';

  return (
    <div className="wizard-content fade-enter">
      {/* 区块 1：数据概览卡片 */}
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>数据概览</h3>
      <div className="overview-cards">
        <div className="overview-card">
          <div className="overview-card-num">{parseResult.employee_count}</div>
          <div className="overview-card-label">条记录</div>
          <div className="overview-card-sub">{sheetNames[0] || 'Sheet 1'}</div>
        </div>
        <div className="overview-card">
          <div className="overview-card-num">{parseResult.grade_count}</div>
          <div className="overview-card-label">个职级</div>
          <div className="overview-card-sub">{gradeRange}</div>
        </div>
        <div className="overview-card">
          <div className="overview-card-num">{parseResult.department_count}</div>
          <div className="overview-card-label">个部门</div>
          <div className="overview-card-sub">{deptPreview}</div>
        </div>
        <div className="overview-card">
          <div className="overview-card-num">{sheetCount}</div>
          <div className="overview-card-label">个 Sheet</div>
          <div className="overview-card-sub">{hasSheet2 ? '员工明细 + 经营数据' : '仅员工明细'}</div>
        </div>
      </div>

      {/* 区块 2：已识别字段 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">已识别字段（{filledCols.length}/{columns.length}）</span>
        </div>
        <div className="overview-field-grid">
          {filledCols.map((col, i) => (
            <div key={i} className="overview-field-item filled">
              <span className="overview-field-check">✓</span> {col.name}
            </div>
          ))}
        </div>

        {emptyCols.length > 0 && (
          <>
            <div style={{ borderTop: '1px solid var(--border)', margin: '14px 0', paddingTop: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                未填写字段（{emptyCols.length}/{columns.length}）
              </span>
            </div>
            <div className="overview-field-grid">
              {emptyCols.map((col, i) => (
                <div key={i} className="overview-field-item empty">
                  <span className="overview-field-circle">○</span> {col.name}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 区块 3：经营数据识别（Sheet 2） */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">公司经营数据</span>
          {hasSheet2 && sheet2 && sheet2.year_count > 0 && (
            <span className="badge badge-green">
              {sheet2.years[0]}-{sheet2.years[sheet2.years.length - 1]}，共 {sheet2.year_count} 年
            </span>
          )}
        </div>
        {!hasSheet2 ? (
          <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            未检测到公司经营数据（Sheet 2），人工成本趋势分析将不可用。
          </div>
        ) : sheet2 && sheet2.metrics.length > 0 ? (
          <div className="overview-field-grid">
            {sheet2.metrics.map((m, i) => (
              <div key={i} className={`overview-field-item ${m.has_data ? 'filled' : 'empty'}`}>
                <span className={m.has_data ? 'overview-field-check' : 'overview-field-circle'}>
                  {m.has_data ? '✓' : '○'}
                </span>
                {m.name}
                {!m.has_data && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>未填写</span>}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            已检测到 Sheet 2，但未识别到标准经营指标。
          </div>
        )}
      </div>

      <button className="next-step-btn" onClick={onConfirm}>确认，下一步 →</button>
    </div>
  );
}

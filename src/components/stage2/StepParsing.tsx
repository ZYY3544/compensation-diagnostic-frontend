import type { ParseResult } from '../../types';

interface StepParsingProps {
  parsing: boolean;
  parseResult?: ParseResult | null;
}

export default function StepParsing({ parsing, parseResult }: StepParsingProps) {
  const empCount = parseResult?.employee_count ?? 0;
  const gradeCount = parseResult?.grade_count ?? 0;
  const deptCount = parseResult?.department_count ?? 0;
  const fields = parseResult?.fields_detected ?? [];
  const detectedCount = fields.filter(f => f.detected).length;

  if (parsing) {
    return (
      <div className="wizard-content">
        <div className="parsing-anim">
          <div className="parsing-icon">📄</div>
          <div className="parsing-text">正在解析数据...</div>
        </div>
      </div>
    );
  }
  if (fields.length === 0) {
    return (
      <div className="wizard-content">
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>等待数据解析...</div>
      </div>
    );
  }

  return (
    <div className="wizard-content">
      <div className="data-overview-cards">
        <div className="data-stat-card">
          <div className="data-stat-number">{empCount}</div>
          <div className="data-stat-label">条记录</div>
        </div>
        <div className="data-stat-card">
          <div className="data-stat-number">{gradeCount}</div>
          <div className="data-stat-label">个职级</div>
        </div>
        <div className="data-stat-card">
          <div className="data-stat-number">{deptCount}</div>
          <div className="data-stat-label">个部门</div>
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">已识别字段</span>
          <span className="badge badge-green">{detectedCount} 个字段</span>
        </div>
        <div className="fields-grid">
          {fields.filter(f => f.detected).map((f, i) => (
            <div key={i} className="field-item"><span className="field-check">✓</span> {f.name}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

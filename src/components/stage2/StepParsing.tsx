import type { ParseResult } from '../../types';

interface StepParsingProps {
  parsing: boolean;
  parseResult?: ParseResult | null;
}

// Mock data as fallback
const mockFields = [
  { name: '姓名', detected: true },
  { name: '岗位', detected: true },
  { name: '职级', detected: true },
  { name: '月薪', detected: true },
  { name: '年终奖', detected: true },
  { name: '部门', detected: true },
  { name: '绩效', detected: true },
  { name: '入司时间', detected: true },
];

export default function StepParsing({ parsing, parseResult }: StepParsingProps) {
  const empCount = parseResult?.employee_count ?? 126;
  const gradeCount = parseResult?.grade_count ?? 6;
  const deptCount = parseResult?.department_count ?? 5;
  const fields = parseResult?.fields_detected ?? mockFields;
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

interface StepParsingProps {
  parsing: boolean;
}

export default function StepParsing({ parsing }: StepParsingProps) {
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
          <div className="data-stat-number">126</div>
          <div className="data-stat-label">条记录</div>
        </div>
        <div className="data-stat-card">
          <div className="data-stat-number">6</div>
          <div className="data-stat-label">个职级</div>
        </div>
        <div className="data-stat-card">
          <div className="data-stat-number">5</div>
          <div className="data-stat-label">个部门</div>
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">已识别字段</span>
          <span className="badge badge-green">8 个字段</span>
        </div>
        <div className="fields-grid">
          <div className="field-item"><span className="field-check">✓</span> 姓名</div>
          <div className="field-item"><span className="field-check">✓</span> 岗位</div>
          <div className="field-item"><span className="field-check">✓</span> 职级</div>
          <div className="field-item"><span className="field-check">✓</span> 月薪</div>
          <div className="field-item"><span className="field-check">✓</span> 年终奖</div>
          <div className="field-item"><span className="field-check">✓</span> 部门</div>
          <div className="field-item"><span className="field-check">✓</span> 绩效</div>
          <div className="field-item"><span className="field-check">✓</span> 入司时间</div>
        </div>
      </div>
    </div>
  );
}

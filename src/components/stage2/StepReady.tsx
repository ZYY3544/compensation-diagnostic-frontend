interface StepReadyProps {
  onStart: () => void;
  onStepClick: (step: number) => void;
  onReupload: () => void;
}

export default function StepReady({ onStart, onStepClick, onReupload }: StepReadyProps) {
  const modules = [
    { name: '外部竞争力分析', available: true },
    { name: '内部公平性分析', available: true },
    { name: '薪酬固浮比分析', available: true },
    { name: '绩效关联分析', available: false, reason: '缺少绩效字段' },
    { name: '人工成本趋势分析', available: false, reason: '缺少公司经营数据' },
  ];

  return (
    <div className="wizard-content">
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>准备就绪</h3>

      {/* 汇总卡片 - 可点击回看 */}
      <div className="ready-summary" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="ready-card" style={{ cursor: 'pointer' }} onClick={() => onStepClick(2)}>
          <div className="ready-card-value">3 项排除</div>
          <div className="ready-card-label">完整性</div>
        </div>
        <div className="ready-card" style={{ cursor: 'pointer' }} onClick={() => onStepClick(3)}>
          <div className="ready-card-value">3 项</div>
          <div className="ready-card-label">数据修正</div>
        </div>
        <div className="ready-card" style={{ cursor: 'pointer' }} onClick={() => onStepClick(4)}>
          <div className="ready-card-value">6/6</div>
          <div className="ready-card-label">职级匹配</div>
        </div>
        <div className="ready-card" style={{ cursor: 'pointer' }} onClick={() => onStepClick(5)}>
          <div className="ready-card-value">5/5</div>
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
              {m.available ? '可用' : `不可用 — ${m.reason}`}
            </span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            数据完整度 78%
            <span className="progress-bar-track" style={{ width: 120 }}>
              <span className="progress-bar-fill" style={{ width: '78%' }}></span>
            </span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--blue)', cursor: 'pointer' }} onClick={onReupload}>补充数据，重新上传</span>
        </div>
      </div>

      <button className="start-btn" onClick={onStart}>下一步：业务访谈 →</button>
      <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        Sparky 将通过简短访谈了解你的业务背景
      </div>
    </div>
  );
}

interface StepGradeMatchProps {
  l7Choice: string | null;
  onL7Choice: (choice: string) => void;
}

export default function StepGradeMatch({ l7Choice, onL7Choice }: StepGradeMatchProps) {
  return (
    <div className="wizard-content">
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>职级匹配</h3>
      <div className="card" style={{ marginBottom: 16 }}>
        <table className="s-table">
          <thead>
            <tr><th>公司职级</th><th>标准职级</th><th>状态</th></tr>
          </thead>
          <tbody>
            <tr><td>L3</td><td>专员级</td><td style={{ color: 'var(--green)' }}>✓</td></tr>
            <tr><td>L4</td><td>高级专员级</td><td style={{ color: 'var(--green)' }}>✓</td></tr>
            <tr><td>L5</td><td>经理级</td><td style={{ color: 'var(--green)' }}>✓</td></tr>
            <tr><td>L6</td><td>高级经理级</td><td style={{ color: 'var(--green)' }}>✓</td></tr>
            <tr className={l7Choice ? '' : 'warn-row'}>
              <td>L7</td>
              <td>{l7Choice === 'senior_mgr' ? '高级经理级' : l7Choice === 'director' ? '总监级' : '—'}</td>
              <td>
                {l7Choice ? (
                  <span style={{ color: 'var(--green)' }}>✓</span>
                ) : (
                  <span style={{ color: 'var(--amber)' }}>⚠ 待确认</span>
                )}
              </td>
            </tr>
            <tr><td>L8</td><td>总监级</td><td style={{ color: 'var(--green)' }}>✓</td></tr>
          </tbody>
        </table>

        {!l7Choice && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: '#FEF3C7', borderRadius: 6 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>L7 的定位是？</div>
            <div className="confirm-bar-btns">
              <button className="confirm-bar-btn" onClick={() => onL7Choice('senior_mgr')}>高级经理级</button>
              <button className="confirm-bar-btn" onClick={() => onL7Choice('director')}>总监级</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import type { ParseResult } from '../../types';

interface StepGradeMatchProps {
  l7Choice: string | null;
  onL7Choice: (choice: string) => void;
  parseResult?: ParseResult | null;
  onNext: () => void;
}

export default function StepGradeMatch({ l7Choice, onL7Choice, parseResult, onNext }: StepGradeMatchProps) {
  const grades = parseResult?.grade_matching ?? [];
  // Find the unconfirmed grade
  const uncertainGrade = grades.find(g => !g.confirmed && g.confidence === 'low');

  if (grades.length === 0) {
    return (
      <div className="wizard-content">
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>职级匹配</h3>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>等待职级匹配...</div>
      </div>
    );
  }

  return (
    <div className="wizard-content">
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>职级匹配</h3>
      <div className="card" style={{ marginBottom: 16 }}>
        <table className="s-table">
          <thead>
            <tr><th>公司职级</th><th>标准职级</th><th>状态</th></tr>
          </thead>
          <tbody>
            {grades.map((g, i) => {
              const isUncertain = !g.confirmed && g.confidence === 'low';
              const displayGrade = isUncertain
                ? (l7Choice === 'senior_mgr' ? '高级经理级' : l7Choice === 'director' ? '总监级' : '—')
                : (g.standard_grade || '—');
              const isConfirmed = isUncertain ? !!l7Choice : g.confirmed;

              return (
                <tr key={i} className={isUncertain && !l7Choice ? 'warn-row' : ''}>
                  <td>{g.client_grade}</td>
                  <td>{displayGrade}</td>
                  <td>
                    {isConfirmed ? (
                      <span style={{ color: 'var(--green)' }}>✓</span>
                    ) : (
                      <span style={{ color: 'var(--amber)' }}>⚠ 待确认</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {uncertainGrade && !l7Choice && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: '#FEF3C7', borderRadius: 6 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{uncertainGrade.client_grade} 的定位是？</div>
            <div className="confirm-bar-btns">
              <button className="confirm-bar-btn" onClick={() => onL7Choice('senior_mgr')}>高级经理级</button>
              <button className="confirm-bar-btn" onClick={() => onL7Choice('director')}>总监级</button>
            </div>
          </div>
        )}
      </div>

      <button className="next-step-btn" onClick={onNext} style={{ marginTop: 16 }}>下一步 →</button>
    </div>
  );
}

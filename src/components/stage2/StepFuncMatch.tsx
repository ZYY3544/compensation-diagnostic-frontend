import type { ParseResult } from '../../types';

interface StepFuncMatchProps {
  funcChoice: string | null;
  onFuncChoice: (choice: string) => void;
  parseResult?: ParseResult | null;
  onNext: () => void;
}

export default function StepFuncMatch({ funcChoice, onFuncChoice, parseResult, onNext }: StepFuncMatchProps) {
  const funcs = parseResult?.function_matching ?? [];

  if (funcs.length === 0) {
    return (
      <div className="wizard-content">
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>职能匹配</h3>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>等待职能匹配...</div>
      </div>
    );
  }

  return (
    <div className="wizard-content">
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>职能匹配</h3>
      <div className="card" style={{ marginBottom: 16 }}>
        {funcs.map((f, i) => {
          const isUncertain = !f.confirmed && f.confidence === 'low';
          const displayMatch = isUncertain
            ? (funcChoice === 'digital' ? '数字营销' : funcChoice === 'growth' ? '用户增长' : null)
            : f.matched;

          return (
            <div key={i}>
              <div
                className="match-item"
                style={isUncertain && !funcChoice ? { background: '#FEF3C7', margin: '0 -20px', padding: '10px 20px', borderRadius: 0 } : undefined}
              >
                <span>
                  {f.title} <span className="match-arrow">→</span>{' '}
                  {displayMatch || <span style={{ color: 'var(--amber)' }}>？待确认 ⚠</span>}
                </span>
                {(f.confirmed || (isUncertain && funcChoice)) && (
                  <span style={{ color: 'var(--green)' }}>✓</span>
                )}
              </div>
              {isUncertain && !funcChoice && f.alternatives && (
                <div style={{ padding: '12px 16px', background: '#FEF3C7', borderRadius: '0 0 6px 6px', margin: '0 -20px', paddingBottom: 16 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>"{f.title}" 的职能是？</div>
                  <div className="confirm-bar-btns">
                    {f.alternatives.map((alt, ai) => (
                      <button
                        key={ai}
                        className="confirm-bar-btn"
                        onClick={() => onFuncChoice(ai === 0 ? 'digital' : 'growth')}
                      >{alt}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button className="next-step-btn" onClick={onNext} style={{ marginTop: 16 }}>下一步 →</button>
    </div>
  );
}

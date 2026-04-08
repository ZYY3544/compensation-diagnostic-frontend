import type { ParseResult, FuncMatch } from '../../types';

interface StepFuncMatchProps {
  funcChoice: string | null;
  onFuncChoice: (choice: string) => void;
  parseResult?: ParseResult | null;
}

const mockFuncs: FuncMatch[] = [
  { title: '软件工程师', matched: '技术研发-软件开发', confidence: 'high', confirmed: true },
  { title: 'HRBP 经理', matched: '人力资源-HRBP', confidence: 'high', confirmed: true },
  { title: '增长黑客', matched: null, confidence: 'low', confirmed: false, alternatives: ['数字营销', '用户增长'] },
  { title: '销售总监', matched: '销售-大客户销售', confidence: 'high', confirmed: true },
  { title: '财务主管', matched: '财务-财务管理', confidence: 'high', confirmed: true },
];

export default function StepFuncMatch({ funcChoice, onFuncChoice, parseResult }: StepFuncMatchProps) {
  const funcs = parseResult?.function_matching ?? mockFuncs;

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
    </div>
  );
}

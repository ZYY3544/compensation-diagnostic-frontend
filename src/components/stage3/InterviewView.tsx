interface InterviewViewProps {
  onComplete: () => void;
}

export default function InterviewView({ onComplete }: InterviewViewProps) {
  return (
    <div>
      <h2>业务访谈</h2>
      <p>Stage 3 - Sparky 业务访谈（待实现）</p>
      <button onClick={onComplete} style={{marginTop: 20, padding: '10px 24px', background: '#0A66C2', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer'}}>
        确认纪要，开始诊断 →
      </button>
    </div>
  );
}

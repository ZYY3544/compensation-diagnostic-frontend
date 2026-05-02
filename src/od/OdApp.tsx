/**
 * 组织诊断 (OD) 工具主组件 — 镜像 SC/SD App。
 *
 * 视图状态:
 *   interview  → OdInterview (默认入口)
 *   diagnosis  → OdDiagnosisView (有缓存诊断时默认进这里)
 */
import { useEffect, useState } from 'react';
import { odGetProfile, odGenerateDiagnosis, type OdProfile, type OdDiagnosis } from '../api/client';
import OdInterview from './OdInterview';
import OdDiagnosisView from './OdDiagnosisView';

type ViewMode = 'interview' | 'diagnosis';

export default function OdApp() {
  const [view, setView] = useState<ViewMode>('interview');
  const [, setProfile] = useState<OdProfile | null>(null);
  const [diagnosis, setDiagnosis] = useState<OdDiagnosis | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    odGetProfile()
      .then(res => {
        setProfile(res.data.profile);
        setDiagnosis(res.data.diagnosis);
        if (res.data.diagnosis) {
          setView('diagnosis');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleInterviewComplete = (newProfile: OdProfile, newDiagnosis: OdDiagnosis) => {
    setProfile(newProfile);
    setDiagnosis(newDiagnosis);
    setView('diagnosis');
  };

  const handleRegenerate = async () => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      const res = await odGenerateDiagnosis({ timeout: 0 });
      setDiagnosis(res.data.diagnosis);
    } catch (err: any) {
      const msg = err?.response?.data?.reason || err?.message || '重新生成失败';
      alert(`重新生成失败:${msg}`);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        height: '100%', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: '#FAFAFA', color: '#94A3B8', fontSize: 13,
      }}>
        加载中...
      </div>
    );
  }

  if (view === 'interview') {
    return (
      <OdInterview
        onComplete={handleInterviewComplete}
        onSkip={diagnosis ? () => setView('diagnosis') : undefined}
      />
    );
  }

  if (!diagnosis) {
    return <OdInterview onComplete={handleInterviewComplete} />;
  }

  return (
    <OdDiagnosisView
      diagnosis={diagnosis}
      onRestart={() => setView('interview')}
      onRegenerate={regenerating ? undefined : handleRegenerate}
    />
  );
}

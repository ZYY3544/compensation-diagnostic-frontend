/**
 * 长期激励 (LTI) 工具主组件 — 镜像 SC/SD/OD App.
 */
import { useEffect, useState } from 'react';
import { ltiGetProfile, ltiGeneratePlan, type LtiProfile, type LtiPlan } from '../api/client';
import LtiInterview from './LtiInterview';
import LtiPlanView from './LtiPlanView';

type ViewMode = 'interview' | 'plan';

export default function LtiApp() {
  const [view, setView] = useState<ViewMode>('interview');
  const [, setProfile] = useState<LtiProfile | null>(null);
  const [plan, setPlan] = useState<LtiPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    ltiGetProfile()
      .then(res => {
        setProfile(res.data.profile);
        setPlan(res.data.plan);
        if (res.data.plan) {
          setView('plan');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleInterviewComplete = (newProfile: LtiProfile, newPlan: LtiPlan) => {
    setProfile(newProfile);
    setPlan(newPlan);
    setView('plan');
  };

  const handleRegenerate = async () => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      const res = await ltiGeneratePlan({ timeout: 0 });
      setPlan(res.data.plan);
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
      <LtiInterview
        onComplete={handleInterviewComplete}
        onSkip={plan ? () => setView('plan') : undefined}
      />
    );
  }

  if (!plan) {
    return <LtiInterview onComplete={handleInterviewComplete} />;
  }

  return (
    <LtiPlanView
      plan={plan}
      onRestart={() => setView('interview')}
      onRegenerate={regenerating ? undefined : handleRegenerate}
    />
  );
}

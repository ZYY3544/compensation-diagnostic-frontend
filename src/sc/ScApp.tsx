/**
 * 战略澄清 (SC) 工具主组件 — 镜像 SdApp。
 *
 * 视图状态:
 *   entry      → 入口页
 *   interview  → ScInterview 多轮访谈
 *   diamond    → ScDiamondView 钻石模型展示
 */
import { useEffect, useState } from 'react';
import { scGetProfile, scGenerateDiamond, type ScProfile, type ScDiamond } from '../api/client';
import ScEntryView from './ScEntryView';
import ScInterview from './ScInterview';
import ScDiamondView from './ScDiamondView';

type ViewMode = 'entry' | 'interview' | 'diamond';

export default function ScApp() {
  const [view, setView] = useState<ViewMode>('entry');
  const [, setProfile] = useState<ScProfile | null>(null);
  const [diamond, setDiamond] = useState<ScDiamond | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    scGetProfile()
      .then(res => {
        setProfile(res.data.profile);
        setDiamond(res.data.diamond);
        if (res.data.diamond) {
          setView('diamond');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleInterviewComplete = (newProfile: ScProfile, newDiamond: ScDiamond) => {
    setProfile(newProfile);
    setDiamond(newDiamond);
    setView('diamond');
  };

  const handleRegenerate = async () => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      const res = await scGenerateDiamond({ timeout: 0 });
      setDiamond(res.data.diamond);
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

  if (view === 'entry') {
    return (
      <ScEntryView
        onStart={() => setView('interview')}
        hasExistingDiamond={!!diamond}
        onViewExisting={diamond ? () => setView('diamond') : undefined}
      />
    );
  }

  if (view === 'interview') {
    return (
      <ScInterview
        onComplete={handleInterviewComplete}
        onSkip={diamond ? () => setView('diamond') : () => setView('entry')}
      />
    );
  }

  if (!diamond) {
    return (
      <ScEntryView
        onStart={() => setView('interview')}
        hasExistingDiamond={false}
      />
    );
  }

  return (
    <ScDiamondView
      diamond={diamond}
      onRestart={() => setView('interview')}
      onRegenerate={regenerating ? undefined : handleRegenerate}
    />
  );
}

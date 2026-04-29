/**
 * 战略澄清 (SC) 工具主组件 — 镜像 SdApp。
 *
 * 视图状态:
 *   interview  → ScInterview (默认入口,Sparky 第一条消息会介绍工具 + 4 步流程)
 *   diamond    → ScDiamondView (有缓存解码时默认进这里)
 *
 * 入口卡片已删 — 一进 tool 直接对话,介绍语作为 Sparky 开场白。
 */
import { useEffect, useState } from 'react';
import { scGetProfile, scGenerateDiamond, type ScProfile, type ScDiamond } from '../api/client';
import ScInterview from './ScInterview';
import ScDiamondView from './ScDiamondView';

type ViewMode = 'interview' | 'diamond';

export default function ScApp() {
  const [view, setView] = useState<ViewMode>('interview');
  const [, setProfile] = useState<ScProfile | null>(null);
  const [diamond, setDiamond] = useState<ScDiamond | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    scGetProfile()
      .then(res => {
        setProfile(res.data.profile);
        setDiamond(res.data.diamond);
        // 已经有钻石模型 → 默认进展示页 (用户大概率是回来看而不是重做)
        // 没有 → 留在 interview (默认值)
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

  if (view === 'interview') {
    return (
      <ScInterview
        onComplete={handleInterviewComplete}
        onSkip={diamond ? () => setView('diamond') : undefined}
      />
    );
  }

  // view === 'diamond'
  if (!diamond) {
    // 异常态:没数据但被路由到 diamond,回退访谈
    return <ScInterview onComplete={handleInterviewComplete} />;
  }

  return (
    <ScDiamondView
      diamond={diamond}
      onRestart={() => setView('interview')}
      onRegenerate={regenerating ? undefined : handleRegenerate}
    />
  );
}

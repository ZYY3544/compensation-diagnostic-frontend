/**
 * 战略解码 (SD) 工具主组件 — 镜像 JeApp 但更简单。
 *
 * 视图状态:
 *   entry      → 入口页 (开始访谈 / 看上一版)
 *   interview  → SdInterview 多轮访谈
 *   decoding   → SdDecodingView 战略解码地图展示
 *
 * 进入时如果检测到已有 decoding 缓存,默认进 decoding 视图,顶部按钮可重新做。
 */
import { useEffect, useState } from 'react';
import { sdGetProfile, sdGenerateDecoding, type SdProfile, type SdDecoding } from '../api/client';
import SdEntryView from './SdEntryView';
import SdInterview from './SdInterview';
import SdDecodingView from './SdDecodingView';

type ViewMode = 'entry' | 'interview' | 'decoding';

export default function SdApp() {
  const [view, setView] = useState<ViewMode>('entry');
  const [profile, setProfile] = useState<SdProfile | null>(null);
  const [decoding, setDecoding] = useState<SdDecoding | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  // 进入即拉一次 profile + decoding 缓存
  useEffect(() => {
    sdGetProfile()
      .then(res => {
        setProfile(res.data.profile);
        setDecoding(res.data.decoding);
        // 已经有解码 → 默认直接进展示页 (用户大概率是回来看而不是重做)
        if (res.data.decoding) {
          setView('decoding');
        }
      })
      .catch(() => {
        // 没有 profile 是正常情况,留在 entry
      })
      .finally(() => setLoading(false));
  }, []);

  const handleInterviewComplete = (newProfile: SdProfile, newDecoding: SdDecoding) => {
    setProfile(newProfile);
    setDecoding(newDecoding);
    setView('decoding');
  };

  const handleRegenerate = async () => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      const res = await sdGenerateDecoding({ timeout: 0 });
      setDecoding(res.data.decoding);
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
      <SdEntryView
        onStart={() => setView('interview')}
        hasExistingDecoding={!!decoding}
        onViewExisting={decoding ? () => setView('decoding') : undefined}
      />
    );
  }

  if (view === 'interview') {
    return (
      <SdInterview
        onComplete={handleInterviewComplete}
        onSkip={decoding ? () => setView('decoding') : () => setView('entry')}
      />
    );
  }

  // view === 'decoding'
  if (!profile || !decoding) {
    // 异常态:没数据但被路由到 decoding,回退 entry
    return (
      <SdEntryView
        onStart={() => setView('interview')}
        hasExistingDecoding={false}
      />
    );
  }

  return (
    <SdDecodingView
      profile={profile}
      decoding={decoding}
      onRestart={() => setView('interview')}
      onRegenerate={regenerating ? undefined : handleRegenerate}
    />
  );
}

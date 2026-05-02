/**
 * 战略解码 (SD) 工具主组件 — 镜像 ScApp。
 *
 * 视图状态:
 *   interview  → SdInterview (默认入口,Sparky 第一条消息会介绍工具 + 4 步流程)
 *   decoding   → SdDecodingView (有缓存解码时默认进这里)
 */
import { useEffect, useState } from 'react';
import { sdGetProfile, sdGenerateDecoding, type SdProfile, type SdDecoding } from '../api/client';
import SdInterview from './SdInterview';
import SdDecodingView from './SdDecodingView';

type ViewMode = 'interview' | 'decoding';

export default function SdApp() {
  const [view, setView] = useState<ViewMode>('interview');
  const [profile, setProfile] = useState<SdProfile | null>(null);
  const [decoding, setDecoding] = useState<SdDecoding | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    sdGetProfile()
      .then(res => {
        // V1 → V2 schema 检测: 后端检测到 V1 旧数据时返回 migration_notice + null profile/decoding
        const data = res.data as any;
        if (data.migration_notice) {
          // V1 旧数据,默默放空 (用户进 interview 自动重做),不弹窗以免吓人
          console.log('[SD V2] migration:', data.migration_notice);
          return;
        }
        setProfile(res.data.profile);
        setDecoding(res.data.decoding);
        if (res.data.decoding) {
          setView('decoding');
        }
      })
      .catch(() => {})
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

  if (view === 'interview') {
    return (
      <SdInterview
        onComplete={handleInterviewComplete}
        onSkip={decoding ? () => setView('decoding') : undefined}
      />
    );
  }

  if (!profile || !decoding) {
    return <SdInterview onComplete={handleInterviewComplete} />;
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

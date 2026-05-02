/**
 * 组织诊断 (OD) 工具主组件 — 4 阶段编排器。
 *
 * 阶段:
 *   frame      → OdFrame      破题 (诊断什么 / 适合谁 / 能拿到什么)
 *   method     → OdMethod     方法论 (KF 框架 + 4 渠道 + 5 层 + Double E)
 *   interview  → OdInterview  访谈 (现有 5 层访谈)
 *   diagnosis  → OdDiagnosisView 报告 (现有诊断展示)
 *
 * 顶部 OdProgressBar 始终可见, 任意阶段可跳转 (报告需要诊断已生成才能进)。
 *
 * 默认入口逻辑:
 *   - 已有诊断 → 直接进 diagnosis (不打扰回头客)
 *   - 没有诊断 → 进 frame (新用户走完整流程)
 */
import { useEffect, useState } from 'react';
import { odGetProfile, odGenerateDiagnosis, type OdProfile, type OdDiagnosis } from '../api/client';
import OdFrame from './OdFrame';
import OdMethod from './OdMethod';
import OdInterview from './OdInterview';
import OdDiagnosisView from './OdDiagnosisView';
import OdProgressBar from './components/OdProgressBar';

export type OdStage = 'frame' | 'method' | 'interview' | 'diagnosis';

export default function OdApp() {
  const [stage, setStage] = useState<OdStage>('frame');
  const [, setProfile] = useState<OdProfile | null>(null);
  const [diagnosis, setDiagnosis] = useState<OdDiagnosis | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    odGetProfile()
      .then(res => {
        setProfile(res.data.profile);
        setDiagnosis(res.data.diagnosis);
        // 回头客有报告 → 直接进 diagnosis; 新用户从破题开始
        if (res.data.diagnosis) {
          setStage('diagnosis');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleInterviewComplete = (newProfile: OdProfile, newDiagnosis: OdDiagnosis) => {
    setProfile(newProfile);
    setDiagnosis(newDiagnosis);
    setStage('diagnosis');
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

  const handleJump = (target: OdStage) => {
    // 没有诊断时不能跳到报告
    if (target === 'diagnosis' && !diagnosis) return;
    setStage(target);
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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <OdProgressBar
        current={stage}
        hasDiagnosis={!!diagnosis}
        onJump={handleJump}
      />

      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {stage === 'frame' && (
          <OdFrame
            onNext={() => setStage('method')}
            onSkipToInterview={() => setStage('interview')}
            onSkipToDiagnosis={diagnosis ? () => setStage('diagnosis') : undefined}
          />
        )}

        {stage === 'method' && (
          <OdMethod
            onNext={() => setStage('interview')}
            onBack={() => setStage('frame')}
            onSkipToDiagnosis={diagnosis ? () => setStage('diagnosis') : undefined}
          />
        )}

        {stage === 'interview' && (
          <OdInterview
            onComplete={handleInterviewComplete}
            onSkip={diagnosis ? () => setStage('diagnosis') : undefined}
          />
        )}

        {stage === 'diagnosis' && diagnosis && (
          <OdDiagnosisView
            diagnosis={diagnosis}
            onRestart={() => setStage('frame')}
            onRegenerate={regenerating ? undefined : handleRegenerate}
          />
        )}

        {stage === 'diagnosis' && !diagnosis && (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#94A3B8', fontSize: 13,
          }}>
            还没有诊断报告 — 请先完成访谈。
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 组织诊断 - Stage 4: 员工 Double E 调研管理屏 (雇主端).
 *
 * 状态机:
 *   noSurvey   → 启动调研表单 (输入员工总数 + 调研名)
 *   inProgress → 显示填答链接 + 实时回收数 + 进度条 + 维度热力 (缺数据时简版)
 *   ready      → 回收数 ≥ threshold, 显示"生成诊断报告"按钮
 *
 * 设计:
 *   - 左 Sparky 面板: 解读流程 + 回答用户疑问
 *   - 右 Workspace: 调研管理卡片 + 实时统计
 *   - 必选: 不回收够阈值不能进 diagnosis (后端门槛)
 */
import { useEffect, useRef, useState } from 'react';
import SparkyPanel from '../components/layout/SparkyPanel';
import Workspace from '../components/layout/Workspace';
import { nextMsgId } from '../lib/msgId';
import type { Message } from '../types';
import {
  odSurveyGet, odSurveyStart, odSurveyRefresh, odSurveyClose,
  type OdSurveyState,
} from '../api/client';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

interface Props {
  onProceedToDiagnosis: () => void;
  onBack: () => void;
}

const SURVEY_WELCOME = `这是组织诊断**最关键的数据来源** — 员工 Double E 调研。

**为什么必须做**

5 层访谈是从你的视角看公司, **员工真正怎么想** 只能通过匿名调研拿到。咨询公司经验: 高管认为"清晰、聚焦、对齐"的战略, 员工层赞同率经常只有 50-60% — 这种认知 gap 就是诊断的真问题所在。

**怎么做**

1. **填员工总数** → 系统按 max(20, 总数×30%) 算回收门槛
2. **拿到匿名链接** → 你转发给员工 (微信群 / 钉钉 / 邮件都行)
3. **员工填 40 题** → 大约 5-8 分钟, 全程匿名, 雇主端只看汇总数据
4. **回收够门槛** → 系统聚合 14 维度 + 4 类员工分布 + 部门差异, 跟你访谈数据一起喂给 LLM 生成完整报告

**说在前面**

调研期间你随时可以来这屏看回收进度, 不用一直等。下一步直接在右边操作。`;

export default function OdSurveyPanel({ onProceedToDiagnosis, onBack }: Props) {
  const [survey, setSurvey] = useState<OdSurveyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [totalEmployees, setTotalEmployees] = useState<string>('');
  const [surveyName, setSurveyName] = useState<string>('');

  const [messages, setMessages] = useState<Message[]>([]);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    setMessages([
      { role: 'user', text: '我访谈完了, 接下来呢?' },
      { id: nextMsgId(), role: 'bot', text: SURVEY_WELCOME },
    ]);
    odSurveyGet().then(res => {
      setSurvey(res.data.survey);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleStart = async () => {
    const total = parseInt(totalEmployees, 10);
    if (!total || total < 1) {
      alert('请输入有效的员工总数 (≥ 1)');
      return;
    }
    if (total > 50000) {
      alert('员工总数过大, 请确认是不是输错了');
      return;
    }
    setStarting(true);
    try {
      const res = await odSurveyStart({ total_employees: total, name: surveyName.trim() || undefined });
      setSurvey(res.data.survey);
      setMessages(prev => [...prev, {
        id: nextMsgId(), role: 'bot',
        text: `调研已启动, 回收门槛 **${res.data.survey.threshold} 份** (按 max(20, ${total}×30%) 计算)。把右边的链接转发给员工, 就可以开始收答了。`,
      }]);
    } catch (err: any) {
      alert(`启动失败: ${err?.response?.data?.reason || err?.message || '未知错误'}`);
    } finally {
      setStarting(false);
    }
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await odSurveyRefresh();
      // 重读一遍 survey 拿最新 state
      const r2 = await odSurveyGet();
      setSurvey(r2.data.survey);
      setMessages(prev => [...prev, {
        id: nextMsgId(), role: 'bot',
        text: `刷新完成 — 当前回收 **${res.data.response_count} / ${res.data.threshold} 份**` +
              (res.data.is_significant ? ', **已达门槛, 可以生成诊断报告了。**' : ', 还差一些再催一下吧。'),
      }]);
    } catch (err: any) {
      alert(`刷新失败: ${err?.response?.data?.reason || err?.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCloseAndRestart = async () => {
    if (!confirm('确定关闭当前调研并启动一个新的吗? 旧数据会保留只读。')) return;
    try {
      await odSurveyClose();
      setSurvey(null);
      setTotalEmployees('');
      setSurveyName('');
    } catch (err: any) {
      alert(`关闭失败: ${err?.response?.data?.reason || err?.message}`);
    }
  };

  const handleUserMsg = (text: string): boolean => {
    setMessages(prev => [...prev, { role: 'user', text }]);
    setMessages(prev => [...prev, {
      id: nextMsgId(), role: 'bot',
      text: '调研管理这屏暂不展开聊天, 右边直接操作: 启动调研 / 转发链接 / 刷新统计 / 生成报告。如果有具体问题, 等回到访谈或下一步报告我们再细聊。',
    }]);
    return true;
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
      <div style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <SparkyPanel
          messages={messages}
          setMessages={setMessages}
          sessionId={null}
          visible={true}
          onClose={() => {}}
          onNonChatSend={handleUserMsg}
          embedded={true}
        />
      </div>

      <Workspace
        mode="wide"
        title="员工 Double E 调研"
        subtitle="40 道题 / 14 维度 / 4 类员工分布 — 必选, 是诊断的核心数据"
        headerExtra={
          <span
            onClick={onBack}
            style={{ fontSize: 12, color: '#94A3B8', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            ← 回到访谈
          </span>
        }
      >
        {loading && <Loading />}
        {!loading && !survey && (
          <StartForm
            totalEmployees={totalEmployees}
            setTotalEmployees={setTotalEmployees}
            surveyName={surveyName}
            setSurveyName={setSurveyName}
            onStart={handleStart}
            starting={starting}
          />
        )}
        {!loading && survey && (
          <SurveyDashboard
            survey={survey}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            onProceedToDiagnosis={onProceedToDiagnosis}
            onCloseAndRestart={handleCloseAndRestart}
          />
        )}
      </Workspace>
    </div>
  );
}

function Loading() {
  return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
      加载中...
    </div>
  );
}

function StartForm(props: {
  totalEmployees: string; setTotalEmployees: (v: string) => void;
  surveyName: string; setSurveyName: (v: string) => void;
  onStart: () => void; starting: boolean;
}) {
  const total = parseInt(props.totalEmployees, 10) || 0;
  const previewThreshold = total > 0 ? Math.max(20, Math.floor(total * 0.3)) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Card title="启动新调研">
        <Field label="公司员工总数" hint="决定回收门槛, 必填">
          <input
            type="number"
            min={1}
            value={props.totalEmployees}
            onChange={e => props.setTotalEmployees(e.target.value)}
            placeholder="例: 120"
            style={inputStyle}
          />
        </Field>
        <Field label="调研名称" hint="员工看到的标题, 选填">
          <input
            type="text"
            value={props.surveyName}
            onChange={e => props.setSurveyName(e.target.value)}
            placeholder="例: 2026 Q2 全员组织诊断"
            style={inputStyle}
          />
        </Field>
        {previewThreshold !== null && (
          <div style={{
            background: BRAND_TINT, padding: '12px 14px', borderRadius: 8,
            fontSize: 12, color: BRAND, marginTop: 6,
          }}>
            预计回收门槛: <b>{previewThreshold} 份</b> (按 max(20, {total}×30%) 计算)
          </div>
        )}
        <button
          onClick={props.onStart}
          disabled={!total || props.starting}
          style={{
            ...primaryBtn, marginTop: 14,
            opacity: total && !props.starting ? 1 : 0.5,
            cursor: total && !props.starting ? 'pointer' : 'not-allowed',
          }}
        >
          {props.starting ? '启动中...' : '启动调研, 生成员工填答链接'}
        </button>
      </Card>
    </div>
  );
}

function SurveyDashboard({ survey, onRefresh, refreshing, onProceedToDiagnosis, onCloseAndRestart }: {
  survey: OdSurveyState; onRefresh: () => void; refreshing: boolean;
  onProceedToDiagnosis: () => void; onCloseAndRestart: () => void;
}) {
  const publicUrl = `${window.location.origin}/od-survey/${survey.token}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Card 1: 进度 */}
      <Card
        title={survey.name || '员工 Double E 调研'}
        badge={survey.status === 'open' ? '进行中' : '已关闭'}
        badgeColor={survey.status === 'open' ? BRAND : '#94A3B8'}
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#475569' }}>
              已回收 <b style={{ color: BRAND, fontSize: 16 }}>{survey.response_count}</b> / {survey.threshold} 份
            </span>
            <span style={{ fontSize: 11, color: '#94A3B8' }}>员工总数 {survey.total_employees}</span>
          </div>
          <div style={progressTrackStyle}>
            <div style={{
              ...progressFillStyle,
              width: `${survey.progress_pct}%`,
              background: survey.is_significant ? '#16A34A' : BRAND,
            }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 16 }}>
          <button onClick={onRefresh} disabled={refreshing} style={secondaryBtn}>
            {refreshing ? '刷新中...' : '刷新统计'}
          </button>
          {survey.is_significant ? (
            <button onClick={onProceedToDiagnosis} style={{ ...primaryBtn }}>
              生成完整诊断报告 →
            </button>
          ) : (
            <span style={{ fontSize: 11, color: '#94A3B8' }}>
              达到门槛后可点"生成完整诊断报告"
            </span>
          )}
          <button onClick={onCloseAndRestart} style={{ ...secondaryBtn, marginLeft: 'auto', fontSize: 11, color: '#94A3B8' }}>
            关闭并重新发起
          </button>
        </div>
      </Card>

      {/* Card 2: 链接 */}
      {survey.status === 'open' && (
        <Card title="员工填答链接 (匿名, 可转发)">
          <div style={{
            background: '#F8FAFC', padding: '14px 16px', borderRadius: 8,
            fontSize: 12, color: '#0F172A', wordBreak: 'break-all',
            border: '1px solid #E2E8F0', fontFamily: 'monospace', marginBottom: 10,
          }}>
            {publicUrl}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                navigator.clipboard.writeText(publicUrl);
                alert('已复制到剪贴板, 转发到员工群即可');
              }}
              style={primaryBtn}
            >
              复制链接
            </button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...secondaryBtn, textDecoration: 'none', display: 'inline-block' }}
            >
              预览员工填答页 →
            </a>
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 12, lineHeight: 1.6 }}>
            员工不需要登录, 直接打开链接填即可。答案匿名, 雇主端只能看到汇总 (按部门 / 司龄 / 年龄段汇总)。
          </div>
        </Card>
      )}

      {/* Card 3: 实时聚合 (有数据时显示) */}
      {survey.aggregated && (
        <AggregatedPreview agg={survey.aggregated} />
      )}
    </div>
  );
}

function AggregatedPreview({ agg }: { agg: NonNullable<OdSurveyState['aggregated']> }) {
  const overall = agg.overall;
  const quad = overall.quadrant_distribution;
  return (
    <Card title={`实时聚合预览 (${agg.response_count} 份)`}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <ScoreBlock label="员工敬业度" pct={overall.engagement_score} color={BRAND} />
        <ScoreBlock label="组织支持度" pct={overall.enablement_score} color="#2563EB" />
      </div>

      {/* 4 类员工 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', marginBottom: 8 }}>4 类员工分布</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {[
            { k: 'high_performer', label: '高效', color: '#16A34A' },
            { k: 'frustrated', label: '受挫', color: '#EA580C' },
            { k: 'detached', label: '漠然', color: '#3B82F6' },
            { k: 'low_performer', label: '低效', color: '#DC2626' },
          ].map(c => {
            const v = quad[c.k] || { count: 0, percentage: 0 };
            return (
              <div key={c.k} style={{
                padding: '10px 8px', textAlign: 'center',
                background: `${c.color}11`, border: `1px solid ${c.color}44`,
                borderRadius: 6,
              }}>
                <div style={{ fontSize: 11, color: c.color, fontWeight: 600 }}>{c.label}</div>
                <div style={{ fontSize: 16, color: c.color, fontWeight: 600, margin: '4px 0' }}>{v.percentage}%</div>
                <div style={{ fontSize: 10, color: '#64748B' }}>{v.count} 人</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top 3 / Bottom 3 维度 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <DimensionList title="✓ Top 3 (优势)" dims={agg.dimensions.slice(0, 3)} positive />
        <DimensionList title="✗ Bottom 3 (短板)" dims={agg.dimensions.slice(-3)} positive={false} />
      </div>
    </Card>
  );
}

function ScoreBlock({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{
      padding: '14px 16px', background: `${color}08`, borderRadius: 8,
      border: `1px solid ${color}22`,
    }}>
      <div style={{ fontSize: 12, color, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1.1 }}>{pct}%</div>
      <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>赞同比 (Top 2 Box)</div>
    </div>
  );
}

function DimensionList({ title, dims, positive }: {
  title: string;
  dims: Array<{ name: string; agree: number; gap_cn: number | null }>;
  positive: boolean;
}) {
  const tone = positive ? '#16A34A' : '#DC2626';
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: tone, marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {dims.map(d => (
          <div key={d.name} style={{
            padding: '8px 10px', background: '#F8FAFC',
            border: '1px solid #E2E8F0', borderRadius: 6,
            fontSize: 11,
          }}>
            <div style={{ color: '#0F172A', fontWeight: 500, marginBottom: 2 }}>{d.name}</div>
            <div style={{ color: '#64748B' }}>
              {d.agree}% 赞同
              {d.gap_cn !== null && (
                <span style={{ color: d.gap_cn >= 0 ? '#16A34A' : '#DC2626', marginLeft: 6 }}>
                  vs 中国全行业 {d.gap_cn >= 0 ? '+' : ''}{d.gap_cn}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ title, badge, badgeColor, children }: {
  title: string; badge?: string; badgeColor?: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: '20px 22px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{title}</div>
        {badge && (
          <span style={{
            fontSize: 11, color: badgeColor || BRAND, background: `${badgeColor || BRAND}11`,
            padding: '3px 10px', borderRadius: 10, fontWeight: 500,
          }}>{badge}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: '#0F172A', marginBottom: 6 }}>
        {label}{hint && <span style={{ color: '#94A3B8', fontWeight: 400, marginLeft: 6 }}>({hint})</span>}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  border: '1px solid #E2E8F0', borderRadius: 6, outline: 'none',
  boxSizing: 'border-box',
};

const primaryBtn: React.CSSProperties = {
  padding: '9px 18px', fontSize: 13, fontWeight: 500,
  background: BRAND, color: '#fff', border: 'none',
  borderRadius: 6, cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
  padding: '9px 16px', fontSize: 13, fontWeight: 500,
  background: '#fff', color: '#475569',
  border: '1px solid #E2E8F0', borderRadius: 6, cursor: 'pointer',
};

const progressTrackStyle: React.CSSProperties = {
  width: '100%', height: 8, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden',
};

const progressFillStyle: React.CSSProperties = {
  height: '100%', transition: 'width 0.3s',
};

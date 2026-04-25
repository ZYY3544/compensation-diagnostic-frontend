/**
 * 人岗匹配视图。
 *
 * 输入：用户在 JE 主视图点"人岗匹配" → 调 /api/je/match → 渲染本组件。
 *
 * 后端会自动取当前 workspace 最新一个有员工数据的 session（用户也可以手填 session_id），
 * 跟 JE 岗位库做软匹配，返回：
 *   - summary: 总匹配率 / 越级 / 屈才 / 对齐人数
 *   - matched: 每个员工对应的岗位 + gap（gap >= 2 越级，gap <= -2 屈才）
 *   - unmatched: 没匹配上的员工
 *
 * 没数据时（例如还没上传薪酬 / 还没评估岗位）给出明确引导。
 */
import { useEffect, useState } from 'react';
import { jeMatch, type JeMatchResult, type JeMatchEntry, type JeMatchEmployee } from '../api/client';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

interface Props {
  onBack: () => void;
  onJobSelect: (jobId: string) => void;
}

export default function PersonJobMatch({ onBack, onJobSelect }: Props) {
  const [data, setData] = useState<JeMatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
  // 主诊断创建 session 时会把 id 写到 localStorage（mx_last_session_id），
  // 这里读出来 prefill，避免用户手动复制粘贴
  const [sessionInput, setSessionInput] = useState(() => {
    try { return localStorage.getItem('mx_last_session_id') || ''; } catch { return ''; }
  });

  const load = async (sessionId: string) => {
    if (!sessionId) {
      setError({
        message: 'session_id_required',
        hint: '需要先在主诊断里创建 session（上传薪酬数据）。如果已经做过，请打开主诊断让 session 加载好后再回到这里。',
      });
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await jeMatch(sessionId);
      setData(res.data);
    } catch (e: any) {
      const body = e?.response?.data;
      setError({
        message: body?.error || '加载失败',
        hint: body?.hint,
      });
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // 进来时如果 localStorage 里有 session_id 就自动加载，否则等用户手动触发
  useEffect(() => {
    const stored = sessionInput.trim();
    if (stored) load(stored);
  }, []);

  return (
    <div style={{ padding: '0 24px 32px' }}>
      <div style={{ padding: '20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button onClick={onBack} style={{
            padding: '4px 10px', fontSize: 12, marginBottom: 8,
            background: 'transparent', border: '1px solid #E2E8F0', borderRadius: 6,
            cursor: 'pointer', color: '#64748B',
          }}>
            ← 返回职级图谱
          </button>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#0F172A' }}>
            人岗匹配
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
            把当前 workspace 的员工跟 JE 岗位库连起来，看实际职级跟应有职级的差异
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="可选：指定 session_id"
            value={sessionInput}
            onChange={e => setSessionInput(e.target.value)}
            style={{
              padding: '6px 10px', fontSize: 12, border: '1px solid #E2E8F0',
              borderRadius: 6, width: 220,
            }}
          />
          <button onClick={() => load(sessionInput.trim())} style={{
            padding: '6px 14px', fontSize: 12, borderRadius: 6,
            background: BRAND, color: '#fff', border: 'none', cursor: 'pointer',
          }}>
            重新匹配
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748B', fontSize: 13 }}>
          正在拉取员工数据 + 匹配岗位…
        </div>
      )}

      {!loading && error && (
        <div style={{
          padding: 24, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
          color: '#7F1D1D',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            {errorTitleFor(error.message)}
          </div>
          {error.hint && (
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>{error.hint}</div>
          )}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <SummaryCards summary={data.summary} sessionId={data.session_id} />
          <MatchedList matched={data.matched} onJobSelect={onJobSelect} />
          {data.unmatched.length > 0 && <UnmatchedList unmatched={data.unmatched} />}
        </>
      )}
    </div>
  );
}

function errorTitleFor(code: string): string {
  if (code === 'session_id_required') return '请先指定一个 session';
  if (code === 'no_jobs') return '当前 workspace 还没有 JE 岗位';
  if (code === 'session_not_found') return 'session 不存在';
  if (code === 'session_has_no_employees') return 'session 没有员工数据';
  if (code === 'forbidden') return '没有访问该 session 的权限';
  return '加载失败';
}

// ---------- summary ----------

function SummaryCards({ summary, sessionId }: { summary: JeMatchResult['summary']; sessionId: string }) {
  const matchPct = (summary.match_rate * 100).toFixed(0);
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: 20, marginBottom: 16,
    }}>
      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 12 }}>
        基于 session <span style={{ fontFamily: 'ui-monospace, monospace', color: '#475569' }}>{sessionId.slice(0, 12)}…</span>
        · {summary.total_employees} 个员工 / {summary.jobs_with_grade} 个已评估岗位
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
        <SummaryStat label="匹配率" value={`${matchPct}%`} accent />
        <SummaryStat label="对齐" value={summary.aligned} sub="差距 ±1 内" />
        <SummaryStat label="越级在岗" value={summary.over_leveled} sub="员工高于岗位 ≥ 2 级" hint={summary.over_leveled > 0 ? 'warn' : undefined} />
        <SummaryStat label="屈才 / 待提" value={summary.under_leveled} sub="员工低于岗位 ≥ 2 级" hint={summary.under_leveled > 0 ? 'info' : undefined} />
        <SummaryStat label="未匹配" value={summary.unmatched_count} sub="找不到对应岗位" hint={summary.unmatched_count > 0 ? 'warn' : undefined} />
      </div>
    </div>
  );
}

function SummaryStat({ label, value, sub, accent, hint }: {
  label: string; value: any; sub?: string; accent?: boolean; hint?: 'warn' | 'info';
}) {
  const valueColor = accent ? BRAND
    : hint === 'warn' ? '#DC2626'
    : hint === 'info' ? '#0EA5E9'
    : '#0F172A';
  return (
    <div>
      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: valueColor }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ---------- matched list ----------

function MatchedList({ matched, onJobSelect }: { matched: JeMatchEntry[]; onJobSelect: (id: string) => void }) {
  const [filter, setFilter] = useState<'all' | 'over' | 'under' | 'aligned'>('all');

  const filtered = matched.filter(m => {
    if (filter === 'all') return true;
    if (m.gap === null) return false;
    if (filter === 'over') return m.gap >= 2;
    if (filter === 'under') return m.gap <= -2;
    if (filter === 'aligned') return Math.abs(m.gap) < 2;
    return true;
  });

  // 按 gap 绝对值降序，让最不匹配的排在最上面
  const sorted = [...filtered].sort((a, b) => Math.abs(b.gap ?? 0) - Math.abs(a.gap ?? 0));

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid #F1F5F9',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>
          已匹配 ({matched.length})
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'over', 'under', 'aligned'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '4px 10px', fontSize: 11, borderRadius: 4,
              background: filter === f ? BRAND_TINT : 'transparent',
              color: filter === f ? BRAND : '#64748B',
              border: `1px solid ${filter === f ? BRAND : '#E2E8F0'}`,
              cursor: 'pointer', fontWeight: filter === f ? 600 : 400,
            }}>
              {f === 'all' ? '全部' : f === 'over' ? '越级' : f === 'under' ? '屈才' : '对齐'}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
          当前过滤条件下没有匹配记录
        </div>
      ) : (
        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ background: '#FAFBFC', position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <Th>员工</Th>
                <Th>部门</Th>
                <Th>在岗职级</Th>
                <Th>岗位标准</Th>
                <Th>差距</Th>
                <Th>匹配方式</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m, i) => (
                <tr key={i} style={{ borderTop: '1px solid #F1F5F9' }}>
                  <Td>
                    <div style={{ color: '#0F172A' }}>{m.employee.name || '—'}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{m.employee.job_title}</div>
                  </Td>
                  <Td>{m.employee.department || '—'}</Td>
                  <Td>{m.employee.hay_grade != null ? `G${m.employee.hay_grade}` : <span style={{ color: '#94A3B8' }}>未匹配标准职级</span>}</Td>
                  <Td>
                    <button onClick={() => onJobSelect(m.job.id)} style={jobLinkStyle}>
                      {m.job.title} <span style={{ color: '#94A3B8' }}>· G{m.job.job_grade}</span>
                    </button>
                  </Td>
                  <Td><GapBadge gap={m.gap} /></Td>
                  <Td>
                    <span style={{
                      padding: '2px 6px', borderRadius: 4, fontSize: 10,
                      background: m.match_strategy === 'dept+title' ? '#DCFCE7'
                        : m.match_strategy === 'title' ? '#DBEAFE'
                        : '#FEF3C7',
                      color: m.match_strategy === 'dept+title' ? '#166534'
                        : m.match_strategy === 'title' ? '#1E40AF'
                        : '#92400E',
                    }}>
                      {m.match_strategy === 'dept+title' ? '精确' : m.match_strategy === 'title' ? '同名' : '模糊'}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GapBadge({ gap }: { gap: number | null }) {
  if (gap === null) return <span style={{ color: '#94A3B8', fontSize: 11 }}>—</span>;
  const color = gap >= 2 ? '#DC2626' : gap <= -2 ? '#0EA5E9' : '#059669';
  const label = gap >= 2 ? `越级 +${gap}` : gap <= -2 ? `屈才 ${gap}` : `对齐 ${gap >= 0 ? '+' : ''}${gap}`;
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
      color, background: gap >= 2 ? '#FEE2E2' : gap <= -2 ? '#E0F2FE' : '#D1FAE5',
    }}>
      {label}
    </span>
  );
}

// ---------- unmatched ----------

function UnmatchedList({ unmatched }: { unmatched: JeMatchEmployee[] }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #F1F5F9' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>
          未匹配员工 ({unmatched.length})
        </div>
        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
          这些员工的岗位名在 JE 库里找不到对应岗位。要么补一个 JE 岗位评估，要么改员工的岗位名。
        </div>
      </div>
      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: '#FAFBFC', position: 'sticky', top: 0 }}>
            <tr>
              <Th>员工</Th>
              <Th>岗位名</Th>
              <Th>部门</Th>
              <Th>在岗职级</Th>
            </tr>
          </thead>
          <tbody>
            {unmatched.map((e, i) => (
              <tr key={i} style={{ borderTop: '1px solid #F1F5F9' }}>
                <Td>{e.name || '—'}</Td>
                <Td>{e.job_title || '—'}</Td>
                <Td>{e.department || '—'}</Td>
                <Td>{e.hay_grade != null ? `G${e.hay_grade}` : <span style={{ color: '#94A3B8' }}>—</span>}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- 共享 ----------

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{
    padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: '#64748B',
  }}>{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>{children}</td>;
}

const jobLinkStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', padding: 0,
  color: BRAND, cursor: 'pointer', textDecoration: 'underline',
  fontSize: 12, fontFamily: 'inherit',
};

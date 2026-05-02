/**
 * 员工 Double E 调研填答页 — 通过 token 公开访问 (无需登录)。
 *
 * URL: /od-survey/<token>
 *
 * UI:
 *   - 顶部 1 段说明 (匿名 / 5-8 分钟 / 必填提示)
 *   - 第一段: 4 个员工属性问题 (部门 / 是否管理者 / 司龄 / 年龄)
 *   - 第二段: 40 道题, 按 14 维度分组, 每题 5 选 1
 *   - 底部: 进度条 + 提交按钮
 *   - 提交后显示感谢页
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  odSurveyPublicGet, odSurveyPublicSubmit,
  type OdSurveyQuestion, type OdSurveyScale, type OdSurveyAttrDef,
} from '../api/client';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

type LoadState = 'loading' | 'ready' | 'closed' | 'not_found' | 'submitted' | 'error';

export default function OdSurveyPublic() {
  const { token } = useParams<{ token: string }>();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [surveyName, setSurveyName] = useState<string>('');
  const [questions, setQuestions] = useState<OdSurveyQuestion[]>([]);
  const [scale, setScale] = useState<OdSurveyScale | null>(null);
  const [attrDefs, setAttrDefs] = useState<OdSurveyAttrDef[]>([]);

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadState('not_found');
      return;
    }
    odSurveyPublicGet(token)
      .then(res => {
        setSurveyName(res.data.survey_name);
        setQuestions(res.data.questions);
        setScale(res.data.scale);
        setAttrDefs(res.data.employee_attributes);
        setLoadState('ready');
      })
      .catch(err => {
        const status = err?.response?.status;
        if (status === 410) setLoadState('closed');
        else if (status === 404) setLoadState('not_found');
        else {
          setErrorMsg(err?.response?.data?.reason || err?.message || '加载失败');
          setLoadState('error');
        }
      });
  }, [token]);

  // 按维度分组
  const dimensionGroups = useMemo(() => {
    const groups: Record<string, OdSurveyQuestion[]> = {};
    for (const q of questions) {
      if (!groups[q.dimension]) groups[q.dimension] = [];
      groups[q.dimension].push(q);
    }
    // 维持 KF 标准顺序: 综合维度放最前面
    const order = [
      '员工敬业度', '组织支持度',
      '清晰和有希望的方向', '对领导者的信心', '质量和客户导向',
      '尊重与认可', '发展机会', '薪酬与福利',
      '绩效管理', '职权与授权', '资源',
      '培训', '合作', '工作、架构和流程',
    ];
    return order.filter(d => groups[d]).map(d => ({ name: d, items: groups[d] }));
  }, [questions]);

  const totalQs = questions.length;
  const answeredQs = Object.keys(answers).length;
  const totalAttrs = attrDefs.filter(a => a.required).length;
  const filledAttrs = attrDefs.filter(a => a.required && (attributes[a.key] || '').trim()).length;
  const progressPct = Math.round(((answeredQs + filledAttrs) / (totalQs + totalAttrs)) * 100);
  const canSubmit = answeredQs === totalQs && filledAttrs === totalAttrs;

  const submit = async () => {
    if (!canSubmit || !token || submitting) return;
    setSubmitting(true);
    try {
      await odSurveyPublicSubmit(token, { answers, attributes });
      setLoadState('submitted');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.reason || err?.message || '提交失败, 请重试');
      alert(`提交失败: ${err?.response?.data?.reason || err?.message || '请重试'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // -------- 各种状态屏 --------
  if (loadState === 'loading') {
    return <CenterMsg text="加载中..." />;
  }
  if (loadState === 'not_found') {
    return <CenterMsg text="链接无效或已过期, 请联系发起方核对。" tone="error" />;
  }
  if (loadState === 'closed') {
    return <CenterMsg text="本次调研已结束, 不再接受新答卷。如需再次调研请联系 HR。" tone="warn" />;
  }
  if (loadState === 'error') {
    return <CenterMsg text={`加载失败: ${errorMsg}`} tone="error" />;
  }
  if (loadState === 'submitted') {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 22, fontWeight: 600, color: BRAND, marginBottom: 12 }}>
            ✓ 答卷已匿名提交
          </div>
          <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.7 }}>
            感谢你的反馈, 你的答案以匿名方式纳入统计 — 不会展示个人信息, 雇主端只能看到部门 / 司龄 / 年龄段汇总数据。
            <br /><br />
            可以关闭本页了 :)
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={headerCardStyle}>
          <div style={{ fontSize: 13, color: BRAND, fontWeight: 600, marginBottom: 8 }}>员工 Double E 调研</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#0F172A', marginBottom: 12 }}>{surveyName}</div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.75 }}>
            这份调研用于做组织诊断, 全程**匿名** — 雇主端只能看到部门 / 司龄 / 年龄段的**汇总数据**, 看不到个人答案。
            <br />
            一共 4 道基本信息 + 40 道态度题 (5 级量表), 大约 5-8 分钟。请凭直觉作答, 没有"标准答案"。
          </div>
        </div>

        {/* 进度条 sticky 在顶部 */}
        <div style={progressBarWrap}>
          <div style={{ fontSize: 12, color: '#475569', display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span>已完成 {answeredQs + filledAttrs} / {totalQs + totalAttrs}</span>
            <span style={{ color: BRAND, fontWeight: 600 }}>{progressPct}%</span>
          </div>
          <div style={progressTrackStyle}>
            <div style={{ ...progressFillStyle, width: `${progressPct}%` }} />
          </div>
        </div>

        {/* 第一段: 基本信息 */}
        <Section title="① 基本信息 (用于汇总分析)">
          {attrDefs.map(def => (
            <AttrInput
              key={def.key}
              def={def}
              value={attributes[def.key] || ''}
              onChange={v => setAttributes(s => ({ ...s, [def.key]: v }))}
            />
          ))}
        </Section>

        {/* 第二段: 态度题, 按维度分组 */}
        {dimensionGroups.map((g, gi) => (
          <Section key={g.name} title={`${dimNumberLabel(gi)} ${g.name}`}>
            {g.items.map(q => (
              <LikertItem
                key={q.code}
                question={q}
                scale={scale!}
                value={answers[q.code]}
                onChange={(v) => setAnswers(s => ({ ...s, [q.code]: v }))}
              />
            ))}
          </Section>
        ))}

        {/* 底部提交按钮 */}
        <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={submit}
            disabled={!canSubmit || submitting}
            style={{
              ...submitBtn,
              opacity: (canSubmit && !submitting) ? 1 : 0.5,
              cursor: (canSubmit && !submitting) ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? '提交中...' : (canSubmit ? '匿名提交答卷' : `还有 ${totalQs + totalAttrs - answeredQs - filledAttrs} 项未填`)}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#94A3B8' }}>
          铭曦 × Double E (KF 员工敬业度调研标准方法论)
        </div>
      </div>
    </div>
  );
}

function dimNumberLabel(idx: number): string {
  const nums = ['②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮'];
  return nums[idx] || `(${idx + 2})`;
}

function CenterMsg({ text, tone = 'normal' }: { text: string; tone?: 'normal' | 'warn' | 'error' }) {
  const colors = {
    normal: { bg: '#fff', text: '#475569', border: '#E2E8F0' },
    warn:   { bg: '#FFFBEB', text: '#92400E', border: '#FCD34D' },
    error:  { bg: '#FEF2F2', text: '#B91C1C', border: '#FCA5A5' },
  }[tone];
  return (
    <div style={pageStyle}>
      <div style={{
        ...cardStyle,
        background: colors.bg, color: colors.text,
        border: `1px solid ${colors.border}`,
      }}>
        {text}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{
        fontSize: 14, fontWeight: 600, color: BRAND,
        marginBottom: 12, padding: '6px 0',
      }}>{title}</div>
      <div style={{
        background: '#fff', border: '1px solid #E2E8F0',
        borderRadius: 12, padding: '4px 4px',
      }}>
        {children}
      </div>
    </div>
  );
}

function AttrInput({ def, value, onChange }: {
  def: OdSurveyAttrDef; value: string; onChange: (v: string) => void;
}) {
  return (
    <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9' }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#0F172A', marginBottom: 8 }}>
        {def.label}{def.required && <span style={{ color: BRAND, marginLeft: 4 }}>*</span>}
      </div>
      {def.type === 'text' ? (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={def.placeholder}
          style={{
            width: '100%', padding: '8px 12px', fontSize: 13,
            border: '1px solid #E2E8F0', borderRadius: 6, outline: 'none',
            transition: 'border 0.15s',
          }}
          onFocus={e => (e.target.style.borderColor = BRAND)}
          onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
        />
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {def.options?.map(opt => (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              style={{
                padding: '6px 14px', fontSize: 12,
                border: `1px solid ${value === opt.value ? BRAND : '#E2E8F0'}`,
                background: value === opt.value ? BRAND_TINT : '#fff',
                color: value === opt.value ? BRAND : '#475569',
                borderRadius: 18, cursor: 'pointer',
                fontWeight: value === opt.value ? 600 : 400,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LikertItem({ question, scale, value, onChange }: {
  question: OdSurveyQuestion; scale: OdSurveyScale;
  value: number | undefined; onChange: (v: number) => void;
}) {
  return (
    <div style={{ padding: '16px 18px', borderBottom: '1px solid #F1F5F9' }}>
      <div style={{ fontSize: 13, color: '#0F172A', marginBottom: 12, lineHeight: 1.6 }}>
        {question.text}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
        {scale.options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '8px 4px', fontSize: 11,
              border: `1px solid ${value === opt.value ? BRAND : '#E2E8F0'}`,
              background: value === opt.value ? BRAND : '#fff',
              color: value === opt.value ? '#fff' : '#475569',
              borderRadius: 6, cursor: 'pointer',
              fontWeight: value === opt.value ? 600 : 400,
              transition: 'all 0.1s',
              lineHeight: 1.3,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh', background: '#FAFAFA',
  padding: '32px 16px 80px', boxSizing: 'border-box',
};

const cardStyle: React.CSSProperties = {
  maxWidth: 600, margin: '60px auto', padding: '40px 32px',
  background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
  fontSize: 14, color: '#475569', lineHeight: 1.7, textAlign: 'center',
};

const headerCardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
  padding: '28px 24px', marginBottom: 4,
};

const progressBarWrap: React.CSSProperties = {
  position: 'sticky', top: 0,
  background: '#FAFAFA', padding: '12px 0',
  zIndex: 10,
};

const progressTrackStyle: React.CSSProperties = {
  width: '100%', height: 6, background: '#E2E8F0',
  borderRadius: 3, overflow: 'hidden',
};

const progressFillStyle: React.CSSProperties = {
  height: '100%', background: BRAND, transition: 'width 0.25s',
};

const submitBtn: React.CSSProperties = {
  padding: '12px 36px', fontSize: 14, fontWeight: 600,
  background: BRAND, color: '#fff',
  border: 'none', borderRadius: 8,
};

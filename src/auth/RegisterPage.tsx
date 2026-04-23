import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import PixelCat from '../components/shared/PixelCat';

export default function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (password.length < 6) {
      setErr('密码至少 6 位');
      return;
    }
    setLoading(true);
    try {
      await register({
        email: email.trim(),
        password,
        display_name: displayName.trim() || undefined,
        company_name: companyName.trim() || undefined,
      });
      nav('/', { replace: true });
    } catch (e: any) {
      const code = e?.response?.data?.error;
      if (code === 'email_exists') setErr('这个邮箱已经注册过了');
      else if (code === 'email_invalid') setErr('邮箱格式不对');
      else if (code === 'password_too_short') setErr('密码至少 6 位');
      else setErr('注册失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <PixelCat size={32} />
          <div style={{ fontSize: 20, fontWeight: 700, color: '#0F172A' }}>铭曦</div>
        </div>
        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 24 }}>注册新账号</div>

        <form onSubmit={submit}>
          <Field label="邮箱（必填）" value={email} type="email" autoComplete="email" onChange={setEmail} required />
          <Field label="密码（至少 6 位）" value={password} type="password" autoComplete="new-password" onChange={setPassword} required />
          <Field label="姓名（可选）" value={displayName} onChange={setDisplayName} />
          <Field label="公司名（可选）" value={companyName} onChange={setCompanyName} />

          {err && <div style={errStyle}>{err}</div>}

          <button type="submit" disabled={loading} style={primaryBtn(loading)}>
            {loading ? '创建中...' : '创建账号'}
          </button>
        </form>

        <div style={{ marginTop: 16, fontSize: 13, color: '#64748B', textAlign: 'center' }}>
          已经有账号？<Link to="/login" style={linkStyle}>登录</Link>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = false, autoComplete = '' }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; autoComplete?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} required={required} autoComplete={autoComplete}
        onChange={e => onChange(e.target.value)} style={inputStyle} />
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'linear-gradient(180deg, #FAFAFA 0%, #F1F5F9 100%)',
  padding: 20,
};
const cardStyle: React.CSSProperties = {
  width: '100%', maxWidth: 380, padding: '32px 36px',
  background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16,
  boxShadow: '0 4px 24px rgba(15,23,42,0.06)',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: 500,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 13,
  border: '1px solid #E2E8F0', borderRadius: 8, outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
};
const errStyle: React.CSSProperties = {
  padding: '8px 12px', background: '#FEF2F2', color: '#991B1B',
  borderRadius: 6, fontSize: 12, marginBottom: 12,
};
const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  width: '100%', padding: '11px 16px', fontSize: 14, fontWeight: 600,
  background: disabled ? '#E2E8F0' : '#D85A30', color: '#fff',
  border: 'none', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
  marginTop: 4, transition: 'background 0.15s',
});
const linkStyle: React.CSSProperties = {
  color: '#D85A30', textDecoration: 'none', fontWeight: 500,
};

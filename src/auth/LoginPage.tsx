import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import PixelCat from '../components/shared/PixelCat';

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as any)?.from || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      nav(from, { replace: true });
    } catch (e: any) {
      const code = e?.response?.data?.error;
      setErr(code === 'invalid_credentials' ? '邮箱或密码不对' : '登录失败，请稍后再试');
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
        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 24 }}>HR 薪酬诊断 AI 平台</div>

        <form onSubmit={submit}>
          <Field label="邮箱"
            value={email} type="email" autoComplete="email"
            onChange={setEmail} required />
          <Field label="密码"
            value={password} type="password" autoComplete="current-password"
            onChange={setPassword} required />

          {err && <div style={errStyle}>{err}</div>}

          <button type="submit" disabled={loading} style={primaryBtn(loading)}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div style={{ marginTop: 16, fontSize: 13, color: '#64748B', textAlign: 'center' }}>
          还没有账号？<Link to="/register" style={linkStyle}>注册</Link>
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

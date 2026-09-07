import { useState } from "react";
import logo from "../../assets/logo-3.png";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Select from "react-select";
import { API_BASE_URL } from "../../config/api";
const API = `${API_BASE_URL}`;

const DEPARTMENTS = [
  "Sales",
  "Marketing",
  "Technical",
  "Support",
  "Admin",
].map((v) => ({
  value: v,
  label: v,
}));

// ── Icons (unchanged) ─────────────────────────────────────────────────────────
const BuildingIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFD400" strokeWidth="1.5">
    <rect x="3" y="3" width="18" height="18" rx="1" />
    <path d="M9 22V12h6v10M9 7h1M14 7h1M9 12h1M14 12h1" />
  </svg>
);
const MailIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFD400" strokeWidth="1.5">
    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 7 10-7" />
  </svg>
);
const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFD400" strokeWidth="1.5">
    <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
const EyeIcon = ({ open }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.5">
    {open ? (
      <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>
    ) : (
      <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" /></>
    )}
  </svg>
);
const BuildingOutline = () => (
  <svg width="100%" height="100%" viewBox="0 0 340 420" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g opacity="0.25" stroke="#FFD400" strokeWidth="1">
      <rect x="80" y="60" width="180" height="360" />
      {[0,1,2,3,4,5,6,7,8].map(r => [0,1,2,3].map(c => (
        <rect key={`${r}-${c}`} x={100+c*40} y={80+r*36} width="22" height="24" rx="2" />
      )))}
      <rect x="20" y="160" width="60" height="260" />
      {[0,1,2,3,4].map(r => [0,1].map(c => (
        <rect key={`s-${r}-${c}`} x={32+c*26} y={178+r*42} width="14" height="20" rx="1" />
      )))}
      <rect x="260" y="200" width="70" height="220" />
      {[0,1,2,3].map(r => [0,1].map(c => (
        <rect key={`r-${r}-${c}`} x={272+c*26} y={218+r*42} width="14" height="20" rx="1" />
      )))}
      <line x1="170" y1="60" x2="170" y2="20" /><line x1="155" y1="30" x2="185" y2="30" />
    </g>
  </svg>
);

const inputWrap = (focused) => ({
  display: "flex", alignItems: "center", gap: "12px",
  border: `1.5px solid ${focused ? "#FFD400" : "#e8e8e8"}`,
  borderRadius: "12px", padding: "12px 16px",
  boxShadow: focused ? "0 0 0 3px #FFD40033" : "none",
  transition: "border-color .2s, box-shadow .2s",
});

const inputStyle = {
  flex: 1, border: "none", outline: "none",
  fontSize: "15px", color: "#1a1a1a", background: "transparent", fontFamily: "inherit",
};

export default function VconstechLogin() {
  const [department, setDepartment] = useState("");
  const [dropOpen,   setDropOpen]   = useState(false);
  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [showPwd,    setShowPwd]    = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [focused,    setFocused]    = useState("");
  const [errors,     setErrors]     = useState({});   // field-level errors
  const [apiError,   setApiError]   = useState("");   // server error banner

  const navigate = useNavigate();

  // ── Validate ────────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!department)       e.department = "Please select your department";
    if (!email.trim())     e.email      = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                           e.email      = "Enter a valid email address";
    if (!password)         e.password   = "Password is required";
    return e;
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setApiError("");
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setLoading(true);
    try {
      const res = await axios.post(`${API}/api/auth/login`, { email, password, department });
      const { employee, token } = res.data;

      // Save to localStorage — Header & ProfilePage read from here
      localStorage.setItem("employee", JSON.stringify(employee));
      if (token) localStorage.setItem("token", token);

      navigate("/dashboard");
    } catch (err) {
      const msg = err?.response?.data?.message || "Invalid email or password";
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Allow Enter key to submit
  const onKey = (e) => { if (e.key === "Enter") handleLogin(); };

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: "#FFFDF7" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; }
        .login-card { animation: fadeUp 0.5s ease both; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        .dept-option { padding:10px 16px; cursor:pointer; font-size:14px; color:#333; }
        .dept-option:hover { background:#FFF8E7; color:#FFD400; }
        .eye-btn { background:none; border:none; cursor:pointer; padding:4px; display:flex; align-items:center; }
        .forgot-link { color:#FFD400; font-size:14px; font-weight:600; cursor:pointer; background:none; border:none; font-family:inherit; }
        .forgot-link:hover { text-decoration:underline; }
        .login-btn { background:#FFD400; color:#1a1a1a; border:none; border-radius:12px; width:100%; padding:16px; font-size:17px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:10px; box-shadow:0 4px 20px #f8d52880; transition:transform .15s, box-shadow .15s; font-family:inherit; }
        .login-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 28px rgba(160,135,65,.5); }
        .login-btn:disabled { opacity:.75; cursor:not-allowed; }
        .spinner { width:20px; height:20px; border:2px solid rgba(26,26,26,.3); border-top-color:#1a1a1a; border-radius:50%; animation:spin .7s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }
        .field-error { color:#ef4444; font-size:12px; margin-top:5px; }
        .api-error { background:#fef2f2; border:1px solid #fecaca; color:#dc2626; border-radius:10px; padding:12px 16px; font-size:13px; font-weight:500; margin-bottom:20px; display:flex; align-items:center; gap:8px; }
      `}</style>

      <div className="login-card" style={{ width: "100%", height: "100vh", display: "flex", background: "#FFFDF7" }}>

        {/* ── Left panel (unchanged) ── */}
        <div style={{ flex: "0 0 46%", background: "linear-gradient(160deg,#FFFBEF,#FFF3CC)", padding: "48px 40px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", bottom: "-40px", left: "-40px", width: "200px", height: "200px", borderRadius: "50%", background: "#FFD400", opacity: .35 }} />
          <div style={{ position: "absolute", top: "60px", right: "30px", width: "120px", height: "120px", borderRadius: "50%", background: "radial-gradient(#FFE08A,transparent 70%)", opacity: .6 }} />

          <div style={{ marginBottom: "56px", position: "relative", zIndex: 1 }}>
            <img src={logo} alt="Vconstech Logo" style={{ height: "80px", width: "auto", objectFit: "contain", marginBottom: "8px" }} />
            <div style={{ fontSize: "8.5px", color: "#999", letterSpacing: "2px", fontWeight: 600 }}>VALUES · COMMITMENT · TECHNOLOGY</div>
          </div>

          <div style={{ position: "relative", zIndex: 1, flex: 1 }}>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: "52px", lineHeight: 1.1, margin: "0 0 16px", color: "#1a1a1a" }}>
              Welcome<br /><span style={{ color: "#FFD400" }}>Back!</span>
            </h1>
            <div style={{ width: "40px", height: "3px", background: "#FFD400", borderRadius: "2px", marginBottom: "20px" }} />
            <p style={{ color: "#666", fontSize: "15px", lineHeight: 1.6, margin: 0, maxWidth: "220px" }}>Access your workspace and stay productive every day.</p>
          </div>

          <div style={{ position: "absolute", bottom: 0, right: 0, width: "260px", height: "320px", zIndex: 0 }}>
            <BuildingOutline />
          </div>
        </div>

        {/* ── Right panel ── */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", padding: "40px" }}>
          <div style={{ width: "100%", maxWidth: "500px", background: "#fff", padding: "40px", borderRadius: "24px", boxShadow: "0 10px 40px rgba(0,0,0,.08)" }}>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "28px", color: "#1a1a1a", margin: "0 0 6px", fontWeight: 700 }}>Sign in to your Account</h2>
            <p style={{ color: "#999", fontSize: "14px", margin: "0 0 28px" }}>Enter your details to continue</p>

            {/* API error banner */}
            {apiError && (
              <div className="api-error">
                <span>⚠️</span> {apiError}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

             <div>
  <label
    style={{
      display: "block",
      fontSize: "13px",
      fontWeight: 600,
      color: "#333",
      marginBottom: "8px",
    }}
  >
    Department
  </label>

<Select
  options={DEPARTMENTS}
  value={DEPARTMENTS.find(
    (d) => d.value === department
  )}
  onChange={(selected) => {
    setDepartment(selected?.value || "");
    setErrors((p) => ({
      ...p,
      department: "",
    }));
  }}
  placeholder="Select Department"
/>

  {errors.department && (
    <p className="field-error">
      {errors.department}
    </p>
  )}
</div>

              {/* Email */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#333", marginBottom: "8px" }}>Email ID</label>
                <div style={{
                  ...inputWrap(focused === "email"),
                  border: `1.5px solid ${errors.email ? "#ef4444" : focused === "email" ? "#FFD400" : "#e8e8e8"}`,
                }}>
                  <MailIcon />
                  <input
                    type="email" value={email}
                    onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: "" })); setApiError(""); }}
                    onKeyDown={onKey}
                    placeholder="Enter your email id"
                    onFocus={() => setFocused("email")} onBlur={() => setFocused("")}
                    style={inputStyle}
                  />
                </div>
                {errors.email && <p className="field-error">{errors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#333", marginBottom: "8px" }}>Password</label>
                <div style={{
                  ...inputWrap(focused === "pwd"),
                  border: `1.5px solid ${errors.password ? "#ef4444" : focused === "pwd" ? "#FFD400" : "#e8e8e8"}`,
                }}>
                  <LockIcon />
                  <input
                    type={showPwd ? "text" : "password"} value={password}
                    onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: "" })); setApiError(""); }}
                    onKeyDown={onKey}
                    placeholder="Enter your password"
                    onFocus={() => setFocused("pwd")} onBlur={() => setFocused("")}
                    style={inputStyle}
                  />
                  <button className="eye-btn" onClick={() => setShowPwd(v => !v)}><EyeIcon open={showPwd} /></button>
                </div>
                {errors.password && <p className="field-error">{errors.password}</p>}
              </div>
            </div>

            {/* Forgot password */}
            <div style={{ display: "flex", justifyContent: "flex-end", margin: "16px 0 24px" }}>
              <button className="forgot-link" onClick={() => navigate("/forgot-password")}>
                Forgot Password?
              </button>
            </div>

            <button className="login-btn" onClick={handleLogin} disabled={loading}>
              {loading ? (
                <><div className="spinner" /><span>Signing in...</span></>
              ) : (
                <><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg><span>Login</span></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

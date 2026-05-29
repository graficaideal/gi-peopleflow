import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSignIn = async () => {
    if (!email || !password) return
    setError('')
    setLoading(true)
    const { error: err } = await signIn(email, password)
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    navigate('/')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSignIn()
  }

  return (
    <>
      <style>{`
        @keyframes pf-fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pf-spin {
          to { transform: rotate(360deg); }
        }
        .pf-card {
          animation: pf-fadeUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .pf-input {
          width: 100%;
          height: 48px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 10px;
          color: #fff;
          font-size: 14px;
          font-weight: 400;
          font-family: 'Outfit', sans-serif;
          padding: 0 16px;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .pf-input:focus {
          border-color: #e0cb4b;
          box-shadow: 0 0 0 3px rgba(224,203,75,0.1);
        }
        .pf-input::placeholder {
          color: rgba(255,255,255,0.2);
        }
        .pf-btn {
          width: 100%;
          height: 50px;
          background: #e0cb4b;
          color: #2c3740;
          font-family: 'Outfit', sans-serif;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0.1px;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: opacity 0.15s, transform 0.12s;
        }
        .pf-btn:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
        }
        .pf-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .pf-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .pf-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(44,55,64,0.3);
          border-top-color: #2c3740;
          border-radius: 50%;
          animation: pf-spin 0.7s linear infinite;
          flex-shrink: 0;
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: '#333F48',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Outfit', sans-serif",
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
      }}>

        {/* Ambient glow */}
        <div style={{
          position: 'absolute',
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(224,203,75,0.06) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* Card */}
        <div className="pf-card" style={{
          background: 'rgba(255,255,255,0.035)',
          border: '1px solid rgba(255,255,255,0.075)',
          borderRadius: 20,
          padding: '48px 40px 44px',
          width: '100%',
          maxWidth: 392,
          position: 'relative',
          zIndex: 1,
        }}>

          {/* GI Logo */}
          <svg
            viewBox="0 0 139.71 173.61"
            fill="#e0cb4b"
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: 44, height: 'auto', display: 'block', marginBottom: 24 }}
          >
            <path d="M94.85,0H44.86C20.12,0,0,20.12,0,44.86v42.33h30.27v-42.33c0-8.05,6.54-14.59,14.59-14.59h49.99c8.05,0,14.59,6.54,14.59,14.59v83.66c0,8.05-6.54,14.59-14.59,14.59h-49.99c-8.05,0-14.59-6.54-14.59-14.59v-14.99H0v14.99c0,24.74,20.12,44.86,44.86,44.86h49.99c24.74,0,44.86-20.12,44.86-44.86V44.86C139.71,20.12,119.59,0,94.85,0Z" />
            <path d="M109.44,173.61h30.27v-58.88h-30.27v58.88Z" />
          </svg>

          <h1 style={{
            fontSize: 26,
            fontWeight: 700,
            color: '#fff',
            letterSpacing: '-0.5px',
            marginBottom: 6,
            lineHeight: 1.2,
          }}>
            PeopleFlow
          </h1>
          <p style={{
            fontSize: 14,
            color: 'rgba(255,255,255,0.38)',
            marginBottom: 36,
          }}>
            Aceda à sua conta
          </p>

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.38)',
              textTransform: 'uppercase',
              letterSpacing: '0.7px',
              marginBottom: 8,
            }}>
              Email
            </label>
            <input
              className="pf-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="email@empresa.pt"
              autoComplete="email"
              autoFocus
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: error ? 16 : 28 }}>
            <label style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.38)',
              textTransform: 'uppercase',
              letterSpacing: '0.7px',
              marginBottom: 8,
            }}>
              Password
            </label>
            <input
              className="pf-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(255, 90, 90, 0.08)',
              border: '1px solid rgba(255, 90, 90, 0.18)',
              borderRadius: 8,
              padding: '10px 14px',
              color: '#ff9090',
              fontSize: 13,
              marginBottom: 20,
              lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            className="pf-btn"
            onClick={handleSignIn}
            disabled={loading || !email || !password}
          >
            {loading ? (
              <>
                <span className="pf-spinner" />
                A entrar…
              </>
            ) : (
              'Entrar'
            )}
          </button>

        </div>
      </div>
    </>
  )
}

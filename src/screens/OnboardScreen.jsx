import { useState } from 'react'
import { useGame } from '../context/GameContext'
import { C, AVATARS } from '../lib/theme'

export default function OnboardScreen() {
  const { signInAnonymously, goTo } = useGame()
  const [username, setUsername] = useState('')
  const [avatar, setAvatar] = useState('😈')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleStart = async () => {
    if (!username.trim() || username.trim().length < 2) {
      setError('اكتب اسم من حرفين على الأقل')
      return
    }
    setLoading(true)
    setError('')
    try {
      await signInAnonymously(username.trim(), avatar)
      goTo('home')
    } catch (e) {
      setError('حصل مشكلة، جرب تاني')
      setLoading(false)
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.bigAvatar}>{avatar}</div>
        <h1 style={s.title}>مرحباً في الوجه الآخر</h1>
        <p style={s.sub}>اختار شخصيتك عشان تبدأ اللعب</p>
      </div>

      <div style={s.section}>
        <p style={s.label}>اختار الأفاتار بتاعك</p>
        <div style={s.avatarGrid}>
          {AVATARS.map(a => (
            <button key={a} style={{ ...s.avatarBtn, ...(avatar === a ? s.avatarSelected : {}) }} onClick={() => setAvatar(a)}>
              {a}
            </button>
          ))}
        </div>
      </div>

      <div style={s.section}>
        <p style={s.label}>الاسم اللي هيظهر في بروفايلك</p>
        <input
          style={s.input}
          placeholder="اكتب اسمك هنا..."
          value={username}
          onChange={e => setUsername(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleStart()}
          maxLength={20}
          dir="rtl"
        />
        {error && <p style={s.error}>{error}</p>}
      </div>

      <div style={s.disclaimer}>
        <span>⚠️</span>
        <p>دي لعبة للضحك والتسلية فقط. كل الأسئلة افتراضية ومش بتحكم على أي حد.</p>
      </div>

      <button style={{ ...s.btn, opacity: loading ? 0.6 : 1 }} onClick={handleStart} disabled={loading}>
        {loading ? '...' : 'يلا نبدأ 😈'}
      </button>

      <button style={s.soloBtn} onClick={() => goTo('solo')}>
        🎭 العب لوحدك من غير تسجيل
      </button>

      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        input::placeholder { color: #8888AA; }
        input:focus { outline: none; border-color: #FF3B5C88; }
      `}</style>
    </div>
  )
}

const s = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', padding: '32px 20px', gap: 24, overflowY: 'auto' },
  header: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 },
  bigAvatar: { fontSize: 70, animation: 'float 3s ease-in-out infinite' },
  title: { fontSize: 26, fontWeight: 900, color: '#F0F0FF' },
  sub: { fontSize: 15, color: '#8888AA' },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  label: { fontSize: 14, color: '#8888AA', fontWeight: 600 },
  avatarGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 },
  avatarBtn: {
    background: '#13131A', border: '2px solid #ffffff12', borderRadius: 12,
    padding: 12, fontSize: 24, cursor: 'pointer', transition: 'all 0.2s',
  },
  avatarSelected: { border: '2px solid #FF3B5C', background: '#FF3B5C22', transform: 'scale(1.1)' },
  input: {
    background: '#13131A', border: '2px solid #ffffff12', borderRadius: 12,
    padding: '14px 16px', fontSize: 16, color: '#F0F0FF',
    fontFamily: 'inherit', width: '100%',
    transition: 'border-color 0.2s',
  },
  error: { fontSize: 13, color: '#FF3B5C' },
  disclaimer: {
    display: 'flex', gap: 10, alignItems: 'flex-start',
    background: '#FFD93D15', border: '1px solid #FFD93D40',
    borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#FFD93D', lineHeight: 1.6,
  },
  btn: {
    background: 'linear-gradient(135deg, #FF3B5C, #9B5DE5)',
    color: '#fff', border: 'none', borderRadius: 14, padding: '16px 24px',
    fontSize: 18, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', boxShadow: '0 8px 32px #FF3B5C44',
  },
  soloBtn: {
    background: 'transparent', color: '#8888AA',
    border: '1px solid #ffffff20', borderRadius: 14, padding: '14px 24px',
    fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    marginTop: -8,
  },
}

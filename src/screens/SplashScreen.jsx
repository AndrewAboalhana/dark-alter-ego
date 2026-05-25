import { useEffect } from 'react'
import { useGame } from '../context/GameContext'
import { C } from '../lib/theme'

export default function SplashScreen() {
  const { goTo, user, profile } = useGame()

  useEffect(() => {
    const t = setTimeout(() => {
      goTo(user && profile ? 'home' : 'onboard')
    }, 2500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={s.wrap}>
      <div style={s.logo}>😈</div>
      <h1 style={s.title}>الوجه الآخر</h1>
      <p style={s.sub}>اكتشف الشيطان اللي جوّاك</p>
      <div style={s.bar}><div style={s.fill} /></div>
      <p style={s.disclaimer}>🎮 للتسلية والضحك فقط</p>

      <style>{`
        @keyframes loadFill { from{width:0} to{width:100%} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes glow { 0%,100%{opacity:.4} 50%{opacity:.9} }
      `}</style>
    </div>
  )
}

const s = {
  wrap: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32,
    position: 'relative',
  },
  logo: { fontSize: 90, animation: 'float 3s ease-in-out infinite', filter: 'drop-shadow(0 0 30px #FF3B5C88)' },
  title: { fontSize: 48, fontWeight: 900, color: C.text, letterSpacing: -1, textShadow: `0 0 40px ${C.red}99` },
  sub: { fontSize: 18, color: C.muted },
  bar: { width: 160, height: 3, background: '#ffffff15', borderRadius: 4, overflow: 'hidden', marginTop: 8 },
  fill: { height: '100%', background: `linear-gradient(90deg, ${C.red}, ${C.purple})`, animation: 'loadFill 2.3s ease-in-out forwards', borderRadius: 4 },
  disclaimer: { fontSize: 13, color: '#ffffff30', marginTop: 8 },
}

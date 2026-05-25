import { useState, useEffect } from 'react'
import { useGame } from '../context/GameContext'
import { supabase } from '../lib/supabase'
import { getEvilLevel, EVIL_LEVELS } from '../lib/theme'

export default function ResultScreen() {
  const { room, myPlayer, profile, goTo, fetchProfile } = useGame()
  const [players, setPlayers] = useState([])
  const [myFinalScore, setMyFinalScore] = useState(0)

  useEffect(() => {
    if (!room) return
    fetchResults()
  }, [])

  const fetchResults = async () => {
    const { data } = await supabase
      .from('room_players')
      .select('*')
      .eq('room_id', room.id)
      .order('evil_score', { ascending: false })
    setPlayers(data || [])

    const me = data?.find(p => p.id === myPlayer?.id)
    if (me) {
      setMyFinalScore(me.evil_score || 0)
      // Update global profile
      const newScore = Math.min(100, (profile?.evil_score || 0) + (me.evil_score || 0))
      await supabase.from('profiles').update({
        evil_score: newScore,
        games_played: (profile?.games_played || 0) + 1,
        highest_evil: Math.max(profile?.highest_evil || 0, me.evil_score || 0),
      }).eq('id', profile.id)
      await fetchProfile(profile.id)
    }
  }

  const evilInfo = getEvilLevel(myFinalScore)

  const playAgain = async () => {
    await supabase.from('rooms').update({ status: 'waiting', current_question_index: 0 }).eq('id', room.id)
    await supabase.from('room_players').update({ evil_score: 0, has_answered: false, is_ready: false }).eq('room_id', room.id)
    goTo('lobby')
  }

  const share = () => {
    const text = `لعبت "الوجه الآخر" ومستوى شيطانيتي ${myFinalScore}% — ${evilInfo.label} ${evilInfo.emoji}\nجرب أنت كمان!`
    if (navigator.share) navigator.share({ text })
    else navigator.clipboard.writeText(text)
  }

  return (
    <div style={s.wrap}>
      <div style={s.glow} />

      <div style={s.heroEmoji}>{evilInfo.emoji}</div>
      <h1 style={s.title}>النتيجة النهائية</h1>

      {/* My Score */}
      <div style={s.myScoreBox}>
        <p style={s.myScoreLabel}>مستوى شيطانيتك</p>
        <div style={s.meterBar}>
          <div style={{ ...s.meterFill, width: `${myFinalScore}%`, background: evilInfo.color }} />
        </div>
        <p style={{ ...s.myScoreValue, color: evilInfo.color }}>{evilInfo.label}</p>
        <p style={s.myScoreNum}>{myFinalScore}%</p>
      </div>

      {/* Leaderboard */}
      <div style={s.leaderboard}>
        <p style={s.lbTitle}>🏆 ترتيب الشياطين</p>
        {players.map((p, idx) => {
          const lvl = getEvilLevel(p.evil_score || 0)
          return (
            <div key={p.id} style={{ ...s.lbCard, border: idx === 0 ? '2px solid #FFD93D' : '1px solid #ffffff12' }}>
              <span style={s.lbRank}>#{idx + 1}</span>
              <div style={{ ...s.lbAvatar, background: p.anonymous_color + '22' }}>{p.anonymous_avatar}</div>
              <div style={s.lbInfo}>
                <p style={s.lbName}>{p.anonymous_name}</p>
                <p style={{ color: lvl.color, fontSize: 12 }}>{lvl.label}</p>
              </div>
              <span style={{ ...s.lbScore, color: lvl.color }}>{p.evil_score || 0}%</span>
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div style={s.actions}>
        <button style={s.shareBtn} onClick={share}>📤 شارك نتيجتك</button>
        <button style={s.playAgainBtn} onClick={playAgain}>🔄 العب تاني</button>
        <button style={s.homeBtn} onClick={() => goTo('home')}>🏠 الرئيسية</button>
      </div>

      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}} @keyframes glow{0%,100%{opacity:.4}50%{opacity:.9}}`}</style>
    </div>
  )
}

const s = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 20px', gap: 16, alignItems: 'center', overflowY: 'auto', position: 'relative', width: '100%' },
  glow: { position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, #FF3B5C30, transparent 70%)', pointerEvents: 'none', animation: 'glow 4s infinite' },
  heroEmoji: { fontSize: 80, animation: 'float 3s ease-in-out infinite', filter: 'drop-shadow(0 0 30px #FF3B5C88)' },
  title: { fontSize: 32, fontWeight: 900, color: '#F0F0FF' },
  myScoreBox: { background: '#13131A', borderRadius: 20, padding: 20, width: '100%', border: '1px solid #ffffff12', textAlign: 'center' },
  myScoreLabel: { fontSize: 14, color: '#8888AA', marginBottom: 12 },
  meterBar: { height: 10, background: '#ffffff10', borderRadius: 6, overflow: 'hidden', marginBottom: 12 },
  meterFill: { height: '100%', borderRadius: 6, transition: 'width 1.5s ease' },
  myScoreValue: { fontSize: 22, fontWeight: 900, marginBottom: 4 },
  myScoreNum: { fontSize: 14, color: '#8888AA' },
  leaderboard: { width: '100%', display: 'flex', flexDirection: 'column', gap: 8 },
  lbTitle: { fontSize: 18, fontWeight: 900, color: '#F0F0FF', marginBottom: 4 },
  lbCard: { display: 'flex', alignItems: 'center', gap: 12, background: '#13131A', borderRadius: 14, padding: '12px 14px' },
  lbRank: { fontSize: 18, fontWeight: 900, color: '#8888AA', width: 28 },
  lbAvatar: { width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 },
  lbInfo: { flex: 1 },
  lbName: { fontSize: 15, fontWeight: 700, color: '#F0F0FF' },
  lbScore: { fontSize: 20, fontWeight: 900 },
  actions: { display: 'flex', flexDirection: 'column', gap: 10, width: '100%' },
  shareBtn: { background: '#00BBF922', border: '1px solid #00BBF944', color: '#00BBF9', borderRadius: 14, padding: '14px', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  playAgainBtn: { background: 'linear-gradient(135deg, #FF3B5C, #9B5DE5)', color: '#fff', border: 'none', borderRadius: 14, padding: '16px', fontSize: 17, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 32px #FF3B5C44' },
  homeBtn: { background: 'transparent', border: '1px solid #ffffff12', color: '#8888AA', borderRadius: 14, padding: '14px', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' },
}

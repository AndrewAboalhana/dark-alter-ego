import { useState } from 'react'
import { useGame } from '../context/GameContext'
import { C, getEvilLevel } from '../lib/theme'
import { supabase } from '../lib/supabase'

export default function HomeScreen() {
  const { profile, goTo, setRoom, setMyPlayer } = useGame()
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [loading, setLoading] = useState('')

  const evilInfo = getEvilLevel(profile?.evil_score || 0)

  const createRoom = async () => {
    setLoading('create')
    try {
      const code = Math.random().toString(36).slice(2, 6).toUpperCase()
      const { data: room, error } = await supabase
        .from('rooms')
        .insert({ code, host_id: profile.id, status: 'waiting' })
        .select().single()
      if (error) throw error

      const anonName = `${profile.username}`
      const { data: player } = await supabase
        .from('room_players')
        .insert({
          room_id: room.id,
          user_id: profile.id,
          anonymous_name: 'المجهول_1',
          anonymous_avatar: profile.avatar_emoji,
          anonymous_color: '#FF3B5C',
          is_ready: false,
        })
        .select().single()

      setRoom(room)
      setMyPlayer(player)
      goTo('lobby')
    } catch (e) {
      console.error(e)
    }
    setLoading('')
  }

  const joinRoom = async () => {
    if (!joinCode.trim()) return
    setLoading('join')
    setJoinError('')
    try {
      const { data: room, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', joinCode.toUpperCase().trim())
        .eq('status', 'waiting')
        .single()

      if (error || !room) { setJoinError('كود غلط أو الأوضة مش موجودة'); setLoading(''); return }

      const { data: existing } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_id', room.id)
        .eq('user_id', profile.id)
        .single()

      if (existing) { setRoom(room); setMyPlayer(existing); goTo('lobby'); return }

      const { data: players } = await supabase
        .from('room_players')
        .select('id')
        .eq('room_id', room.id)

      const num = (players?.length || 0) + 1
      const colors = ['#9B5DE5', '#00BBF9', '#FFD93D', '#00F5A0', '#FF6B35', '#F72585', '#4CC9F0']
      const { data: player } = await supabase
        .from('room_players')
        .insert({
          room_id: room.id,
          user_id: profile.id,
          anonymous_name: `المجهول_${num}`,
          anonymous_avatar: profile.avatar_emoji,
          anonymous_color: colors[num % colors.length],
          is_ready: false,
        })
        .select().single()

      setRoom(room)
      setMyPlayer(player)
      goTo('lobby')
    } catch (e) {
      setJoinError('حصل مشكلة، جرب تاني')
    }
    setLoading('')
  }

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.avatarWrap}>
          <div style={s.avatar}>{profile?.avatar_emoji}</div>
          <div style={{ ...s.evilBadge, background: evilInfo.color + '22', border: `1px solid ${evilInfo.color}44`, color: evilInfo.color }}>
            {evilInfo.emoji} {evilInfo.label}
          </div>
        </div>
        <div>
          <p style={s.username}>{profile?.username}</p>
          <p style={s.stats}>{profile?.games_played || 0} لعبة • {profile?.evil_score || 0} نقطة شيطانية</p>
        </div>
      </div>

      {/* Evil Meter */}
      <div style={s.meterBox}>
        <div style={s.meterHeader}>
          <span style={s.meterLabel}>مستوى الشيطنة الكلي</span>
          <span style={{ color: evilInfo.color, fontWeight: 700 }}>{profile?.evil_score || 0}%</span>
        </div>
        <div style={s.meterBar}>
          <div style={{ ...s.meterFill, width: `${profile?.evil_score || 0}%`, background: evilInfo.color }} />
        </div>
      </div>

      {/* Buttons */}
      <div style={s.section}>
        <button style={s.btnPrimary} onClick={createRoom} disabled={loading === 'create'}>
          {loading === 'create' ? '...' : '👥 أنشئ أوضة جديدة'}
        </button>

        <div style={s.joinRow}>
          <input
            style={s.input}
            placeholder="كود الأوضة..."
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && joinRoom()}
            maxLength={6}
            dir="ltr"
          />
          <button style={s.btnJoin} onClick={joinRoom} disabled={loading === 'join'}>
            {loading === 'join' ? '...' : 'دخول'}
          </button>
        </div>
        {joinError && <p style={s.error}>{joinError}</p>}

        <button style={s.btnGhost} onClick={() => goTo('solo')}>
          🌍 العب مع غرباء
        </button>
      </div>

      {/* Stats Row */}
      <div style={s.statsRow}>
        {[['😈', 'العبة', '12K+'], ['🎯', 'سؤال', '98'], ['⭐', 'تقييم', '4.8']].map(([icon, label, val]) => (
          <div key={label} style={s.statBox}>
            <span style={s.statIcon}>{icon}</span>
            <span style={s.statNum}>{val}</span>
            <span style={s.statLabel}>{label}</span>
          </div>
        ))}
      </div>

      <style>{`input:focus{outline:none;border-color:#FF3B5C88;} input::placeholder{color:#8888AA;} @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`}</style>
    </div>
  )
}

const s = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 20px', gap: 20, overflowY: 'auto' },
  header: { display: 'flex', alignItems: 'center', gap: 14, background: '#13131A', borderRadius: 16, padding: 16, border: '1px solid #ffffff12' },
  avatarWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  avatar: { fontSize: 44, animation: 'float 3s ease-in-out infinite' },
  evilBadge: { fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' },
  username: { fontSize: 20, fontWeight: 900, color: '#F0F0FF' },
  stats: { fontSize: 13, color: '#8888AA', marginTop: 4 },
  meterBox: { background: '#13131A', borderRadius: 14, padding: 16, border: '1px solid #ffffff12' },
  meterHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 10 },
  meterLabel: { fontSize: 14, color: '#8888AA' },
  meterBar: { height: 8, background: '#ffffff10', borderRadius: 4, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 4, transition: 'width 1s ease' },
  section: { display: 'flex', flexDirection: 'column', gap: 12 },
  btnPrimary: {
    background: 'linear-gradient(135deg, #FF3B5C, #9B5DE5)',
    color: '#fff', border: 'none', borderRadius: 14, padding: '16px 24px',
    fontSize: 17, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: '0 8px 32px #FF3B5C44',
  },
  joinRow: { display: 'flex', gap: 10 },
  input: {
    flex: 1, background: '#13131A', border: '2px solid #ffffff12', borderRadius: 12,
    padding: '14px 16px', fontSize: 16, color: '#F0F0FF', fontFamily: 'inherit',
    letterSpacing: 4, textAlign: 'center', transition: 'border-color 0.2s',
  },
  btnJoin: {
    background: '#1A1A25', color: '#F0F0FF', border: '2px solid #ffffff12',
    borderRadius: 12, padding: '14px 20px', fontSize: 16, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  error: { fontSize: 13, color: '#FF3B5C' },
  btnGhost: {
    background: 'transparent', color: '#8888AA', border: '1px solid #ffffff12',
    borderRadius: 14, padding: '14px 24px', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit',
  },
  statsRow: { display: 'flex', background: '#13131A', borderRadius: 14, border: '1px solid #ffffff12', overflow: 'hidden' },
  statBox: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '14px 0' },
  statIcon: { fontSize: 20 },
  statNum: { fontSize: 18, fontWeight: 900, color: '#F0F0FF' },
  statLabel: { fontSize: 12, color: '#8888AA' },
}

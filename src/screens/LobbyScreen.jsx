import { useState, useEffect } from 'react'
import { useGame } from '../context/GameContext'
import { C } from '../lib/theme'
import { supabase } from '../lib/supabase'

export default function LobbyScreen() {
  const { room, myPlayer, profile, goTo, setRoom } = useGame()
  const [players, setPlayers] = useState([])
  const [copied, setCopied] = useState(false)
  const isHost = room?.host_id === profile?.id

  useEffect(() => {
    if (!room) return
    fetchPlayers()

    const channel = supabase
      .channel(`lobby:${room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${room.id}` }, fetchPlayers)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, ({ new: updatedRoom }) => {
        setRoom(updatedRoom)
        if (updatedRoom.status === 'playing') goTo('game')
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [room?.id])

  const fetchPlayers = async () => {
    const { data } = await supabase
      .from('room_players')
      .select('*')
      .eq('room_id', room.id)
      .order('joined_at', { ascending: true })
    setPlayers(data || [])
  }

  const toggleReady = async () => {
    await supabase
      .from('room_players')
      .update({ is_ready: !myPlayer.is_ready })
      .eq('id', myPlayer.id)
  }

  const startGame = async () => {
    const { data: questions } = await supabase
      .from('questions')
      .select('id')
      .eq('is_active', true)
      .order('play_count', { ascending: true })
      .limit(7)

    if (!questions?.length) return

    await supabase.from('rooms').update({
      status: 'playing',
      current_question_index: 0,
      current_question_id: questions[0].id,
    }).eq('id', room.id)
  }

  const copyCode = () => {
    navigator.clipboard.writeText(room?.code || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const leaveRoom = async () => {
    await supabase.from('room_players').delete().eq('id', myPlayer?.id)
    goTo('home')
  }

  const allReady = players.length > 1 && players.every(p => p.is_ready || p.user_id === room?.host_id)

  return (
    <div style={s.wrap}>
      <div style={s.topBar}>
        <button style={s.backBtn} onClick={leaveRoom}>← خروج</button>
        <h2 style={s.title}>الأوضة</h2>
        <div style={s.placeholder} />
      </div>

      {/* Room Code */}
      <div style={s.codeBox}>
        <p style={s.codeLabel}>كود الأوضة</p>
        <div style={s.code}>{room?.code}</div>
        <button style={s.copyBtn} onClick={copyCode}>
          {copied ? '✅ اتنسخ' : '📋 انسخ الكود'}
        </button>
      </div>

      {/* Players */}
      <div style={s.section}>
        <p style={s.sectionLabel}>اللاعبين ({players.length}/{room?.max_players})</p>
        <div style={s.playersList}>
          {players.map(p => (
            <div key={p.id} style={s.playerCard}>
              <div style={{ ...s.playerAvatar, background: p.anonymous_color + '22', border: `2px solid ${p.anonymous_color}` }}>
                {p.anonymous_avatar}
              </div>
              <div style={s.playerInfo}>
                <p style={s.playerName}>{p.anonymous_name}</p>
                {p.user_id === room?.host_id && <span style={s.hostBadge}>المضيف</span>}
              </div>
              <div style={{ ...s.readyBadge, color: p.is_ready || p.user_id === room?.host_id ? '#00F5A0' : '#8888AA' }}>
                {p.is_ready || p.user_id === room?.host_id ? '✅ جاهز' : '⏳ لسه'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={s.actions}>
        {!isHost && (
          <button
            style={{ ...s.readyBtn, background: myPlayer?.is_ready ? '#00F5A022' : 'linear-gradient(135deg, #FF3B5C, #9B5DE5)', border: myPlayer?.is_ready ? '2px solid #00F5A0' : 'none', color: myPlayer?.is_ready ? '#00F5A0' : '#fff' }}
            onClick={toggleReady}
          >
            {myPlayer?.is_ready ? '✅ جاهز' : 'أنا جاهز 👍'}
          </button>
        )}

        {isHost && (
          <button
            style={{ ...s.startBtn, opacity: allReady || players.length >= 2 ? 1 : 0.5 }}
            onClick={startGame}
            disabled={players.length < 2}
          >
            🎮 ابدأ اللعبة
          </button>
        )}
      </div>

      {players.length < 2 && (
        <p style={s.waitingText}>في انتظار لاعب واحد على الأقل...</p>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  )
}

const s = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', gap: 16, overflowY: 'auto' },
  topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { background: 'transparent', border: '1px solid #ffffff12', color: '#8888AA', borderRadius: 10, padding: '8px 14px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  title: { fontSize: 22, fontWeight: 900, color: '#F0F0FF' },
  placeholder: { width: 80 },
  codeBox: { background: '#13131A', borderRadius: 16, padding: 20, textAlign: 'center', border: '1px solid #ffffff12' },
  codeLabel: { fontSize: 13, color: '#8888AA', marginBottom: 8 },
  code: { fontSize: 48, fontWeight: 900, letterSpacing: 10, background: 'linear-gradient(135deg, #FF3B5C, #9B5DE5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 12 },
  copyBtn: { background: '#1A1A25', border: '1px solid #ffffff12', color: '#8888AA', borderRadius: 10, padding: '8px 20px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionLabel: { fontSize: 14, color: '#8888AA', fontWeight: 600 },
  playersList: { display: 'flex', flexDirection: 'column', gap: 8 },
  playerCard: { display: 'flex', alignItems: 'center', gap: 12, background: '#13131A', borderRadius: 12, padding: '12px 14px', border: '1px solid #ffffff12' },
  playerAvatar: { width: 42, height: 42, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 },
  playerInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  playerName: { fontSize: 16, fontWeight: 700, color: '#F0F0FF' },
  hostBadge: { fontSize: 11, color: '#FFD93D', background: '#FFD93D22', padding: '2px 8px', borderRadius: 6, alignSelf: 'flex-start' },
  readyBadge: { fontSize: 13, fontWeight: 600 },
  actions: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' },
  readyBtn: { borderRadius: 14, padding: '16px 24px', fontSize: 17, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  startBtn: { background: 'linear-gradient(135deg, #FF3B5C, #9B5DE5)', color: '#fff', border: 'none', borderRadius: 14, padding: '16px 24px', fontSize: 17, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 32px #FF3B5C44' },
  waitingText: { textAlign: 'center', fontSize: 14, color: '#8888AA', animation: 'pulse 2s ease-in-out infinite' },
}

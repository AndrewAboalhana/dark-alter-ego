import { useState, useEffect, useCallback } from 'react'
import { useGame } from '../context/GameContext'
import { C, LEVEL_CONFIG } from '../lib/theme'
import { supabase } from '../lib/supabase'

const LEVEL_OPTIONS = [
  { val: 0, label: 'كل المستويات', emoji: '🎲', desc: 'مزيج من الكل' },
  { val: 1, label: 'دافئ',          emoji: '🟡', desc: LEVEL_CONFIG[1].label },
  { val: 2, label: 'ساخن',          emoji: '🟠', desc: LEVEL_CONFIG[2].label },
  { val: 3, label: 'حارق',          emoji: '🔴', desc: LEVEL_CONFIG[3].label },
  { val: 4, label: 'جهنمي',         emoji: '💀', desc: 'مش لضعاف القلوب' },
]

const Q_PER_GAME_OPTIONS = [5, 7, 10]

export default function LobbyScreen() {
  const { room, myPlayer, profile, goTo, setRoom } = useGame()
  const [players, setPlayers] = useState([])
  const [copied, setCopied] = useState(false)
  const [levelFilter, setLevelFilter] = useState(room?.level_filter || 0)
  const [questionsPerGame, setQuestionsPerGame] = useState(room?.questions_per_game || 7)
  const [questionsCount, setQuestionsCount] = useState(null)
  const isHost = room?.host_id === profile?.id

  useEffect(() => {
    if (!room) return
    fetchPlayers()
    fetchQuestionsCount(levelFilter)

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

  // Refresh questions count when level filter changes
  useEffect(() => {
    fetchQuestionsCount(levelFilter)
  }, [levelFilter])

  const fetchPlayers = async () => {
    const { data } = await supabase
      .from('room_players')
      .select('*')
      .eq('room_id', room.id)
      .order('joined_at', { ascending: true })
    setPlayers(data || [])
  }

  const fetchQuestionsCount = useCallback(async (level) => {
    setQuestionsCount(null) // loading
    let query = supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
    if (level > 0) query = query.eq('level', level)
    const { count } = await query
    setQuestionsCount(count || 0)
  }, [])

  const toggleReady = async () => {
    await supabase
      .from('room_players')
      .update({ is_ready: !myPlayer.is_ready })
      .eq('id', myPlayer.id)
  }

  const startGame = async () => {
    const actualQCount = Math.min(questionsPerGame, questionsCount || questionsPerGame)

    // Stable sort by id — deterministic regardless of play_count ties
    let query = supabase
      .from('questions')
      .select('id')
      .eq('is_active', true)
      .order('id', { ascending: true })
      .limit(1)

    if (levelFilter > 0) {
      query = supabase
        .from('questions')
        .select('id')
        .eq('is_active', true)
        .eq('level', levelFilter)
        .order('id', { ascending: true })
        .limit(1)
    }

    const { data: questions } = await query
    if (!questions?.length) return

    await supabase.from('rooms').update({
      status: 'playing',
      current_question_index: 0,
      current_question_id: questions[0].id,
      level_filter: levelFilter,
      questions_per_game: actualQCount,
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

  // Clamp questionsPerGame to available count
  const effectiveQPerGame = questionsCount !== null && questionsCount < questionsPerGame
    ? questionsCount
    : questionsPerGame

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

      {/* Stats row */}
      <div style={s.statsRow}>
        <div style={s.statCard}>
          <span style={s.statNum}>{players.length}</span>
          <span style={s.statLabel}>لاعب متصل</span>
        </div>
        <div style={s.statCard}>
          <span style={s.statNum}>
            {questionsCount === null ? '...' : questionsCount}
          </span>
          <span style={s.statLabel}>سؤال متاح</span>
        </div>
        <div style={s.statCard}>
          <span style={s.statNum}>{effectiveQPerGame}</span>
          <span style={s.statLabel}>سؤال في اللعبة</span>
        </div>
      </div>

      {/* Level selector — host only */}
      {isHost && (
        <div style={s.section}>
          <p style={s.sectionLabel}>🌑 مستوى الظلام</p>
          <div style={s.levelRow}>
            {LEVEL_OPTIONS.map(opt => {
              const active = levelFilter === opt.val
              const col = opt.val === 0 ? '#9B5DE5' : LEVEL_CONFIG[opt.val]?.color || '#9B5DE5'
              return (
                <button
                  key={opt.val}
                  style={{
                    ...s.levelBtn,
                    borderColor: active ? col : '#ffffff15',
                    background: active ? col + '22' : '#0D0D14',
                    color: active ? col : '#6A6A9A',
                  }}
                  onClick={() => setLevelFilter(opt.val)}
                >
                  <span style={{ fontSize: 18 }}>{opt.emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Questions per game selector — host only */}
      {isHost && (
        <div style={s.section}>
          <p style={s.sectionLabel}>🃏 عدد الأسئلة</p>
          <div style={s.qRow}>
            {Q_PER_GAME_OPTIONS.map(n => {
              const active = questionsPerGame === n
              const unavailable = questionsCount !== null && questionsCount < n
              return (
                <button
                  key={n}
                  style={{
                    ...s.qBtn,
                    borderColor: active ? '#FF3B5C' : '#ffffff15',
                    background: active ? '#FF3B5C22' : '#0D0D14',
                    color: active ? '#FF3B5C' : unavailable ? '#ffffff30' : '#6A6A9A',
                    cursor: unavailable ? 'not-allowed' : 'pointer',
                  }}
                  onClick={() => !unavailable && setQuestionsPerGame(n)}
                  disabled={unavailable}
                >
                  <span style={{ fontSize: 20, fontWeight: 900 }}>{n}</span>
                  <span style={{ fontSize: 10 }}>سؤال</span>
                </button>
              )
            })}
          </div>
          {questionsCount !== null && questionsCount < questionsPerGame && (
            <p style={s.qWarning}>⚠️ مفيش {questionsPerGame} أسئلة في هذا المستوى. هيتلعب {questionsCount}</p>
          )}
        </div>
      )}

      {/* Non-host sees the chosen level & count */}
      {!isHost && (
        <div style={s.guestInfo}>
          <div style={s.guestInfoRow}>
            <span style={{ color: '#6A6A9A', fontSize: 13 }}>مستوى الظلام: </span>
            <span style={{ fontWeight: 700, color: '#EEEEFF', fontSize: 13 }}>
              {LEVEL_OPTIONS.find(o => o.val === (room?.level_filter || 0))?.emoji}{' '}
              {LEVEL_OPTIONS.find(o => o.val === (room?.level_filter || 0))?.label}
            </span>
          </div>
          <div style={s.guestInfoRow}>
            <span style={{ color: '#6A6A9A', fontSize: 13 }}>عدد الأسئلة: </span>
            <span style={{ fontWeight: 700, color: '#EEEEFF', fontSize: 13 }}>
              {room?.questions_per_game || 7} أسئلة
            </span>
          </div>
        </div>
      )}

      {/* Players */}
      <div style={s.section}>
        <p style={s.sectionLabel}>👥 اللاعبين ({players.length}/{room?.max_players})</p>
        <div style={s.playersList}>
          {players.map(p => (
            <div key={p.id} style={s.playerCard}>
              <div style={{ ...s.playerAvatar, background: p.anonymous_color + '22', border: `2px solid ${p.anonymous_color}66` }}>
                {p.anonymous_avatar}
              </div>
              <div style={s.playerInfo}>
                <p style={s.playerName}>{p.anonymous_name}</p>
                {p.user_id === room?.host_id && <span style={s.hostBadge}>المضيف</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                {/* Online indicator */}
                <div style={s.onlineDot} title="متصل" />
                <div style={{ ...s.readyBadge, color: p.is_ready || p.user_id === room?.host_id ? '#00F5A0' : '#6A6A9A' }}>
                  {p.is_ready || p.user_id === room?.host_id ? '✅ جاهز' : '⏳ لسه'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={s.actions}>
        {!isHost && (
          <button
            style={{
              ...s.readyBtn,
              background: myPlayer?.is_ready ? '#00F5A022' : 'linear-gradient(135deg, #FF3B5C, #9B5DE5)',
              border: myPlayer?.is_ready ? '2px solid #00F5A0' : 'none',
              color: myPlayer?.is_ready ? '#00F5A0' : '#fff',
            }}
            onClick={toggleReady}
          >
            {myPlayer?.is_ready ? '✅ جاهز' : 'أنا جاهز 👍'}
          </button>
        )}

        {isHost && (
          <button
            style={{ ...s.startBtn, opacity: players.length >= 2 ? 1 : 0.5 }}
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
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', gap: 14, overflowY: 'auto', background: '#060609' },
  topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { background: 'transparent', border: '1px solid #ffffff15', color: '#6A6A9A', borderRadius: 10, padding: '8px 14px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  title: { fontSize: 22, fontWeight: 900, color: '#EEEEFF' },
  placeholder: { width: 80 },
  codeBox: { background: '#0D0D14', borderRadius: 16, padding: 20, textAlign: 'center', border: '1px solid #ffffff15', boxShadow: '0 0 40px #9B5DE518' },
  codeLabel: { fontSize: 13, color: '#6A6A9A', marginBottom: 8 },
  code: { fontSize: 48, fontWeight: 900, letterSpacing: 10, background: 'linear-gradient(135deg, #FF3B5C, #9B5DE5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 12 },
  copyBtn: { background: '#111120', border: '1px solid #ffffff15', color: '#6A6A9A', borderRadius: 10, padding: '8px 20px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  statsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 },
  statCard: { background: '#0D0D14', borderRadius: 12, padding: '12px 8px', border: '1px solid #ffffff10', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  statNum: { fontSize: 22, fontWeight: 900, color: '#EEEEFF' },
  statLabel: { fontSize: 11, color: '#6A6A9A', textAlign: 'center' },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionLabel: { fontSize: 14, color: '#6A6A9A', fontWeight: 700 },
  levelRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  levelBtn: { flex: 1, minWidth: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 6px', border: '1px solid', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' },
  qRow: { display: 'flex', gap: 8 },
  qBtn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '12px 8px', border: '1px solid', borderRadius: 12, fontFamily: 'inherit', transition: 'all 0.2s' },
  qWarning: { fontSize: 12, color: '#FFD93D', background: '#FFD93D12', borderRadius: 8, padding: '8px 12px', margin: 0 },
  guestInfo: { background: '#0D0D14', borderRadius: 12, padding: '12px 14px', border: '1px solid #ffffff15', display: 'flex', flexDirection: 'column', gap: 8 },
  guestInfoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  playersList: { display: 'flex', flexDirection: 'column', gap: 8 },
  playerCard: { display: 'flex', alignItems: 'center', gap: 12, background: '#0D0D14', borderRadius: 12, padding: '12px 14px', border: '1px solid #ffffff15' },
  playerAvatar: { width: 42, height: 42, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 },
  playerInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  playerName: { fontSize: 16, fontWeight: 700, color: '#EEEEFF' },
  hostBadge: { fontSize: 11, color: '#FFD93D', background: '#FFD93D22', padding: '2px 8px', borderRadius: 6, alignSelf: 'flex-start' },
  onlineDot: { width: 8, height: 8, borderRadius: '50%', background: '#00F5A0', boxShadow: '0 0 6px #00F5A0aa' },
  readyBadge: { fontSize: 13, fontWeight: 600 },
  actions: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' },
  readyBtn: { borderRadius: 14, padding: '16px 24px', fontSize: 17, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  startBtn: { background: 'linear-gradient(135deg, #FF3B5C, #9B5DE5)', color: '#fff', border: 'none', borderRadius: 14, padding: '16px 24px', fontSize: 17, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 32px #FF3B5C44' },
  waitingText: { textAlign: 'center', fontSize: 14, color: '#6A6A9A', animation: 'pulse 2s ease-in-out infinite' },
}

import { useState, useEffect, useRef } from 'react'
import { useGame } from '../context/GameContext'
import { supabase } from '../lib/supabase'
import { C, LEVEL_CONFIG, getEvilLevel } from '../lib/theme'
import { getAnswersForQuestion } from '../lib/questions'

export default function GameScreen() {
  const { room, myPlayer, profile, goTo, setRoom } = useGame()
  const [question, setQuestion] = useState(null)
  const [players, setPlayers] = useState([])
  const [answers, setAnswers] = useState([])
  const [myAnswer, setMyAnswer] = useState(null)
  const [customText, setCustomText] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [phase, setPhase] = useState('answering') // answering | voting | reveal
  const [timeLeft, setTimeLeft] = useState(30)
  const [cardFlipped, setCardFlipped] = useState(false)
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [showChat, setShowChat] = useState(false)
  const [evilScore, setEvilScore] = useState(0)
  const [friendRequests, setFriendRequests] = useState([])
  const timerRef = useRef(null)
  const chatEndRef = useRef(null)

  useEffect(() => {
    if (!room) return
    fetchCurrentQuestion()
    fetchPlayers()
    fetchAnswers()
    fetchMessages()

    const channel = supabase
      .channel(`game:${room.id}:${room.current_question_id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, ({ new: r }) => {
        setRoom(r)
        if (r.status === 'finished') { goTo('result'); return }
        if (r.current_question_id !== room.current_question_id) {
          fetchCurrentQuestion(r.current_question_id)
          setMyAnswer(null)
          setAnswers([])
          setPhase('answering')
          setCardFlipped(false)
          setTimeLeft(30)
          setCustomText('')
          setShowCustom(false)
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'answers', filter: `room_id=eq.${room.id}` }, fetchAnswers)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${room.id}` }, fetchMessages)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes', filter: `room_id=eq.${room.id}` }, fetchAnswers)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [room?.id, room?.current_question_id])

  // Timer
  useEffect(() => {
    if (phase !== 'answering' || !cardFlipped) return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); setPhase('voting'); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [phase, cardFlipped])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchCurrentQuestion = async (qId) => {
    const id = qId || room?.current_question_id
    if (!id) return
    const { data } = await supabase.from('questions').select('*').eq('id', id).single()
    setQuestion(data)
    if (data) setTimeLeft(LEVEL_CONFIG[data.level]?.time || 30)
  }

  const fetchPlayers = async () => {
    const { data } = await supabase.from('room_players').select('*').eq('room_id', room.id)
    setPlayers(data || [])
  }

  const fetchAnswers = async () => {
    const { data } = await supabase
      .from('answers')
      .select('*, votes(count)')
      .eq('room_id', room.id)
      .eq('question_id', room.current_question_id)
    setAnswers(data || [])
  }

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true })
      .limit(50)
    setMessages(data || [])
  }

  const submitAnswer = async (text, isCustom = false) => {
    if (myAnswer) return
    const weight = question?.level || 1
    const { data } = await supabase.from('answers').insert({
      room_id: room.id,
      question_id: question.id,
      player_id: myPlayer.id,
      answer_text: text,
      is_custom: isCustom,
      evil_weight: weight,
    }).select().single()

    setMyAnswer(data)
    setEvilScore(s => Math.min(100, s + weight * 8))
    clearInterval(timerRef.current)

    // Check all answered using answers table (not has_answered — RLS blocks bulk reset)
    const { data: allAnswers } = await supabase
      .from('answers')
      .select('id')
      .eq('room_id', room.id)
      .eq('question_id', question.id)

    const { data: allPlayers } = await supabase
      .from('room_players')
      .select('id')
      .eq('room_id', room.id)

    if ((allAnswers?.length || 0) >= (allPlayers?.length || 1)) setPhase('voting')
  }

  const submitCustom = () => {
    if (!customText.trim()) return
    submitAnswer(customText.trim(), true)
    setShowCustom(false)
  }

  const voteAnswer = async (answerId) => {
    await supabase.from('votes').insert({
      answer_id: answerId,
      voter_player_id: myPlayer.id,
      room_id: room.id,
    })
    setPhase('reveal')
  }

  // ── Fix: stable sort + range(index) + level filter — no more stale play_count ordering ──
  const nextQuestion = async () => {
    if (room.host_id !== profile.id) return
    const nextIdx = (room.current_question_index || 0) + 1

    if (nextIdx >= (room.questions_per_game || 7)) {
      await supabase.from('rooms').update({ status: 'finished' }).eq('id', room.id)
      goTo('result')
      return
    }

    let query = supabase
      .from('questions')
      .select('id')
      .eq('is_active', true)
      .order('id', { ascending: true })   // stable, deterministic
      .range(nextIdx, nextIdx)            // exactly one row at this offset

    if (room.level_filter && room.level_filter > 0) {
      query = supabase
        .from('questions')
        .select('id')
        .eq('is_active', true)
        .eq('level', room.level_filter)
        .order('id', { ascending: true })
        .range(nextIdx, nextIdx)
    }

    const { data: q } = await query
    const nextQuestionId = q?.[0]?.id

    if (!nextQuestionId) {
      // No more questions at this offset — finish game
      await supabase.from('rooms').update({ status: 'finished' }).eq('id', room.id)
      goTo('result')
      return
    }

    await supabase.from('rooms').update({
      current_question_index: nextIdx,
      current_question_id: nextQuestionId,
    }).eq('id', room.id)
  }

  const sendMessage = async () => {
    if (!chatInput.trim()) return
    await supabase.from('messages').insert({
      room_id: room.id,
      player_id: myPlayer.id,
      anonymous_name: myPlayer.anonymous_name,
      anonymous_avatar: myPlayer.anonymous_avatar,
      content: chatInput.trim(),
      message_type: 'chat',
    })
    setChatInput('')
  }

  const sendFriendRequest = async (targetPlayer) => {
    if (targetPlayer.user_id === profile.id) return
    await supabase.from('friendships').insert({
      requester_id: profile.id,
      addressee_id: targetPlayer.user_id,
      requester_anonymous_name: myPlayer.anonymous_name,
      met_in_room: room.id,
    })
    setFriendRequests(prev => [...prev, targetPlayer.id])
  }

  const evilInfo = getEvilLevel(evilScore)
  const levelConf = question ? LEVEL_CONFIG[question.level] : null
  const presetAnswers = getAnswersForQuestion(question)
  const isHost = room?.host_id === profile?.id
  const answeredCount = players.filter(p => answers.some(a => a.player_id === p.id)).length
  const cardGlow = cardFlipped && levelConf
    ? `0 24px 80px #00000090, 0 0 50px ${levelConf.glow}`
    : '0 20px 60px #00000060'

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.evilBadge}>
          <span>😈</span>
          <span style={{ color: evilInfo.color }}>{evilScore}%</span>
        </div>
        <div style={s.progress}>
          سؤال {(room?.current_question_index || 0) + 1} / {room?.questions_per_game || 7}
        </div>
        <button style={s.chatToggle} onClick={() => setShowChat(!showChat)}>
          💬 {messages.length > 0 && <span style={s.chatBadge}>{messages.length}</span>}
        </button>
      </div>

      {/* Progress bar */}
      <div style={s.progressBar}>
        <div style={{ ...s.progressFill, width: `${(((room?.current_question_index || 0) + 1) / (room?.questions_per_game || 7)) * 100}%` }} />
      </div>

      {/* Evil meter */}
      <div style={{ ...s.evilMeter, borderColor: evilInfo.color + '30' }}>
        <div style={s.evilMeterRow}>
          <span style={{ fontSize: 12, color: C.muted }}>مقياس الشر</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: evilInfo.color }}>{evilInfo.emoji} {evilInfo.label}</span>
        </div>
        <div style={s.evilBar}>
          <div style={{ ...s.evilFill, width: `${evilScore}%`, background: evilInfo.color, boxShadow: `0 0 12px ${evilInfo.color}80` }} />
        </div>
      </div>

      {/* Players bar */}
      <div style={s.playersBar}>
        {players.map(p => (
          <div key={p.id} style={{ ...s.playerDot, background: p.anonymous_color + '22', border: `1px solid ${p.anonymous_color}66`, opacity: answers.some(a => a.player_id === p.id) ? 1 : 0.3 }}>
            {p.anonymous_avatar}
          </div>
        ))}
        <span style={s.answeredText}>{answeredCount}/{players.length} أجابوا</span>
      </div>

      {/* Question Card */}
      {phase === 'answering' && (
        <>
          <div style={{ ...s.questionCard, boxShadow: cardGlow, borderColor: cardFlipped && levelConf ? levelConf.color + '40' : C.border }}
            onClick={() => !cardFlipped && setCardFlipped(true)}>
            {!cardFlipped ? (
              <div style={s.cardBack}>
                <div style={s.cardIcon}>🃏</div>
                <p style={s.cardBackText}>اضغط عشان تشوف السؤال</p>
              </div>
            ) : (
              <div style={s.cardFront}>
                {levelConf && (
                  <div style={{ ...s.levelBadge, background: levelConf.color + '22', color: levelConf.color, border: `1px solid ${levelConf.color}55` }}>
                    {levelConf.emoji} مستوى {question.level} — {levelConf.label}
                  </div>
                )}
                <p style={s.questionText}>{question?.text}</p>
                {cardFlipped && phase === 'answering' && (
                  <div style={{ ...s.timer, color: timeLeft <= 10 ? C.red : C.muted, animation: timeLeft <= 10 ? 'timerPulse 0.6s ease-in-out infinite' : 'none' }}>
                    ⏱ {timeLeft}ث
                  </div>
                )}
              </div>
            )}
          </div>

          {cardFlipped && !myAnswer && (
            <div style={s.answersSection}>
              <div style={s.answersGrid}>
                {presetAnswers.map((a, i) => (
                  <button key={i} style={s.answerBtn} onClick={() => submitAnswer(a)}>
                    <span style={s.answerLetter}>{String.fromCharCode(0x0041 + i)}</span>
                    <span style={s.answerTxt}>{a}</span>
                  </button>
                ))}
              </div>
              <button style={s.customBtn} onClick={() => setShowCustom(!showCustom)}>
                ✍️ اكتب إجابتك الحقيقية
              </button>
              {showCustom && (
                <div style={s.customRow}>
                  <input
                    style={s.customInput}
                    placeholder="اكتب هنا..."
                    value={customText}
                    onChange={e => setCustomText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitCustom()}
                    dir="rtl"
                    autoFocus
                  />
                  <button style={s.customSubmit} onClick={submitCustom}>إرسال</button>
                </div>
              )}
            </div>
          )}

          {myAnswer && (
            <div style={s.waitingBox}>
              <p style={s.waitingText}>✅ إجابتك اتسجلت</p>
              <p style={s.waitingText2}>في انتظار باقي اللاعبين...</p>
            </div>
          )}
        </>
      )}

      {/* Voting Phase */}
      {phase === 'voting' && (
        <div style={s.votingSection}>
          <p style={s.voteTitle}>🗳️ صوّت على أجرأ إجابة</p>
          {answers.map(a => {
            const player = players.find(p => p.id === a.player_id)
            const isMe = a.player_id === myPlayer?.id
            return (
              <div key={a.id} style={s.answerCard}>
                <div style={s.answerCardTop}>
                  <div style={{ ...s.answerAvatar, background: player?.anonymous_color + '22', border: `1px solid ${player?.anonymous_color}55` }}>
                    {player?.anonymous_avatar}
                  </div>
                  <div style={s.answerCardContent}>
                    <p style={s.answerCardName}>{player?.anonymous_name}</p>
                    <p style={s.answerCardText}>{a.answer_text}</p>
                    {a.is_custom && <span style={s.customBadge}>✍️ إجابة خاصة</span>}
                  </div>
                </div>
                <div style={s.answerCardActions}>
                  {!isMe && <button style={s.voteBtn} onClick={() => voteAnswer(a.id)}>🔥 أجرأ إجابة</button>}
                  {!isMe && !friendRequests.includes(player?.id) && (
                    <button style={s.friendBtn} onClick={() => sendFriendRequest(player)}>👤 اضف صديق</button>
                  )}
                  {friendRequests.includes(player?.id) && <span style={s.sentText}>✅ طلب أتبعت</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Reveal Phase */}
      {phase === 'reveal' && (
        <div style={s.revealSection}>
          <p style={s.revealTitle}>🏆 النتائج</p>
          {answers
            .sort((a, b) => (b.votes?.[0]?.count || 0) - (a.votes?.[0]?.count || 0))
            .map((a, idx) => {
              const player = players.find(p => p.id === a.player_id)
              return (
                <div key={a.id} style={{ ...s.revealCard, border: idx === 0 ? `2px solid ${C.gold}` : `1px solid ${C.border}` }}>
                  {idx === 0 && <div style={s.winnerBadge}>🏆 الأجرأ</div>}
                  <div style={s.revealTop}>
                    <span style={s.revealAvatar}>{player?.anonymous_avatar}</span>
                    <p style={s.revealName}>{player?.anonymous_name}</p>
                    <span style={s.revealVotes}>🔥 {a.votes?.[0]?.count || 0}</span>
                  </div>
                  <p style={s.revealText}>{a.answer_text}</p>
                </div>
              )
            })}
          {isHost && (
            <button style={s.nextBtn} onClick={nextQuestion}>
              {(room?.current_question_index || 0) + 1 >= (room?.questions_per_game || 7) ? '🎭 شوف النتيجة النهائية' : 'السؤال الجاي →'}
            </button>
          )}
          {!isHost && <p style={s.waitHost}>في انتظار المضيف...</p>}
        </div>
      )}

      {/* Chat Overlay */}
      {showChat && (
        <div style={s.chatOverlay}>
          <div style={s.chatHeader}>
            <p style={s.chatTitle}>💬 الشات</p>
            <button style={s.chatClose} onClick={() => setShowChat(false)}>✕</button>
          </div>
          <div style={s.chatMessages}>
            {messages.map(m => (
              <div key={m.id} style={{ ...s.msg, alignSelf: m.player_id === myPlayer?.id ? 'flex-end' : 'flex-start' }}>
                <span style={s.msgAvatar}>{m.anonymous_avatar}</span>
                <div>
                  <p style={s.msgName}>{m.anonymous_name}</p>
                  <p style={s.msgText}>{m.content}</p>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div style={s.chatInputRow}>
            <input
              style={s.chatInput}
              placeholder="اكتب رسالة..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              dir="rtl"
            />
            <button style={s.chatSend} onClick={sendMessage}>إرسال</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes timerPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.15)}}
        input:focus{outline:none;}
        input::placeholder{color:#55558A;}
        .ans-btn:hover{border-color:#FF3B5C88!important;background:#FF3B5C12!important;}
      `}</style>
    </div>
  )
}

const s = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', gap: 10, overflowY: 'auto', position: 'relative', background: '#060609' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  evilBadge: { display: 'flex', alignItems: 'center', gap: 6, background: '#FF3B5C18', border: '1px solid #FF3B5C44', borderRadius: 20, padding: '4px 12px', fontSize: 14, fontWeight: 700, color: '#EEEEFF' },
  progress: { fontSize: 13, color: '#6A6A9A', fontWeight: 600 },
  chatToggle: { background: '#0D0D14', border: '1px solid #ffffff15', color: '#EEEEFF', borderRadius: 10, padding: '6px 14px', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', position: 'relative' },
  chatBadge: { position: 'absolute', top: -4, right: -4, background: '#FF3B5C', borderRadius: '50%', width: 16, height: 16, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  progressBar: { height: 3, background: '#ffffff08', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'linear-gradient(90deg, #FF3B5C, #9B5DE5)', borderRadius: 4, transition: 'width 0.5s ease' },
  evilMeter: { background: '#0D0D14', borderRadius: 12, padding: '10px 14px', border: '1px solid', display: 'flex', flexDirection: 'column', gap: 6 },
  evilMeterRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  evilBar: { height: 6, background: '#ffffff08', borderRadius: 4, overflow: 'hidden' },
  evilFill: { height: '100%', borderRadius: 4, transition: 'width 0.5s ease, background 0.5s ease' },
  playersBar: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  playerDot: { width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, transition: 'opacity 0.3s' },
  answeredText: { fontSize: 12, color: '#6A6A9A', marginRight: 'auto' },
  questionCard: { background: '#0D0D14', borderRadius: 20, minHeight: 165, border: '1px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'pointer', transition: 'box-shadow 0.4s ease, border-color 0.4s ease' },
  cardBack: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  cardIcon: { fontSize: 52, animation: 'float 3s ease-in-out infinite' },
  cardBackText: { fontSize: 15, color: '#6A6A9A' },
  cardFront: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 },
  levelBadge: { fontSize: 12, fontWeight: 700, borderRadius: 20, padding: '4px 14px' },
  questionText: { fontSize: 19, fontWeight: 700, color: '#EEEEFF', lineHeight: 1.75 },
  timer: { fontSize: 14, fontWeight: 700, transition: 'color 0.3s' },
  answersSection: { display: 'flex', flexDirection: 'column', gap: 10 },
  answersGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  answerBtn: { background: '#0D0D14', border: '2px solid #ffffff15', borderRadius: 12, padding: '12px 10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right', transition: 'all 0.2s' },
  answerLetter: { fontSize: 11, fontWeight: 900, color: '#FF3B5C', background: '#FF3B5C20', borderRadius: 6, padding: '2px 8px' },
  answerTxt: { fontSize: 13, color: '#EEEEFF', lineHeight: 1.5 },
  customBtn: { background: 'transparent', border: '1px dashed #9B5DE566', color: '#9B5DE5', borderRadius: 12, padding: '12px', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' },
  customRow: { display: 'flex', gap: 8 },
  customInput: { flex: 1, background: '#0D0D14', border: '2px solid #9B5DE566', borderRadius: 10, padding: '12px', fontSize: 15, color: '#EEEEFF', fontFamily: 'inherit' },
  customSubmit: { background: 'linear-gradient(135deg, #FF3B5C, #9B5DE5)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  waitingBox: { background: '#0D0D14', borderRadius: 14, padding: 20, textAlign: 'center', border: '1px solid #00F5A025' },
  waitingText: { fontSize: 16, color: '#00F5A0', fontWeight: 700 },
  waitingText2: { fontSize: 13, color: '#6A6A9A', marginTop: 6, animation: 'pulse 2s infinite' },
  votingSection: { display: 'flex', flexDirection: 'column', gap: 10 },
  voteTitle: { fontSize: 18, fontWeight: 900, color: '#EEEEFF', textAlign: 'center' },
  answerCard: { background: '#0D0D14', borderRadius: 14, padding: 14, border: '1px solid #ffffff15', display: 'flex', flexDirection: 'column', gap: 10 },
  answerCardTop: { display: 'flex', gap: 12 },
  answerAvatar: { width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 },
  answerCardContent: { flex: 1 },
  answerCardName: { fontSize: 13, color: '#6A6A9A', marginBottom: 4 },
  answerCardText: { fontSize: 15, color: '#EEEEFF', lineHeight: 1.6 },
  customBadge: { fontSize: 11, color: '#9B5DE5', background: '#9B5DE522', borderRadius: 6, padding: '2px 8px', display: 'inline-block', marginTop: 4 },
  answerCardActions: { display: 'flex', gap: 8 },
  voteBtn: { flex: 1, background: 'linear-gradient(135deg, #FF3B5C, #9B5DE5)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  friendBtn: { background: '#111120', color: '#6A6A9A', border: '1px solid #ffffff15', borderRadius: 10, padding: '10px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  sentText: { fontSize: 13, color: '#00F5A0', alignSelf: 'center' },
  revealSection: { display: 'flex', flexDirection: 'column', gap: 10 },
  revealTitle: { fontSize: 20, fontWeight: 900, color: '#EEEEFF', textAlign: 'center' },
  revealCard: { background: '#0D0D14', borderRadius: 14, padding: 14, position: 'relative' },
  winnerBadge: { position: 'absolute', top: -10, right: 14, background: '#FFD93D', color: '#000', fontSize: 12, fontWeight: 900, borderRadius: 20, padding: '2px 10px' },
  revealTop: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  revealAvatar: { fontSize: 24 },
  revealName: { flex: 1, fontSize: 14, color: '#6A6A9A' },
  revealVotes: { fontSize: 16, fontWeight: 700, color: '#FFD93D' },
  revealText: { fontSize: 15, color: '#EEEEFF', lineHeight: 1.6 },
  nextBtn: { background: 'linear-gradient(135deg, #FF3B5C, #9B5DE5)', color: '#fff', border: 'none', borderRadius: 14, padding: '16px', fontSize: 17, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginTop: 8, boxShadow: '0 8px 32px #FF3B5C55' },
  waitHost: { textAlign: 'center', fontSize: 14, color: '#6A6A9A', animation: 'pulse 2s infinite' },
  chatOverlay: { position: 'fixed', bottom: 0, left: 0, right: 0, height: '60vh', background: '#0D0D14', borderTop: '1px solid #ffffff20', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', zIndex: 100, maxWidth: 420, margin: '0 auto' },
  chatHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #ffffff12' },
  chatTitle: { fontSize: 16, fontWeight: 700, color: '#EEEEFF' },
  chatClose: { background: 'transparent', border: 'none', color: '#6A6A9A', fontSize: 18, cursor: 'pointer' },
  chatMessages: { flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  msg: { display: 'flex', gap: 8, maxWidth: '85%' },
  msgAvatar: { fontSize: 20, flexShrink: 0 },
  msgName: { fontSize: 11, color: '#6A6A9A', marginBottom: 3 },
  msgText: { fontSize: 14, color: '#EEEEFF', background: '#111120', borderRadius: 10, padding: '8px 12px', lineHeight: 1.5 },
  chatInputRow: { display: 'flex', gap: 10, padding: '12px 16px', borderTop: '1px solid #ffffff12' },
  chatInput: { flex: 1, background: '#111120', border: '1px solid #ffffff15', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#EEEEFF', fontFamily: 'inherit' },
  chatSend: { background: 'linear-gradient(135deg, #FF3B5C, #9B5DE5)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { useGame } from '../context/GameContext'
import { supabase } from '../lib/supabase'
import { C, LEVEL_CONFIG, getEvilLevel } from '../lib/theme'
import { getAnswersForQuestion, FALLBACK_QUESTIONS } from '../lib/questions'

const TOTAL_QUESTIONS = 7

const LEVEL_OPTIONS = [
  { val: 0, label: 'عشوائي',  emoji: '🎲', desc: 'كل المستويات مختلطة' },
  { val: 1, label: 'دافئ',   emoji: '🟡', desc: 'اختيارات خفيفة ومريحة' },
  { val: 2, label: 'ساخن',   emoji: '🟠', desc: 'نوايا مخفية وأعمق شوية' },
  { val: 3, label: 'حارق',   emoji: '🔴', desc: 'أسرار وجرأة حقيقية' },
  { val: 4, label: 'جهنمي',  emoji: '💀', desc: 'مش لضعاف القلوب' },
]

export default function SoloGameScreen() {
  const { goTo } = useGame()
  const [phase, setPhase] = useState('intro') // intro | loading | playing | results
  const [chosenLevel, setChosenLevel] = useState(0)
  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [cardFlipped, setCardFlipped] = useState(false)
  const [timeLeft, setTimeLeft] = useState(30)
  const [answered, setAnswered] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [evilScore, setEvilScore] = useState(0)
  const [playerAnswers, setPlayerAnswers] = useState([])
  const timerRef = useRef(null)

  const fetchQuestions = useCallback(async (level) => {
    setPhase('loading')
    try {
      let query = supabase.from('questions').select('*').eq('is_active', true)
      if (level > 0) query = query.eq('level', level)
      const { data, error } = await query.order('id', { ascending: true }).limit(TOTAL_QUESTIONS)

      if (!error && data && data.length >= 3) {
        // Pad with fallback if not enough questions at this level
        if (data.length < TOTAL_QUESTIONS) {
          const fallback = FALLBACK_QUESTIONS.filter(q => level === 0 || q.level === level)
          setQuestions([...data, ...fallback].slice(0, TOTAL_QUESTIONS))
        } else {
          setQuestions(data)
        }
      } else {
        const fallback = level > 0
          ? FALLBACK_QUESTIONS.filter(q => q.level === level)
          : FALLBACK_QUESTIONS
        setQuestions(fallback.length ? fallback : FALLBACK_QUESTIONS)
      }
    } catch {
      setQuestions(FALLBACK_QUESTIONS)
    }
    setPhase('playing')
  }, [])

  const currentQuestion = questions[currentIndex]
  const levelConf = currentQuestion ? (LEVEL_CONFIG[currentQuestion.level] || LEVEL_CONFIG[1]) : null
  const presetAnswers = getAnswersForQuestion(currentQuestion)

  const handleAnswer = useCallback((text, isTimeout = false) => {
    if (answered || !currentQuestion) return
    clearInterval(timerRef.current)
    const weight = currentQuestion.level || 1
    const evilGain = isTimeout ? weight * 4 : weight * 8
    setSelectedAnswer(text)
    setAnswered(true)
    setEvilScore(prev => Math.min(100, prev + evilGain))
    setPlayerAnswers(prev => [...prev, { question: currentQuestion, answer: text, evilGain, isTimeout }])
  }, [answered, currentQuestion])

  // Advance after answering
  useEffect(() => {
    if (!answered) return
    const t = setTimeout(() => {
      if (currentIndex + 1 >= questions.length) {
        setPhase('results')
      } else {
        setCurrentIndex(i => i + 1)
        setCardFlipped(false)
        setAnswered(false)
        setSelectedAnswer(null)
      }
    }, 1500)
    return () => clearTimeout(t)
  }, [answered, currentIndex, questions.length])

  // Timer
  useEffect(() => {
    if (phase !== 'playing' || !cardFlipped || answered) return
    const maxTime = levelConf?.time || 30
    setTimeLeft(maxTime)
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [phase, cardFlipped, answered, currentIndex])

  // Auto-answer on timeout
  useEffect(() => {
    if (timeLeft === 0 && cardFlipped && !answered && phase === 'playing' && presetAnswers.length) {
      handleAnswer(presetAnswers[Math.floor(Math.random() * presetAnswers.length)], true)
    }
  }, [timeLeft]) // eslint-disable-line react-hooks/exhaustive-deps

  const evilInfo = getEvilLevel(evilScore)
  const cardGlow = cardFlipped && levelConf
    ? `0 24px 80px #00000095, 0 0 50px ${levelConf.glow}`
    : '0 20px 60px #00000070'

  // ── Intro screen ─────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div style={si.wrap}>
        <div style={si.header}>
          <div style={{ fontSize: 68, animation: 'float 3s ease-in-out infinite' }}>😈</div>
          <h1 style={si.title}>اختار مستوى الظلام</h1>
          <p style={si.sub}>كل مستوى أعمق وأكتر جرأة من السابق</p>
        </div>

        <div style={si.optionsCol}>
          {LEVEL_OPTIONS.map(opt => {
            const active = chosenLevel === opt.val
            const col = opt.val === 0 ? '#9B5DE5' : LEVEL_CONFIG[opt.val]?.color || '#9B5DE5'
            return (
              <button
                key={opt.val}
                style={{
                  ...si.optBtn,
                  borderColor: active ? col : '#ffffff15',
                  background: active ? col + '1A' : '#0D0D14',
                  boxShadow: active ? `0 0 24px ${col}30` : 'none',
                }}
                onClick={() => setChosenLevel(opt.val)}
              >
                <span style={{ fontSize: 24 }}>{opt.emoji}</span>
                <div style={{ textAlign: 'right', flex: 1 }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: active ? col : '#EEEEFF', margin: 0 }}>{opt.label}</p>
                  <p style={{ fontSize: 13, color: '#6A6A9A', margin: 0, marginTop: 2 }}>{opt.desc}</p>
                </div>
                {active && <span style={{ fontSize: 18, color: col }}>✓</span>}
              </button>
            )
          })}
        </div>

        <button style={si.startBtn} onClick={() => fetchQuestions(chosenLevel)}>
          يلا نبدأ 😈
        </button>
        <button style={si.backBtn} onClick={() => goTo('onboard')}>← رجوع</button>

        <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}`}</style>
      </div>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, background: '#060609' }}>
        <div style={{ fontSize: 52, animation: 'spin 1s linear infinite' }}>😈</div>
        <p style={{ color: '#6A6A9A', fontSize: 16 }}>جاري تحميل الأسئلة...</p>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  // ── Results ───────────────────────────────────────────────────────────────────
  if (phase === 'results') {
    return <ResultsSummary evilScore={evilScore} evilInfo={evilInfo} playerAnswers={playerAnswers} goTo={goTo} />
  }

  // ── Playing ───────────────────────────────────────────────────────────────────
  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => goTo('onboard')}>← خروج</button>
        <div style={s.evilBadge}>
          <span>😈</span>
          <span style={{ color: evilInfo.color }}>{evilScore}%</span>
        </div>
        <div style={s.progress}>{currentIndex + 1} / {questions.length}</div>
      </div>

      {/* Progress bar */}
      <div style={s.progressBar}>
        <div style={{ ...s.progressFill, width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
      </div>

      {/* Evil meter */}
      <div style={{ ...s.evilMeter, borderColor: evilInfo.color + '30' }}>
        <div style={s.evilMeterRow}>
          <span style={{ fontSize: 13, color: '#6A6A9A' }}>مقياس الشر</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: evilInfo.color }}>{evilInfo.emoji} {evilInfo.label}</span>
        </div>
        <div style={s.evilBar}>
          <div style={{ ...s.evilFill, width: `${evilScore}%`, background: evilInfo.color, boxShadow: `0 0 12px ${evilInfo.color}80` }} />
        </div>
      </div>

      {/* Question Card */}
      <div
        style={{ ...s.questionCard, boxShadow: cardGlow, borderColor: cardFlipped && levelConf ? levelConf.color + '44' : '#ffffff15' }}
        onClick={() => !cardFlipped && !answered && setCardFlipped(true)}
      >
        {!cardFlipped ? (
          <div style={s.cardBack}>
            <div style={s.cardIcon}>🃏</div>
            <p style={s.cardBackText}>اضغط عشان تشوف السؤال</p>
          </div>
        ) : (
          <div style={s.cardFront}>
            {levelConf && (
              <div style={{ ...s.levelBadge, background: levelConf.color + '22', color: levelConf.color, border: `1px solid ${levelConf.color}55` }}>
                {levelConf.emoji} مستوى {currentQuestion.level} — {levelConf.label}
              </div>
            )}
            <p style={s.questionText}>{currentQuestion?.text}</p>
            {!answered && (
              <div style={{ ...s.timer, color: timeLeft <= 10 ? '#FF3B5C' : '#6A6A9A', animation: timeLeft <= 10 ? 'timerPulse 0.6s ease-in-out infinite' : 'none' }}>
                ⏱ {timeLeft}ث
              </div>
            )}
            {answered && <div style={s.answeredBadge}>✅ اتسجلت إجابتك</div>}
          </div>
        )}
      </div>

      {/* Answer options */}
      {cardFlipped && !answered && (
        <div style={s.answersGrid}>
          {presetAnswers.map((a, i) => (
            <button key={i} style={s.answerBtn} onClick={() => handleAnswer(a)}>
              <span style={s.answerLetter}>{String.fromCharCode(0x0041 + i)}</span>
              <span style={s.answerTxt}>{a}</span>
            </button>
          ))}
        </div>
      )}

      {/* Feedback */}
      {answered && selectedAnswer && (
        <div style={s.selectedBox}>
          <p style={s.selectedLabel}>إجابتك:</p>
          <p style={s.selectedText}>"{selectedAnswer}"</p>
          <p style={s.nextHint}>
            {currentIndex + 1 < questions.length ? 'جاي السؤال الجاي...' : 'جاي النتيجة...'}
          </p>
        </div>
      )}

      <style>{`
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes timerPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(1.15)}}
      `}</style>
    </div>
  )
}

// ── Results summary ────────────────────────────────────────────────────────────
function ResultsSummary({ evilScore, evilInfo, playerAnswers, goTo }) {
  return (
    <div style={sr.wrap}>
      <div style={sr.header}>
        <div style={{ fontSize: 68, marginBottom: 8 }}>{evilInfo.emoji}</div>
        <h1 style={{ ...sr.title, color: evilInfo.color }}>{evilInfo.label}</h1>
        <p style={sr.sub}>نتيجتك النهائية</p>
      </div>

      <div style={sr.scoreBox}>
        <div style={{ ...sr.scoreCircle, borderColor: evilInfo.color, boxShadow: `0 0 50px ${evilInfo.color}50` }}>
          <span style={{ ...sr.scoreNum, color: evilInfo.color }}>{evilScore}%</span>
          <span style={sr.scoreLabel}>شر</span>
        </div>
      </div>

      <div style={sr.section}>
        <p style={sr.sectionTitle}>ملخص إجاباتك</p>
        {playerAnswers.map((item, i) => {
          const conf = LEVEL_CONFIG[item.question?.level] || LEVEL_CONFIG[1]
          return (
            <div key={i} style={sr.answerRow}>
              <div style={sr.answerRowTop}>
                <span style={{ ...sr.qNum, color: conf.color }}>{conf.emoji} س{i + 1}</span>
                <span style={{ fontSize: 12, color: '#6A6A9A' }}>
                  {item.isTimeout ? '⏰ انتهى الوقت' : `+${item.evilGain}% شر`}
                </span>
              </div>
              <p style={sr.qText}>{item.question?.text}</p>
              <p style={sr.aText}>"{item.answer}"</p>
            </div>
          )
        })}
      </div>

      <div style={sr.disclaimer}>
        <span>⚠️</span>
        <p>دي لعبة للضحك فقط. نتيجتك ما بتحكمش على شخصيتك الحقيقية 😄</p>
      </div>

      <div style={sr.btnRow}>
        <button style={sr.btnPrimary} onClick={() => goTo('onboard')}>
          📝 سجّل دخولك وتحدى أصحابك
        </button>
        <button style={sr.btnSecondary} onClick={() => window.location.reload()}>
          🔄 العب تاني
        </button>
      </div>
    </div>
  )
}

// ── Intro styles ───────────────────────────────────────────────────────────────
const si = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', padding: '28px 20px', gap: 20, overflowY: 'auto', background: '#060609' },
  header: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  title: { fontSize: 26, fontWeight: 900, color: '#EEEEFF', margin: 0 },
  sub: { fontSize: 14, color: '#6A6A9A', margin: 0 },
  optionsCol: { display: 'flex', flexDirection: 'column', gap: 10 },
  optBtn: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '1px solid', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', textAlign: 'right' },
  startBtn: { background: 'linear-gradient(135deg, #FF3B5C, #9B5DE5)', color: '#fff', border: 'none', borderRadius: 14, padding: '16px 24px', fontSize: 18, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 40px #FF3B5C55' },
  backBtn: { background: 'transparent', color: '#6A6A9A', border: 'none', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' },
}

// ── Game styles ────────────────────────────────────────────────────────────────
const s = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', gap: 10, overflowY: 'auto', position: 'relative', background: '#060609' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { background: 'transparent', border: '1px solid #ffffff15', color: '#6A6A9A', borderRadius: 10, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  evilBadge: { display: 'flex', alignItems: 'center', gap: 6, background: '#FF3B5C18', border: '1px solid #FF3B5C40', borderRadius: 20, padding: '4px 12px', fontSize: 14, fontWeight: 700, color: '#EEEEFF' },
  progress: { fontSize: 13, color: '#6A6A9A', fontWeight: 600 },
  progressBar: { height: 3, background: '#ffffff08', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'linear-gradient(90deg, #FF3B5C, #9B5DE5)', borderRadius: 4, transition: 'width 0.5s ease' },
  evilMeter: { background: '#0D0D14', borderRadius: 12, padding: '10px 14px', border: '1px solid', display: 'flex', flexDirection: 'column', gap: 6 },
  evilMeterRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  evilBar: { height: 6, background: '#ffffff08', borderRadius: 4, overflow: 'hidden' },
  evilFill: { height: '100%', borderRadius: 4, transition: 'width 0.5s ease, background 0.5s ease' },
  questionCard: { background: '#0D0D14', borderRadius: 20, minHeight: 165, border: '1px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'pointer', transition: 'box-shadow 0.4s ease, border-color 0.4s ease' },
  cardBack: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  cardIcon: { fontSize: 52, animation: 'float 3s ease-in-out infinite' },
  cardBackText: { fontSize: 15, color: '#6A6A9A' },
  cardFront: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 },
  levelBadge: { fontSize: 12, fontWeight: 700, borderRadius: 20, padding: '4px 14px' },
  questionText: { fontSize: 19, fontWeight: 700, color: '#EEEEFF', lineHeight: 1.75 },
  timer: { fontSize: 14, fontWeight: 700, transition: 'color 0.3s' },
  answeredBadge: { fontSize: 14, color: '#00F5A0', fontWeight: 700 },
  answersGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  answerBtn: { background: '#0D0D14', border: '2px solid #ffffff15', borderRadius: 12, padding: '12px 10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right', transition: 'all 0.2s' },
  answerLetter: { fontSize: 11, fontWeight: 900, color: '#FF3B5C', background: '#FF3B5C20', borderRadius: 6, padding: '2px 8px' },
  answerTxt: { fontSize: 13, color: '#EEEEFF', lineHeight: 1.5 },
  selectedBox: { background: '#00F5A010', border: '1px solid #00F5A030', borderRadius: 14, padding: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 },
  selectedLabel: { fontSize: 12, color: '#6A6A9A' },
  selectedText: { fontSize: 16, color: '#00F5A0', fontWeight: 700, lineHeight: 1.5 },
  nextHint: { fontSize: 13, color: '#6A6A9A', animation: 'pulse 1.5s infinite' },
}

// ── Results styles ─────────────────────────────────────────────────────────────
const sr = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 20px', gap: 20, overflowY: 'auto', background: '#060609' },
  header: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 900, margin: 0 },
  sub: { fontSize: 15, color: '#6A6A9A', marginTop: 4 },
  scoreBox: { display: 'flex', justifyContent: 'center' },
  scoreCircle: { width: 130, height: 130, borderRadius: '50%', border: '4px solid', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0D0D14' },
  scoreNum: { fontSize: 36, fontWeight: 900 },
  scoreLabel: { fontSize: 13, color: '#6A6A9A' },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#EEEEFF', marginBottom: 4 },
  answerRow: { background: '#0D0D14', borderRadius: 14, padding: '12px 14px', border: '1px solid #ffffff15', display: 'flex', flexDirection: 'column', gap: 6 },
  answerRowTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  qNum: { fontSize: 13, fontWeight: 700 },
  qText: { fontSize: 14, color: '#6A6A9A', lineHeight: 1.5 },
  aText: { fontSize: 15, color: '#EEEEFF', fontWeight: 600, lineHeight: 1.5 },
  disclaimer: { display: 'flex', gap: 10, alignItems: 'flex-start', background: '#FFD93D12', border: '1px solid #FFD93D35', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#FFD93D', lineHeight: 1.6 },
  btnRow: { display: 'flex', flexDirection: 'column', gap: 10 },
  btnPrimary: { background: 'linear-gradient(135deg, #FF3B5C, #9B5DE5)', color: '#fff', border: 'none', borderRadius: 14, padding: '16px 24px', fontSize: 17, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 32px #FF3B5C44' },
  btnSecondary: { background: '#0D0D14', color: '#EEEEFF', border: '1px solid #ffffff15', borderRadius: 14, padding: '14px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
}

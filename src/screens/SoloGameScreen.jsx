import { useState, useEffect, useRef, useCallback } from 'react'
import { useGame } from '../context/GameContext'
import { supabase } from '../lib/supabase'
import { C, LEVEL_CONFIG, getEvilLevel } from '../lib/theme'

const TOTAL_QUESTIONS = 7

const PRESET_ANSWERS = {
  1: ['أكمل في طريقي بس', 'أكون صريح مع الناس', 'أجرب حاجات ما جربتهاش', 'أساعد اللي محتاجني'],
  2: ['أوصل لهدفي بأي طريقة', 'أعيش بدون قيود', 'أكون أناني شوية', 'أقول الحقيقة المرة'],
  3: ['أاخد تأر من اللي ظلمني', 'أختفي من كل مسؤولياتي', 'أعمل اللي قلبي عايزه بس', 'أكون أنا الأول دايماً'],
  4: ['أكسر كل القواعد', 'أعيش للحظة بس', 'أكون الشر المطلق', 'ما أهتمش بأي حد تاني'],
}

const FALLBACK_QUESTIONS = [
  { id: 'f1', text: 'لو عرفت إن حد غلط عليك من غير ما يعرف، هتعمل إيه؟', level: 1 },
  { id: 'f2', text: 'لو قدرت تعيش حياة تانية من الأول، هتغير إيه؟', level: 2 },
  { id: 'f3', text: 'لو في ناس بتحكم عليك من غير ما تعرفهم، إيه ردك؟', level: 2 },
  { id: 'f4', text: 'لو عندك فرصة تبقى غني بس هتخسر صداقاتك، هتاخدها؟', level: 3 },
  { id: 'f5', text: 'لو قدرت تشوف أفكار الناس، هتستخدم الموهبة دي إزاي؟', level: 3 },
  { id: 'f6', text: 'لو مفيش قوانين ليوم واحد بس، هتعمل إيه؟', level: 4 },
  { id: 'f7', text: 'لو عرفت إن حياتك كلها هتتغير من قرار واحد، هتاخده؟', level: 4 },
]

export default function SoloGameScreen() {
  const { goTo } = useGame()
  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState('loading') // loading | playing | results
  const [cardFlipped, setCardFlipped] = useState(false)
  const [timeLeft, setTimeLeft] = useState(30)
  const [answered, setAnswered] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [evilScore, setEvilScore] = useState(0)
  const [playerAnswers, setPlayerAnswers] = useState([])
  const timerRef = useRef(null)

  useEffect(() => {
    fetchQuestions()
  }, [])

  const fetchQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('is_active', true)
        .order('play_count', { ascending: true })
        .limit(TOTAL_QUESTIONS)
      if (!error && data && data.length >= TOTAL_QUESTIONS) {
        setQuestions(data)
      } else {
        setQuestions(FALLBACK_QUESTIONS)
      }
    } catch {
      setQuestions(FALLBACK_QUESTIONS)
    }
    setPhase('playing')
  }

  const currentQuestion = questions[currentIndex]
  const levelConf = currentQuestion ? (LEVEL_CONFIG[currentQuestion.level] || LEVEL_CONFIG[1]) : null
  const presetAnswers = currentQuestion ? (PRESET_ANSWERS[currentQuestion.level] || PRESET_ANSWERS[1]) : []

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

  // Advance to next question or results after answering
  useEffect(() => {
    if (!answered) return
    const timer = setTimeout(() => {
      if (currentIndex + 1 >= TOTAL_QUESTIONS) {
        setPhase('results')
      } else {
        setCurrentIndex(i => i + 1)
        setCardFlipped(false)
        setAnswered(false)
        setSelectedAnswer(null)
      }
    }, 1500)
    return () => clearTimeout(timer)
  }, [answered, currentIndex])

  // Timer — starts when card is flipped, resets on new question
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

  // Auto-answer with random option when timer hits 0
  useEffect(() => {
    if (timeLeft === 0 && cardFlipped && !answered && phase === 'playing' && presetAnswers.length) {
      handleAnswer(presetAnswers[Math.floor(Math.random() * presetAnswers.length)], true)
    }
  }, [timeLeft]) // eslint-disable-line react-hooks/exhaustive-deps

  const evilInfo = getEvilLevel(evilScore)

  if (phase === 'loading') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 52, animation: 'spin 1s linear infinite' }}>😈</div>
        <p style={{ color: C.muted, fontSize: 16 }}>جاري تحميل الأسئلة...</p>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (phase === 'results') {
    return <ResultsSummary evilScore={evilScore} evilInfo={evilInfo} playerAnswers={playerAnswers} goTo={goTo} />
  }

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => goTo('onboard')}>← خروج</button>
        <div style={s.evilBadge}>
          <span>😈</span>
          <span style={{ color: evilInfo.color }}>{evilScore}%</span>
        </div>
        <div style={s.progress}>{currentIndex + 1} / {TOTAL_QUESTIONS}</div>
      </div>

      {/* Progress bar */}
      <div style={s.progressBar}>
        <div style={{ ...s.progressFill, width: `${((currentIndex + 1) / TOTAL_QUESTIONS) * 100}%` }} />
      </div>

      {/* Evil meter */}
      <div style={s.evilMeter}>
        <div style={s.evilMeterRow}>
          <span style={{ fontSize: 13, color: C.muted }}>مقياس الشر</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: evilInfo.color }}>{evilInfo.emoji} {evilInfo.label}</span>
        </div>
        <div style={s.evilBar}>
          <div style={{ ...s.evilFill, width: `${evilScore}%`, background: evilInfo.color }} />
        </div>
      </div>

      {/* Question Card */}
      <div style={s.questionCard} onClick={() => !cardFlipped && !answered && setCardFlipped(true)}>
        {!cardFlipped ? (
          <div style={s.cardBack}>
            <div style={s.cardIcon}>🃏</div>
            <p style={s.cardBackText}>اضغط عشان تشوف السؤال</p>
          </div>
        ) : (
          <div style={s.cardFront}>
            {levelConf && (
              <div style={{ ...s.levelBadge, background: levelConf.color + '22', color: levelConf.color, border: `1px solid ${levelConf.color}44` }}>
                {levelConf.emoji} مستوى {currentQuestion.level} — {levelConf.label}
              </div>
            )}
            <p style={s.questionText}>{currentQuestion?.text}</p>
            {!answered && (
              <div style={{ ...s.timer, color: timeLeft <= 10 ? C.red : C.muted }}>⏱ {timeLeft}ث</div>
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

      {/* Selected answer feedback */}
      {answered && selectedAnswer && (
        <div style={s.selectedBox}>
          <p style={s.selectedLabel}>إجابتك:</p>
          <p style={s.selectedText}>"{selectedAnswer}"</p>
          <p style={s.nextHint}>
            {currentIndex + 1 < TOTAL_QUESTIONS ? 'جاي السؤال الجاي...' : 'جاي النتيجة...'}
          </p>
        </div>
      )}

      <style>{`
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
      `}</style>
    </div>
  )
}

function ResultsSummary({ evilScore, evilInfo, playerAnswers, goTo }) {
  return (
    <div style={sr.wrap}>
      <div style={sr.header}>
        <div style={{ fontSize: 64, marginBottom: 8 }}>{evilInfo.emoji}</div>
        <h1 style={{ ...sr.title, color: evilInfo.color }}>{evilInfo.label}</h1>
        <p style={sr.sub}>نتيجتك النهائية</p>
      </div>

      {/* Score circle */}
      <div style={sr.scoreBox}>
        <div style={{ ...sr.scoreCircle, borderColor: evilInfo.color, boxShadow: `0 0 40px ${evilInfo.color}44` }}>
          <span style={{ ...sr.scoreNum, color: evilInfo.color }}>{evilScore}%</span>
          <span style={sr.scoreLabel}>شر</span>
        </div>
      </div>

      {/* Answers recap */}
      <div style={sr.section}>
        <p style={sr.sectionTitle}>ملخص إجاباتك</p>
        {playerAnswers.map((item, i) => {
          const conf = LEVEL_CONFIG[item.question?.level] || LEVEL_CONFIG[1]
          return (
            <div key={i} style={sr.answerRow}>
              <div style={sr.answerRowTop}>
                <span style={{ ...sr.qNum, color: conf.color }}>{conf.emoji} س{i + 1}</span>
                <span style={{ fontSize: 12, color: C.muted }}>
                  {item.isTimeout ? '⏰ انتهى الوقت' : `+${item.evilGain}% شر`}
                </span>
              </div>
              <p style={sr.qText}>{item.question?.text}</p>
              <p style={sr.aText}>"{item.answer}"</p>
            </div>
          )
        })}
      </div>

      {/* Disclaimer */}
      <div style={sr.disclaimer}>
        <span>⚠️</span>
        <p>دي لعبة للضحك فقط. نتيجتك ما بتحكمش على شخصيتك الحقيقية 😄</p>
      </div>

      {/* CTA buttons */}
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

// ─── Game screen styles ───────────────────────────────────────────────────────
const s = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', gap: 12, overflowY: 'auto', position: 'relative' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { background: 'transparent', border: '1px solid #ffffff20', color: '#8888AA', borderRadius: 10, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  evilBadge: { display: 'flex', alignItems: 'center', gap: 6, background: '#FF3B5C20', border: '1px solid #FF3B5C40', borderRadius: 20, padding: '4px 12px', fontSize: 14, fontWeight: 700, color: '#F0F0FF' },
  progress: { fontSize: 13, color: '#8888AA', fontWeight: 600 },
  progressBar: { height: 3, background: '#ffffff10', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'linear-gradient(90deg, #FF3B5C, #9B5DE5)', borderRadius: 4, transition: 'width 0.5s ease' },
  evilMeter: { background: '#13131A', borderRadius: 12, padding: '10px 14px', border: '1px solid #ffffff12', display: 'flex', flexDirection: 'column', gap: 6 },
  evilMeterRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  evilBar: { height: 6, background: '#ffffff10', borderRadius: 4, overflow: 'hidden' },
  evilFill: { height: '100%', borderRadius: 4, transition: 'width 0.5s ease, background 0.5s ease' },
  questionCard: { background: '#13131A', borderRadius: 20, minHeight: 160, border: '1px solid #ffffff12', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'pointer', boxShadow: '0 20px 60px #00000060' },
  cardBack: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  cardIcon: { fontSize: 52, animation: 'float 3s ease-in-out infinite' },
  cardBackText: { fontSize: 15, color: '#8888AA' },
  cardFront: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  levelBadge: { fontSize: 12, fontWeight: 700, borderRadius: 20, padding: '4px 12px' },
  questionText: { fontSize: 19, fontWeight: 700, color: '#F0F0FF', lineHeight: 1.7 },
  timer: { fontSize: 13, fontWeight: 700 },
  answeredBadge: { fontSize: 14, color: '#00F5A0', fontWeight: 700 },
  answersGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  answerBtn: { background: '#13131A', border: '2px solid #ffffff12', borderRadius: 12, padding: '12px 10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right', transition: 'all 0.2s' },
  answerLetter: { fontSize: 11, fontWeight: 900, color: '#FF3B5C', background: '#FF3B5C20', borderRadius: 6, padding: '2px 8px' },
  answerTxt: { fontSize: 13, color: '#F0F0FF', lineHeight: 1.5 },
  selectedBox: { background: '#00F5A015', border: '1px solid #00F5A033', borderRadius: 14, padding: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 },
  selectedLabel: { fontSize: 12, color: '#8888AA' },
  selectedText: { fontSize: 16, color: '#00F5A0', fontWeight: 700, lineHeight: 1.5 },
  nextHint: { fontSize: 13, color: '#8888AA', animation: 'pulse 1.5s infinite' },
}

// ─── Results screen styles ────────────────────────────────────────────────────
const sr = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 20px', gap: 20, overflowY: 'auto' },
  header: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 900 },
  sub: { fontSize: 15, color: '#8888AA', marginTop: 4 },
  scoreBox: { display: 'flex', justifyContent: 'center' },
  scoreCircle: { width: 120, height: 120, borderRadius: '50%', border: '4px solid', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#13131A' },
  scoreNum: { fontSize: 32, fontWeight: 900 },
  scoreLabel: { fontSize: 13, color: '#8888AA' },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#F0F0FF', marginBottom: 4 },
  answerRow: { background: '#13131A', borderRadius: 14, padding: '12px 14px', border: '1px solid #ffffff12', display: 'flex', flexDirection: 'column', gap: 6 },
  answerRowTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  qNum: { fontSize: 13, fontWeight: 700 },
  qText: { fontSize: 14, color: '#8888AA', lineHeight: 1.5 },
  aText: { fontSize: 15, color: '#F0F0FF', fontWeight: 600, lineHeight: 1.5 },
  disclaimer: { display: 'flex', gap: 10, alignItems: 'flex-start', background: '#FFD93D15', border: '1px solid #FFD93D40', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#FFD93D', lineHeight: 1.6 },
  btnRow: { display: 'flex', flexDirection: 'column', gap: 10 },
  btnPrimary: { background: 'linear-gradient(135deg, #FF3B5C, #9B5DE5)', color: '#fff', border: 'none', borderRadius: 14, padding: '16px 24px', fontSize: 17, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 32px #FF3B5C44' },
  btnSecondary: { background: '#13131A', color: '#F0F0FF', border: '1px solid #ffffff12', borderRadius: 14, padding: '14px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
}

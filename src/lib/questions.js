// ── Answer pools (fallback when DB answer_options is missing) ─────────────────
// Multiple sets per level keyed by question-ID seed so each question looks unique
const ANSWER_POOLS = {
  1: [
    ['أكمل في طريقي بس', 'أكون صريح بالكامل', 'أتغاضى عنه وأنسى', 'أعمل اللي يريح ضميري'],
    ['أقول الحق وأتحمل النتيجة', 'أعيش اللحظة من غير تفكير', 'أحافظ على السلام وأسكت', 'أجرب حاجة جديدة'],
    ['أدافع عن نفسي لو لزم', 'أسيب الموضوع يعدي', 'أواجه الحقيقة مهما كانت', 'أتصرف بما يريح ضميري'],
    ['أفكر في تأثيره على الناس', 'أعمل اللي يريحني أنا', 'أشاور حد أثق فيه', 'أتصرف وبعدين أتندم'],
  ],
  2: [
    ['أوصل لهدفي بأي طريقة', 'أعيش بدون قيود', 'أكون أناني شوية', 'أقول الحقيقة المرة'],
    ['أستغل الفرصة من غير ما أفكر', 'أخبي مشاعري الحقيقية', 'أبرر لنفسي وأكمل', 'أعمل اللي في مصلحتي'],
    ['أفكر في العواقب وبعدين أعمل', 'أعمل اللي نفسي فيه وأسكت', 'أقنع نفسي إنه مش غلط', 'أسيب الفرصة وأندم'],
    ['أكون أنانياً بذكاء', 'أعمل اللي قلبي يقوله', 'أفكر في حقوقي الأول', 'أعيش من غير اعتذار'],
  ],
  3: [
    ['أاخد تأر من اللي ظلمني', 'أختفي من كل مسؤولياتي', 'أعمل اللي قلبي عايزه', 'أكون أنا الأول دايماً'],
    ['أتخلص من كل اللي بيزعجني', 'أعيش بدون ما آبه بأي حد', 'أكسر القواعد اللي مش عاجباني', 'أعاقب اللي يستاهل'],
    ['أعمل اللي يخليني أرتاح حتى لو غلط', 'أتجاهل مشاعر الناس', 'أحقق اللي أنا عايزه بالقوة', 'أعيش لنفسي بس'],
    ['أتصرف من غير ما أفكر في العواقب', 'أكون قاسي مع اللي يستاهل', 'أعمل اللي يخدم مصلحتي', 'أتجاهل اللي بيزعجني'],
  ],
  4: [
    ['أكسر كل القواعد', 'أعيش للحظة بس', 'أكون الشر المطلق', 'ما أهتمش بأي حد'],
    ['أعمل كل اللي يخطر على بالي', 'أتخلى عن كل القيم', 'أحقق رغباتي الأعمق', 'أعيش في الظلام'],
    ['أكون بارد الدم تجاه كل حاجة', 'أتعامل مع الناس كأدوات', 'أحقق أهدافي من غير رحمة', 'أعيش لنفسي بحتاً'],
    ['أتحكم في كل حاجة', 'أتجاهل الضمير خالص', 'أعمل اللي يخليني أحس بالقوة', 'أكون من غير رحمة'],
  ],
}

/** Returns 4 answer options for a question — stable per question, varies across questions */
export function getAnswersForQuestion(question) {
  if (!question) return ANSWER_POOLS[1][0]
  const level = Math.min(4, Math.max(1, question.level || 1))
  const seed = question.id
    ? question.id.charCodeAt(0) + (question.id.charCodeAt(2) || 0)
    : (question.text?.charCodeAt(0) || 0)
  return ANSWER_POOLS[level][seed % 4]
}

/**
 * Calculate evil score gain based on question level + which answer index (0-3) was chosen.
 * Answers are ordered A (least evil) → D (most evil) in the DB.
 * Formula: ceil((level + answerIdx) × 14 / 7)
 * — Max per question: level 4 + idx 3 = ceil(7×14/7) = 14 pts
 * — 7 questions × 14 pts max = 98% evil at most
 * — Average answerer (level 2, idx 1): ceil(3×14/7) = 6 pts × 7 = 42% evil
 */
export function calcEvilGain(level, answerIdx, isCustom = false, isTimeout = false) {
  const l = Math.min(4, Math.max(1, level || 1))
  if (isTimeout) return l                                         // 1–4 pts, minimal
  const idx = isCustom ? 2.5 : Math.min(3, Math.max(0, answerIdx ?? 0))
  return Math.ceil((l + idx) * 14 / 7)
}

export const FALLBACK_QUESTIONS = [
  { id: 'f1', text: 'كدبت على حد بيحبك وحسيت بارتياح مش ذنب — إيه كان الكدب ده؟', level: 1 },
  { id: 'f2', text: 'في حاجة بتعملها سراً وبتعرف إنك هتوقف لو حد قريب منك عرف — إيه هي؟', level: 1 },
  { id: 'f3', text: 'لو ضمنت إن مفيش حد في حياتك هيعرف خالص — إيه أول حاجة هتعملها دلوقتي؟', level: 2 },
  { id: 'f4', text: 'مين الشخص اللي لو خسر حاجة مهمة في حياته كنت هتبقى مبسوط في السر؟', level: 2 },
  { id: 'f5', text: 'لو عرفت إنك مش هتتحاسب ومفيش عواقب — مين اللي كنت هتأذيه وإزاي؟', level: 3 },
  { id: 'f6', text: 'لو تقدر تعيش يوم واحد بدون ضمير خالص ومفيش محاسبة — إيه هتعمله؟', level: 3 },
  { id: 'f7', text: 'لو عارف إنك هتموت بعد سنة — إيه الحقيقة اللي هتقولها للناس وما قلتهاش لحد؟', level: 4 },
]

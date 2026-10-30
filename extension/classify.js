// PRIVACY: classification runs entirely locally with keyword rules. No network calls here.
// The prompt text is NEVER sent anywhere — only the resulting coarse category string
// ("coding" | "study" | "travel" | "finance" | "general") leaves the browser, and only to
// pick an ad.

const TT_RULES = [
  ["coding", /\b(code|coding|function|bug|debug|error|exception|compile|api|javascript|typescript|python|java|rust|golang|react|node|sql|regex|git|docker|html|css|script|algorithm|stack ?trace|refactor|program(ming)?|leetcode|npm|pip|class|method)\b|```/i],
  ["study", /\b(study|exam|homework|assignment|lecture|syllabus|essay|summar(y|ise|ize)|explain|theorem|proof|physics|chemistry|biology|history|revision|flashcards?|quiz|thesis|notes|semester|professor|course)\b/i],
  ["travel", /\b(travel|trip|flight|hotel|itinerary|visa|vacation|holiday|tour|destination|beach|train|airport|backpack(ing)?|weekend getaway|road ?trip)\b/i],
  ["finance", /\b(finance|money|invest(ing|ment)?|stocks?|mutual funds?|sip|budget|tax(es)?|loan|emi|salary|savings?|crypto|bitcoin|insurance|mortgage|expenses?|rupees?|inr|portfolio|credit card)\b/i],
];

function ttClassify(text) {
  const t = (text || "").slice(0, 4000);
  let best = "general";
  let bestScore = 0;
  for (const [cat, re] of TT_RULES) {
    const g = new RegExp(re.source, "gi");
    const score = (t.match(g) || []).length;
    if (score > bestScore) { best = cat; bestScore = score; }
  }
  return best;
}

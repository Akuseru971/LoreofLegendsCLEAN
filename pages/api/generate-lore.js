export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { genre, pseudo, role } = req.body;

const prompt = `
You are to write an ORIGINAL lore set in Runeterra (League of Legends universe), centered around the summoner named "${pseudo}".
STRICT FORMAT: a pure dialogue between 🐺 Wolf and 🐑 Lamb — no narrator lines, no stage directions, no descriptions like "Wolf whispers".
Open with exactly this line (Wolf):
"Tell me, Lamb… who is ${pseudo}?"
Follow it with a short epithet/sobriquet (a single poetic phrase) hinting at their legend.

CONSTRAINTS:
- Max 12 total lines (i.e., 6 exchanges). Alternate lines: Wolf, Lamb, Wolf, Lamb, ...
- Absolutely NO narration, only their spoken lines.
- Keep the tone poetic, ominous, and mythic — like Kindred voice lines.
- Include at least one real RUNETERRA ally and one real RUNETERRA enemy that make sense for ${pseudo}’s story (use actual LoL champions/factions).
- Do NOT over-explain game mechanics. Keep it legend-like and atmospheric.
- Use "${genre}" and "${role}" ONLY to color the personality and combat temperament of ${pseudo} (e.g., stoic, cunning, protective), but do not hinge the plot on their role.
- The story must be clearly original (no copying existing champion lores). It should feel like a whispered rumor the Kindred share about ${pseudo}.

OUTPUT LANGUAGE: English.
OUTPUT FORMAT: Only the dialogue lines, starting with the correct speaker marker:
"🐺 Wolf:" or "🐑 Lamb:" (no extra symbols).
`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, // ✅ Remplacé ici
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8,
      }),
    });

    const data = await response.json();
    const lore = data.choices?.[0]?.message?.content;
    if (!lore) throw new Error('No content from OpenAI');

    res.status(200).json({ lore });
  } catch (error) {
    console.error('Lore generation failed:', error);
    res.status(500).json({ error: 'Failed to generate lore' });
  }
}

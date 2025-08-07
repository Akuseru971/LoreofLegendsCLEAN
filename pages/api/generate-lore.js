export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { genre, pseudo, role } = req.body;

  const prompt = `
Structure your response as a dialogue between Lamb and Wolf, using their tone and poetic style.
The first sentence is always Wolf saying "Tell me lamb, who is ${pseudo}?" followed by a phrase giving a surname in relation with the lore.
Do not include any narration between the lines (e.g. no descriptions like "Wolf whispered" or "Lamb said softly").
Only pure dialogue.
Don't pay attention to the role itself to create the story.
Include real allies and enemies from League of Legends.
Limit the dialogue to exactly 12 lines max (6 exchanges).
Genre: ${genre}. Role: ${role}.
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

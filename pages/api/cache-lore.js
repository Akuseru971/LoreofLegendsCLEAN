// pages/api/cache-lore.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pseudo = '', genre = '', role = '', lore = '' } = req.body || {};
    // on limite un peu la taille (4KB max par cookie environ)
    const trimmed = (lore || '').slice(0, 3500);
    const b64 = Buffer.from(trimmed, 'utf8').toString('base64');
    const meta = Buffer.from(JSON.stringify({ pseudo, genre, role }), 'utf8').toString('base64');

    const common = 'Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1800'; // 30 minutes
    res.setHeader('Set-Cookie', [
      `lore_cache=${b64}; ${common}`,
      `lore_meta=${meta}; ${common}`,
    ]);

    return res.status(200).json({ ok: true, size: trimmed.length });
  } catch (e) {
    console.error('cache-lore error:', e);
    return res.status(500).json({ error: 'Failed to cache lore' });
  }
}

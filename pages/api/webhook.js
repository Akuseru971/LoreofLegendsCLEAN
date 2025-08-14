// pages/api/webhook.js (seulement la partie reconstitution + mails)
if (event.type === 'checkout.session.completed') {
  const session = event.data.object;

  const pseudo = session.metadata?.pseudo || 'Unknown Summoner';
  const customerEmail = session.customer_details?.email;

  // Recompose lore depuis les chunks
  let lore = '';
  const chunks = Object.entries(session.metadata || {})
    .filter(([k]) => /^lore_\d+$/.test(k))
    .sort(([a], [b]) => {
      const ai = Number(a.split('_')[1] || 0);
      const bi = Number(b.split('_')[1] || 0);
      return ai - bi;
    })
    .map(([, v]) => v);

  if (chunks.length > 0) {
    lore = chunks.join('');
  } else if (session.metadata?.lore_head) {
    lore = session.metadata.lore_head; // fallback minimal
  } else {
    lore = ''; // dernier recours
  }

  // ... transporter nodemailer identique ...
  await transporter.sendMail({
    from: process.env.SENDER_EMAIL,
    to: process.env.ADMIN_EMAIL,
    subject: `New Lore Purchase - ${pseudo}`,
    text: `Pseudo: ${pseudo}\nEmail client: ${customerEmail || 'unknown'}\n\nLore (len=${lore.length}):\n${lore || '(empty)'}`,
  });

  if (customerEmail) {
    await transporter.sendMail({
      from: process.env.SENDER_EMAIL,
      to: customerEmail,
      subject: `Your personalized Lore - ${pseudo}`,
      text: `Here is your lore:\n\n${lore || '(empty)'}\n\nThanks for your support!`,
    });
  }
}

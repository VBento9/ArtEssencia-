const { ImapFlow } = require('imapflow');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const host = process.env.ARTESSENCIA_IMAP_HOST;
  const user = process.env.ARTESSENCIA_IMAP_USER;
  const pass = process.env.ARTESSENCIA_IMAP_PASSWORD;
  const port = Number(process.env.ARTESSENCIA_IMAP_PORT || 143);
  const secure = String(process.env.ARTESSENCIA_IMAP_SECURE || 'false').toLowerCase() === 'true';

  if (!host || !user || !pass) {
    return res.status(500).json({ ok: false, error: 'imap_configuration_missing' });
  }

  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: { user, pass },
    logger: false,
    tls: { rejectUnauthorized: true }
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const mailbox = client.mailbox;
      const total = Number(mailbox && mailbox.exists || 0);
      const start = Math.max(1, total - 4);
      const messages = [];

      if (total > 0) {
        for await (const msg of client.fetch(`${start}:*`, {
          uid: true,
          envelope: true,
          flags: true,
          internalDate: true
        })) {
          const env = msg.envelope || {};
          messages.push({
            uid: msg.uid,
            subject: env.subject || '',
            from: (env.from || []).map(a => ({ name: a.name || '', address: a.address || '' })),
            to: (env.to || []).map(a => ({ name: a.name || '', address: a.address || '' })),
            date: env.date || msg.internalDate || null,
            seen: msg.flags ? msg.flags.has('\\Seen') : false
          });
        }
      }

      return res.status(200).json({
        ok: true,
        mailbox: 'INBOX',
        total,
        returned: messages.length,
        messages
      });
    } finally {
      lock.release();
    }
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: 'imap_connection_failed',
      detail: String(error && error.message ? error.message : error).slice(0, 300)
    });
  } finally {
    try { await client.logout(); } catch (_) {}
  }
};

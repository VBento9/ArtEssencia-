import net from 'node:net';
import tls from 'node:tls';
import { TextDecoder } from 'node:util';

const SUPABASE_URL = 'https://ihtsonqnnlrxvorfrarl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_bBAzr698eotgn-QCq0kKWQ_szVceK5x';

const env = (name, fallback = '') =>
  process.env[name] || fallback;

const quote = value =>
  `"${String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')}"`;

function writeLine(socket, line) {
  return new Promise((resolve, reject) =>
    socket.write(
      `${line}\r\n`,
      error => error ? reject(error) : resolve()
    )
  );
}

function waitGreeting(socket, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let data = '';

    const timer = setTimeout(
      () => finish(new Error('Timeout no greeting IMAP')),
      timeoutMs
    );

    const onData = chunk => {
      data += chunk.toString('utf8');

      if (data.includes('\r\n')) {
        finish(null, data);
      }
    };

    const onError = error => finish(error);

    function finish(error, value) {
      clearTimeout(timer);

      socket.off('data', onData);
      socket.off('error', onError);

      error ? reject(error) : resolve(value);
    }

    socket.on('data', onData);
    socket.once('error', onError);
  });
}

function readTagged(socket, tag, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let data = '';

    const timer = setTimeout(
      () => finish(new Error(`IMAP timeout: ${tag}`)),
      timeoutMs
    );

    const onData = chunk => {
      data += chunk.toString('utf8');

      if (
        new RegExp(
          `(?:^|\\r\\n)${tag} (?:OK|NO|BAD)`,
          'i'
        ).test(data)
      ) {
        finish(null, data);
      }
    };

    const onError = error => finish(error);

    const onClose = () =>
      finish(
        new Error(
          `Ligação IMAP fechada antes de ${tag}`
        )
      );

    function finish(error, value) {
      clearTimeout(timer);

      socket.off('data', onData);
      socket.off('error', onError);
      socket.off('close', onClose);

      error ? reject(error) : resolve(value);
    }

    socket.on('data', onData);
    socket.once('error', onError);
    socket.once('close', onClose);
  });
}

function normalizeCharset(value = 'utf-8') {
  const charset = String(value)
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .toLowerCase();

  if (charset === 'utf8') return 'utf-8';
  if (charset === 'latin1') return 'iso-8859-1';

  return charset || 'utf-8';
}

function decodeBuffer(buffer, charset = 'utf-8') {
  try {
    return new TextDecoder(
      normalizeCharset(charset),
      { fatal: false }
    ).decode(buffer);
  } catch {
    return buffer.toString('utf8');
  }
}

function decodeQuotedPrintableBuffer(text = '') {
  const input = String(text)
    .replace(/=\r?\n/g, '');

  const bytes = [];

  for (let i = 0; i < input.length; i += 1) {
    if (
      input[i] === '=' &&
      /^[0-9A-F]{2}$/i.test(
        input.slice(i + 1, i + 3)
      )
    ) {
      bytes.push(
        parseInt(
          input.slice(i + 1, i + 3),
          16
        )
      );

      i += 2;
      continue;
    }

    const code = input.charCodeAt(i);

    if (code <= 255) {
      bytes.push(code);
    } else {
      bytes.push(
        ...Buffer.from(input[i], 'utf8')
      );
    }
  }

  return Buffer.from(bytes);
}

function decodeHeader(value = '') {
  return String(value).replace(
    /=\?([^?]+)\?([bBqQ])\?([^?]+)\?=/g,
    (_, charset, encoding, text) => {
      try {
        if (/^b$/i.test(encoding)) {
          return decodeBuffer(
            Buffer.from(text, 'base64'),
            charset
          );
        }

        return decodeBuffer(
          decodeQuotedPrintableBuffer(
            text.replace(/_/g, ' ')
          ),
          charset
        );
      } catch {
        return text;
      }
    }
  );
}

function headerValue(headers, name) {
  const unfolded = String(headers)
    .replace(/\r?\n[ \t]+/g, ' ');

  const match = unfolded.match(
    new RegExp(
      `^${name}:\\s*(.*)$`,
      'im'
    )
  );

  return match
    ? decodeHeader(match[1].trim())
    : '';
}

function emailOnly(value = '') {
  const angle = String(value).match(
    /<([^<>\s]+@[^<>\s]+)>/
  );

  const source = (
    angle ? angle[1] : value
  ).trim();

  const match = source.match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
  );

  return match
    ? match[0].toLowerCase()
    : '';
}

function parseHeaderParams(value = '') {
  const source = String(value);
  const parts = source.split(';');

  const type = (
    parts.shift() || ''
  ).trim().toLowerCase();

  const params = {};

  const regex =
    /;\s*([^=;\s]+)\s*=\s*(?:"([^"]*)"|([^;\r\n]*))/g;

  let match;

  while (
    (match = regex.exec(`;${source}`))
  ) {
    params[
      match[1].toLowerCase()
    ] = (
      match[2] ??
      match[3] ??
      ''
    ).trim();
  }

  return {
    type,
    params
  };
}

function splitHeadersBody(raw = '') {
  const match = String(raw).match(
    /\r?\n\r?\n/
  );

  if (
    !match ||
    match.index == null
  ) {
    return {
      headers: '',
      body: String(raw)
    };
  }

  return {
    headers:
      String(raw).slice(
        0,
        match.index
      ),

    body:
      String(raw).slice(
        match.index +
        match[0].length
      )
  };
}

function decodeTransfer(
  body = '',
  encoding = '',
  charset = 'utf-8'
) {
  const type = String(encoding)
    .trim()
    .toLowerCase();

  try {
    if (type === 'base64') {
      return decodeBuffer(
        Buffer.from(
          String(body).replace(/\s+/g, ''),
          'base64'
        ),
        charset
      );
    }

    if (type === 'quoted-printable') {
      return decodeBuffer(
        decodeQuotedPrintableBuffer(body),
        charset
      );
    }
  } catch {
    // Mantém o conteúdo original.
  }

  return String(body);
}

function htmlToText(html = '') {
  return String(html)
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      ' '
    )
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      ' '
    )
    .replace(
      /<br\s*\/?\s*>/gi,
      '\n'
    )
    .replace(
      /<\/(p|div|li|tr|h[1-6])>/gi,
      '\n'
    )
    .replace(
      /<[^>]+>/g,
      ' '
    )
    .replace(
      /&nbsp;/gi,
      ' '
    )
    .replace(
      /&amp;/gi,
      '&'
    )
    .replace(
      /&lt;/gi,
      '<'
    )
    .replace(
      /&gt;/gi,
      '>'
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#39;|&apos;/gi,
      "'"
    );
}

function normalizeText(value = '') {
  return String(value)
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseMimeEntity(
  headers = '',
  body = ''
) {
  const contentType =
    parseHeaderParams(
      headerValue(
        headers,
        'Content-Type'
      ) ||
      'text/plain; charset=utf-8'
    );

  const disposition =
    parseHeaderParams(
      headerValue(
        headers,
        'Content-Disposition'
      )
    );

  const transferEncoding =
    headerValue(
      headers,
      'Content-Transfer-Encoding'
    );

  const isAttachment =
    disposition.type === 'attachment' ||
    Boolean(
      disposition.params.filename
    ) ||
    Boolean(
      contentType.params.name
    );

  if (isAttachment) {
    return {
      plain: [],
      html: []
    };
  }

  const boundary =
    contentType.params.boundary || '';

  if (
    contentType.type.startsWith(
      'multipart/'
    ) &&
    boundary
  ) {
    const result = {
      plain: [],
      html: []
    };

    const parts = String(body)
      .split(`--${boundary}`)
      .slice(1)
      .filter(
        part =>
          part &&
          !part.startsWith('--')
      );

    for (const part of parts) {
      const split =
        splitHeadersBody(
          part.replace(
            /^\r?\n/,
            ''
          )
        );

      const child =
        parseMimeEntity(
          split.headers,
          split.body
        );

      result.plain.push(
        ...child.plain
      );

      result.html.push(
        ...child.html
      );
    }

    return result;
  }

  const decoded =
    decodeTransfer(
      body,
      transferEncoding,
      contentType.params.charset ||
        'utf-8'
    );

  if (
    contentType.type ===
    'text/html'
  ) {
    return {
      plain: [],
      html: [decoded]
    };
  }

  return {
    plain: [decoded],
    html: []
  };
}

function cleanBody(
  raw = '',
  headers = ''
) {
  const parsed =
    parseMimeEntity(
      headers,
      raw
    );

  const plain =
    parsed.plain
      .map(normalizeText)
      .find(Boolean);

  if (plain) {
    return plain.slice(
      0,
      50000
    );
  }

  const html =
    parsed.html
      .map(
        value =>
          normalizeText(
            htmlToText(value)
          )
      )
      .find(Boolean);

  return (
    html ||
    normalizeText(raw)
  ).slice(0, 50000);
}

function parseFetchResponse(
  response,
  uid,
  mailboxUser
) {
  const headerMatch =
    response.match(
      /BODY\[HEADER\.FIELDS[^\]]*\]\s*\{\d+\}\r\n([\s\S]*?)\r\n\s*BODY\[TEXT\]/i
    );

  const textMatch =
    response.match(
      /BODY\[TEXT\]\s*\{\d+\}\r\n([\s\S]*?)\r\n\)\r\n[A-Za-z0-9]+\s+(?:OK|NO|BAD)/i
    );

  const headers =
    headerMatch?.[1] || '';

  const rawText =
    textMatch?.[1] || '';

  const messageId =
    headerValue(
      headers,
      'Message-ID'
    );

  const dateRaw =
    headerValue(
      headers,
      'Date'
    );

  const receivedAt =
    dateRaw &&
    !Number.isNaN(
      Date.parse(dateRaw)
    )
      ? new Date(
          dateRaw
        ).toISOString()
      : new Date()
          .toISOString();

  return {
    provider_message_id:
      messageId ||
      `imap:${String(
        mailboxUser
      ).toLowerCase()}:${uid}`,

    imap_uid:
      Number(uid),

    message_id_header:
      messageId || null,

    in_reply_to_provider_id:
      headerValue(
        headers,
        'In-Reply-To'
      ) || null,

    references:
      headerValue(
        headers,
        'References'
      ) || null,

    from_email:
      emailOnly(
        headerValue(
          headers,
          'From'
        )
      ),

    to_email:
      emailOnly(
        headerValue(
          headers,
          'To'
        )
      ) ||
      String(
        mailboxUser
      ).toLowerCase(),

    subject:
      headerValue(
        headers,
        'Subject'
      ) ||
      '(sem assunto)',

    body_text:
      cleanBody(
        rawText,
        headers
      ),

    received_at:
      receivedAt
  };
}

async function verifyUser(req) {
  const token =
    String(
      req.headers.authorization ||
      ''
    )
      .replace(
        /^Bearer\s+/i,
        ''
      )
      .trim();

  if (!token) {
    return false;
  }

  const response =
    await fetch(
      `${SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          apikey:
            SUPABASE_KEY,

          Authorization:
            `Bearer ${token}`
        }
      }
    );

  if (!response.ok) {
    return false;
  }

  const user =
    await response
      .json()
      .catch(() => null);

  return Boolean(
    user?.id
  );
}

async function ingest(message) {
  const secret =
    env(
      'ARTESSENCIA_EMAIL_INGEST_SECRET'
    );

  if (!secret) {
    throw new Error(
      'MISSING_INGEST_SECRET'
    );
  }

  const response =
    await fetch(
      `${SUPABASE_URL}/functions/v1/artessencia-email-ingest`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',

          'x-artessencia-ingest-secret':
            secret
        },

        body:
          JSON.stringify(
            message
          )
      }
    );

  const data =
    await response
      .json()
      .catch(() => ({}));

  if (
    !response.ok ||
    !data?.ok
  ) {
    throw new Error(
      data?.error ||
      `INGEST_${response.status}`
    );
  }

  return data;
}

async function syncImap() {
  const host =
    env(
      'ARTESSENCIA_IMAP_HOST',
      'mail.artessenciatlier.pt'
    );

  const port =
    Number(
      env(
        'ARTESSENCIA_IMAP_PORT',
        '143'
      )
    );

  const user =
    env(
      'ARTESSENCIA_IMAP_USER',
      'geral@artessenciatlier.pt'
    );

  const pass =
    env(
      'ARTESSENCIA_IMAP_PASSWORD'
    );

  /*
   * Aceita a variável STARTTLS definitiva
   * e também ARTESSENCIA_IMAP_TLS,
   * que já foi configurada no Vercel.
   */
  const useStarttls =
    String(
      env(
        'ARTESSENCIA_IMAP_STARTTLS',
        env(
          'ARTESSENCIA_IMAP_TLS',
          'true'
        )
      )
    ).toLowerCase() ===
    'true';

  if (!pass) {
    throw new Error(
      'MISSING_IMAP_PASSWORD'
    );
  }

  let socket =
    net.connect({
      host,
      port
    });

  socket.setTimeout(
    15000,
    () =>
      socket.destroy(
        new Error(
          'IMAP socket timeout'
        )
      )
  );

  await new Promise(
    (resolve, reject) => {
      socket.once(
        'connect',
        resolve
      );

      socket.once(
        'error',
        reject
      );
    }
  );

  await waitGreeting(
    socket
  );

  let tagNo = 1;

  const cmd =
    async line => {
      const tag =
        `A${tagNo++}`;

      await writeLine(
        socket,
        `${tag} ${line}`
      );

      const response =
        await readTagged(
          socket,
          tag
        );

      if (
        !new RegExp(
          `${tag} OK`,
          'i'
        ).test(response)
      ) {
        throw new Error(
          response.slice(-500)
        );
      }

      return response;
    };

  if (useStarttls) {
    await cmd(
      'STARTTLS'
    );

    socket =
      tls.connect({
        socket,
        servername: host,
        rejectUnauthorized: true
      });

    await new Promise(
      (resolve, reject) => {
        socket.once(
          'secureConnect',
          resolve
        );

        socket.once(
          'error',
          reject
        );
      }
    );
  }

  await cmd(
    `LOGIN ${quote(user)} ${quote(pass)}`
  );

  await cmd(
    'EXAMINE INBOX'
  );

  const search =
    await cmd(
      'UID SEARCH ALL'
    );

  const line =
    search.match(
      /\* SEARCH([^\r\n]*)/i
    )?.[1] || '';

  const uids =
    line
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(-20);

  let processed = 0;
  let linked = 0;

  const errors = [];

  for (const uid of uids) {
    try {
      const response =
        await cmd(
          `UID FETCH ${uid} (UID BODY.PEEK[HEADER.FIELDS (MESSAGE-ID FROM TO SUBJECT DATE IN-REPLY-TO REFERENCES MIME-VERSION CONTENT-TYPE CONTENT-TRANSFER-ENCODING CONTENT-DISPOSITION)] BODY.PEEK[TEXT])`
        );

      const message =
        parseFetchResponse(
          response,
          uid,
          user
        );

      if (
        !message.from_email
      ) {
        continue;
      }

      const result =
        await ingest(
          message
        );

      processed += 1;

      if (
        result.client_linked
      ) {
        linked += 1;
      }
    } catch (error) {
      errors.push({
        uid,

        error:
          String(
            error?.message ||
            error
          ).slice(
            0,
            300
          )
      });
    }
  }

  try {
    await cmd(
      'LOGOUT'
    );
  } catch {}

  try {
    socket.end();
  } catch {}

  return {
    processed,
    linked,
    checked:
      uids.length,
    errors
  };
}

export default async function handler(
  req,
  res
) {
  if (
    req.method !== 'POST'
  ) {
    res.setHeader(
      'Allow',
      'POST'
    );

    return res
      .status(405)
      .json({
        ok: false,
        error:
          'METHOD_NOT_ALLOWED'
      });
  }

  try {
    if (
      !(await verifyUser(req))
    ) {
      return res
        .status(401)
        .json({
          ok: false,
          error:
            'UNAUTHORIZED'
        });
    }

    const result =
      await syncImap();

    console.log(
      '[ARTESSENCIA EMAIL SYNC]',
      JSON.stringify(result)
    );

    return res
      .status(200)
      .json({
        ok: true,
        ...result
      });
  } catch (error) {
    return res
      .status(500)
      .json({
        ok: false,
        error:
          'IMAP_SYNC_FAILED',

        detail:
          String(
            error?.message ||
            error
          ).slice(
            0,
            500
          )
      });
  }
}

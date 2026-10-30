// A shared Redis counter. Credentials stay on the server, never in index.html.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!redisUrl || !redisToken) return res.status(503).json({ error: 'Counter not configured' });
  if (req.method === 'POST') {
    const origin = req.headers.origin;
    if (!origin || ![ 'https://' + req.headers.host, 'http://' + req.headers.host ].includes(origin)) {
      return res.status(403).json({ error: 'Origin not allowed' });
    }
  }
  try {
    const command = req.method === 'POST' ? 'INCR' : 'GET';
    const response = await fetch(redisUrl, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + redisToken, 'Content-Type': 'application/json' },
      body: JSON.stringify([command, 'villy:pageviews:v1']),
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error('Storage unavailable');
    const data = await response.json();
    if (data.error) throw new Error('Storage error');
    const count = data.result === null && command === 'GET' ? 0 : Number(data.result);
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid count');
    return res.status(200).json({ count });
  } catch (_) {
    return res.status(503).json({ error: 'Counter temporarily unavailable' });
  }
};

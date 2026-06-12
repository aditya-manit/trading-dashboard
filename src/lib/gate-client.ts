import crypto from 'crypto';

const BASE_URL = 'https://api.gateio.ws/api/v4';

function sign(
  method: string,
  path: string,
  query: string,
  body: string,
): { KEY: string; SIGN: string; Timestamp: string } {
  const key = process.env.GATE_API_KEY!;
  const secret = process.env.GATE_API_SECRET!;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyHash = crypto.createHash('sha512').update(body).digest('hex');
  const signStr = `${method}\n${path}\n${query}\n${bodyHash}\n${timestamp}`;
  const signature = crypto.createHmac('sha512', secret).update(signStr).digest('hex');
  return { KEY: key, SIGN: signature, Timestamp: timestamp };
}

export async function gateRequest<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const query = params ? new URLSearchParams(params).toString() : '';
  const headers = sign('GET', `/api/v4${path}`, query, '');
  const url = `${BASE_URL}${path}${query ? '?' + query : ''}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      KEY: headers.KEY,
      SIGN: headers.SIGN,
      Timestamp: headers.Timestamp,
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gate.io API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

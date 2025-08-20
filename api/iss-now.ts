export default async function handler(_req: any, res: any) {
  try {
    const r = await fetch('http://api.open-notify.org/iss-now.json', { cache: 'no-store' });
    const j = await r.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(j);
  } catch (e) {
    res.status(502).json({ error: 'upstream_failed' });
  }
}
import { useState } from 'react';
import { useFraudStore } from '@/store/fraudStore';
import { HarnessCard } from '@/design-system/components';
import { Send, Plus, Trash2, Clock } from 'lucide-react';

const DEFAULT_PAYLOAD = JSON.stringify({
  transaction_id: "TXN-TEST-001",
  amount: 2500,
  user_id: "USR-0042",
  device_id: "DEV-A3F9C",
  location: "New York",
  ip_address: "198.51.100.1",
  velocity: 5,
  geo_risk_score: 0.3,
  device_trust_score: 0.75,
  time_anomaly_score: 0.2,
  behavioral_deviation: 0.25,
  network_risk_score: 0.15,
  merchant_category: "Medium",
  time_of_day: 14
}, null, 2);

interface RequestHistoryItem {
  id: string;
  url: string;
  method: string;
  status: number | null;
  responseTime: number;
  timestamp: string;
  response: string | null;
  error: string | null;
}

export function RealRequest() {
  const { mode, setMode } = useFraudStore();
  const [baseUrl, setBaseUrl] = useState('http://localhost:8000');
  const [endpoint, setEndpoint] = useState('/fraud-score');
  const [apiKey, setApiKey] = useState('');
  const [method, setMethod] = useState<'POST' | 'GET'>('POST');
  const [payload, setPayload] = useState(DEFAULT_PAYLOAD);
  const [headers, setHeaders] = useState([{ key: 'Content-Type', value: 'application/json' }]);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{ data: string; status: number; time: number } | null>(null);
  const [history, setHistory] = useState<RequestHistoryItem[]>([]);
  const [timeout, setTimeout_] = useState(30);
  const [sslVerify, setSslVerify] = useState(true);

  const endpoints = [
    '/fraud-score',
    '/simulation/run',
    '/simulation/scenarios',
    '/intelligence/overview',
    '/analytics/sankey',
  ];

  const addHeader = () => setHeaders(h => [...h, { key: '', value: '' }]);
  const updateHeader = (i: number, field: 'key' | 'value', v: string) =>
    setHeaders(h => h.map((row, j) => j === i ? { ...row, [field]: v } : row));
  const removeHeader = (i: number) => setHeaders(h => h.filter((_, j) => j !== i));

  const sendRequest = async () => {
    setLoading(true);
    setMode('live');
    const t0 = performance.now();
    const url = `${baseUrl}${endpoint}`;
    const reqHeaders: Record<string, string> = {};
    headers.forEach(h => { if (h.key) reqHeaders[h.key] = h.value; });
    if (apiKey) reqHeaders['X-API-Key'] = apiKey;

    try {
      const res = await fetch(url, {
        method,
        headers: reqHeaders,
        body: method === 'POST' ? payload : undefined,
        signal: AbortSignal.timeout(timeout * 1000),
      });
      const elapsed = Math.round(performance.now() - t0);
      const text = await res.text();
      let pretty = text;
      try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /**/ }
      setResponse({ data: pretty, status: res.status, time: elapsed });
      setHistory(h => [{
        id: Date.now().toString(), url, method, status: res.status,
        responseTime: elapsed, timestamp: new Date().toISOString(),
        response: pretty, error: null,
      }, ...h.slice(0, 9)]);
    } catch (err) {
      const elapsed = Math.round(performance.now() - t0);
      const msg = err instanceof Error ? err.message : 'Request failed';
      setResponse({ data: `Error: ${msg}`, status: 0, time: elapsed });
      setHistory(h => [{
        id: Date.now().toString(), url, method, status: null,
        responseTime: elapsed, timestamp: new Date().toISOString(),
        response: null, error: msg,
      }, ...h.slice(0, 9)]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fade-in 0.4s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#E2E8F0', marginBottom: 4 }}>Live API Request</h1>
          <p style={{ fontSize: 12, color: 'var(--status-neutral)' }}>Send real HTTP requests to your fraud detection backend and inspect responses.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, background: mode === 'live' ? 'rgba(74,222,128,0.08)' : 'var(--bg-elevated)', border: `1px solid ${mode === 'live' ? 'rgba(74,222,128,0.3)' : 'var(--border-subtle)'}` }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: mode === 'live' ? '#4ADE80' : '#F87171', boxShadow: mode === 'live' ? '0 0 6px #4ADE80' : 'none' }} />
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: mode === 'live' ? '#4ADE80' : '#F87171', fontWeight: 700 }}>
            {mode === 'live' ? 'LIVE API MODE' : 'SYNTHETIC MODE'}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* API Config */}
        <HarnessCard title="API Configuration">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 10, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: 4 }}>BASE URL</label>
              <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: '#E2E8F0', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: 4 }}>ENDPOINT</label>
              <select value={endpoint} onChange={e => setEndpoint(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: '#E2E8F0', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }}>
                {endpoints.map(ep => <option key={ep}>{ep}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: 4 }}>API KEY (masked)</label>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-..." style={{ width: '100%', padding: '7px 10px', borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: '#E2E8F0', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: 4 }}>TIMEOUT (s)</label>
                <input type="number" value={timeout} onChange={e => setTimeout_(parseInt(e.target.value) || 30)} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: '#E2E8F0', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }}>SSL VERIFY</label>
                <button onClick={() => setSslVerify(v => !v)} style={{
                  padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
                  background: sslVerify ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.1)',
                  border: `1px solid ${sslVerify ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
                  color: sslVerify ? '#4ADE80' : '#F87171', fontSize: 12, fontFamily: 'var(--font-mono)',
                }}>
                  {sslVerify ? '✓ Enabled' : '✗ Disabled'}
                </button>
              </div>
            </div>
          </div>
        </HarnessCard>

        {/* Request Builder */}
        <HarnessCard title="Request Builder" action={
          <select value={method} onChange={e => setMethod(e.target.value as 'POST' | 'GET')} style={{ padding: '3px 8px', borderRadius: 4, background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: method === 'POST' ? '#3B82F6' : '#4ADE80', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            <option value="POST">POST</option>
            <option value="GET">GET</option>
          </select>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Headers */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }}>HEADERS</span>
                <button onClick={addHeader} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--status-neutral)', fontSize: 10, cursor: 'pointer' }}>
                  <Plus size={10} /> Add
                </button>
              </div>
              {headers.map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                  <input value={h.key} onChange={e => updateHeader(i, 'key', e.target.value)} placeholder="Key" style={{ flex: 1, padding: '5px 8px', borderRadius: 5, background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: '#E2E8F0', fontSize: 11, fontFamily: 'var(--font-mono)', outline: 'none' }} />
                  <input value={h.value} onChange={e => updateHeader(i, 'value', e.target.value)} placeholder="Value" style={{ flex: 2, padding: '5px 8px', borderRadius: 5, background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: '#E2E8F0', fontSize: 11, fontFamily: 'var(--font-mono)', outline: 'none' }} />
                  <button onClick={() => removeHeader(i)} style={{ padding: '5px 7px', borderRadius: 5, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: '#F87171', cursor: 'pointer' }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>

            {/* Body */}
            {method === 'POST' && (
              <div>
                <label style={{ fontSize: 10, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: 4 }}>JSON BODY</label>
                <textarea
                  value={payload}
                  onChange={e => setPayload(e.target.value)}
                  rows={12}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 6, resize: 'vertical',
                    background: 'var(--bg-input)', border: '1px solid var(--border-default)',
                    color: '#4ADE80', fontSize: 11, fontFamily: 'var(--font-mono)', outline: 'none',
                    boxSizing: 'border-box', lineHeight: 1.6,
                  }}
                />
              </div>
            )}

            <button
              onClick={sendRequest}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '11px 0', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(90deg, #22C55E 0%, #16A34A 100%)',
                border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
                fontFamily: 'var(--font-display)', letterSpacing: '0.04em',
                opacity: loading ? 0.6 : 1,
                boxShadow: loading ? 'none' : '0 0 16px rgba(34,197,94,0.4)',
              }}
            >
              <Send size={14} />
              {loading ? 'Sending…' : 'Send Live Request'}
            </button>
          </div>
        </HarnessCard>
      </div>

      {/* Response Panel */}
      {response && (
        <HarnessCard title="Response" subtitle={`${response.time}ms`} glow={response.status >= 200 && response.status < 300 ? 'pass' : 'fail'} action={
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{
              padding: '2px 8px', borderRadius: 4, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
              background: response.status >= 200 && response.status < 300 ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
              color: response.status >= 200 && response.status < 300 ? '#4ADE80' : '#F87171',
            }}>HTTP {response.status || 'ERR'}</span>
            <span style={{ fontSize: 11, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)' }}>{response.time}ms</span>
          </div>
        }>
          <pre style={{
            background: 'var(--bg-input)', borderRadius: 6, padding: '12px', overflowX: 'auto',
            fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4ADE80', lineHeight: 1.6,
            maxHeight: 400, overflowY: 'auto', margin: 0,
          }}>{response.data}</pre>
        </HarnessCard>
      )}

      {/* Request History */}
      {history.length > 0 && (
        <HarnessCard title="Request History" subtitle="Last 10 requests">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {history.map(h => (
              <div key={h.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                onClick={() => h.response && setResponse({ data: h.response, status: h.status ?? 0, time: h.responseTime })}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: h.method === 'POST' ? '#3B82F6' : '#4ADE80', minWidth: 36 }}>{h.method}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#CBD5E1', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.url}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                  color: h.status && h.status < 300 ? '#4ADE80' : '#F87171',
                  padding: '1px 6px', borderRadius: 3,
                  background: h.status && h.status < 300 ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                }}>{h.status ?? 'ERR'}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--status-neutral)' }}>{h.responseTime}ms</span>
                <Clock size={10} color="var(--border-bright)" />
                <span style={{ fontSize: 9, color: 'var(--border-bright)' }}>{new Date(h.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </HarnessCard>
      )}
    </div>
  );
}

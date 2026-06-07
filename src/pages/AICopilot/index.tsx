import { useState, useRef, useEffect } from 'react';
import { generateCopilotResponse, type CopilotMessage } from './copilotEngine';
import { HarnessCard } from '@/design-system/components/HarnessCard';
import { Bot, Send, RotateCcw, User, Zap, ChevronRight } from 'lucide-react';

const SUGGESTED_PROMPTS = [
  'Give me a system overview',
  'What are the top decline drivers?',
  'Explain Rule 7 CMRA',
  'Show drift status',
  'Simulate overriding Rule 7 and Rule 8',
  'What is SHAP and which feature matters most?',
  'How does the Bayesian network work?',
  'Explain KOEC0039 sub-codes',
];

function formatMarkdown(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // Bold
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((p, j) => {
      if (p.startsWith('**') && p.endsWith('**')) {
        return <strong key={j} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{p.slice(2, -2)}</strong>;
      }
      // Inline code
      const codeParts = p.split(/(`[^`]+`)/g);
      return codeParts.map((cp, k) =>
        cp.startsWith('`') && cp.endsWith('`')
          ? <code key={k} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', background: 'rgba(0,180,216,0.1)', padding: '1px 5px', borderRadius: '3px', color: 'var(--accent-primary)' }}>{cp.slice(1, -1)}</code>
          : cp
      );
    });
    return <div key={i} style={{ lineHeight: 1.7, minHeight: line === '' ? '8px' : undefined }}>{rendered}</div>;
  });
}

export function AICopilot() {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id:        '0',
      role:      'assistant',
      content:   'Hello! I\'m the NEXUS AI Copilot — your IDPF domain intelligence assistant.\n\nI have full knowledge of the 10-rule IDPF system, live analytics from 1,500 transactions, and can simulate rule changes. Ask me anything or choose a prompt below.',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: CopilotMessage = {
      id:        crypto.randomUUID(),
      role:      'user',
      content:   text.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    setTimeout(() => {
      const response = generateCopilotResponse(text);
      const assistantMsg: CopilotMessage = {
        id:        crypto.randomUUID(),
        role:      'assistant',
        content:   response,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setLoading(false);
    }, 400 + Math.random() * 300);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <Bot size={20} color="var(--accent-primary)" />
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              AI Copilot — NEXUS Intelligence
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
            Rule-grounded IDPF domain assistant · Live analytics · No external API
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent-primary)', background: 'rgba(0,180,216,0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(0,180,216,0.2)' }}>
            Rule-Based NLU · In-Memory
          </span>
          <button
            onClick={() => setMessages(prev => [prev[0]])}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
          >
            <RotateCcw size={13} /> Clear
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '20px', flex: 1, minHeight: 0 }}>
        {/* Chat area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', overflow: 'hidden' }}>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '400px', maxHeight: '560px' }}>
            {messages.map(msg => (
              <div key={msg.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                  background: msg.role === 'assistant' ? 'rgba(0,180,216,0.15)' : 'rgba(74,222,128,0.15)',
                  border: `1px solid ${msg.role === 'assistant' ? 'var(--accent-primary)' : 'var(--status-pass)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {msg.role === 'assistant'
                    ? <Bot size={14} color="var(--accent-primary)" />
                    : <User size={14} color="var(--status-pass)" />}
                </div>
                <div style={{
                  maxWidth: '80%',
                  background: msg.role === 'assistant' ? 'var(--bg-elevated)' : 'rgba(74,222,128,0.08)',
                  border: `1px solid ${msg.role === 'assistant' ? 'var(--border-subtle)' : 'rgba(74,222,128,0.2)'}`,
                  borderRadius: msg.role === 'assistant' ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
                  padding: '12px 14px',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                }}>
                  {formatMarkdown(msg.content)}
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(0,180,216,0.15)', border: '1px solid var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bot size={14} color="var(--accent-primary)" />
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '4px 12px 12px 12px', padding: '12px 16px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary)', animation: `pulse-ring 1.2s ${i * 0.2}s ease-in-out infinite`, opacity: 0.7 }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '10px' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about rules, declines, drift, simulations..."
              rows={2}
              style={{
                flex: 1,
                background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontFamily: 'var(--font-body)',
                resize: 'none',
                outline: 'none',
                lineHeight: 1.5,
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              style={{
                width: '40px', height: '40px',
                background: input.trim() && !loading ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                alignSelf: 'flex-end',
                transition: 'background 0.2s',
              }}
            >
              <Send size={16} color={input.trim() && !loading ? '#0B0F1A' : 'var(--text-muted)'} />
            </button>
          </div>
        </div>

        {/* Suggested prompts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <HarnessCard title="Quick Prompts" subtitle="Click to ask">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {SUGGESTED_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  disabled={loading}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    color: 'var(--text-secondary)',
                    fontSize: '11px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                    gap: '8px',
                  }}
                  onMouseEnter={e => { if (!loading) (e.currentTarget.style.borderColor = 'var(--accent-primary)'); (e.currentTarget.style.color = 'var(--accent-primary)'); }}
                  onMouseLeave={e => { (e.currentTarget.style.borderColor = 'var(--border-subtle)'); (e.currentTarget.style.color = 'var(--text-secondary)'); }}
                >
                  <span style={{ lineHeight: 1.4 }}>{prompt}</span>
                  <ChevronRight size={11} style={{ flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </HarnessCard>

          <div style={{ padding: '10px 12px', background: 'rgba(0,180,216,0.05)', border: '1px solid rgba(0,180,216,0.15)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <Zap size={12} color="var(--accent-primary)" />
              <span style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600 }}>Live Data</span>
            </div>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              All responses are grounded in real-time analytics from 1,500 in-memory IDPF transactions. No external LLM API required.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

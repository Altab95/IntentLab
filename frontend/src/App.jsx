import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const EVENT_PRESETS = [
  { type: 'page_view', defaults: { path: '/collections/new-arrivals' } },
  { type: 'product_view', defaults: { productId: 'sku_new', price: 79, timeOnPageSec: 30 } },
  { type: 'add_to_cart', defaults: { productId: 'sku_new', price: 79 } },
  { type: 'promo_apply', defaults: { code: 'SAVE10', result: 'invalid' } },
  { type: 'promo_field_focus', defaults: {} },
  { type: 'checkout_start', defaults: {} },
  { type: 'checkout_step', defaults: { step: 'payment' } },
  { type: 'wishlist_add', defaults: { productId: 'sku_new' } },
  { type: 'size_guide_open', defaults: { productId: 'sku_new' } },
  { type: 'session_idle', defaults: { idleSec: 120 } },
  { type: 'page_exit', defaults: { path: '/cart' } },
  { type: 'purchase', defaults: { orderValue: 79, items: 1 } },
]

function formatState(state) {
  if (!state) return '—'
  return state.replace(/_/g, ' ')
}

function payloadSummary(event) {
  const { t, type, ...rest } = event
  const keys = Object.keys(rest)
  if (!keys.length) return '—'
  return keys.map((k) => `${k}=${JSON.stringify(rest[k])}`).join(' · ')
}

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export default function App() {
  const [sessions, setSessions] = useState([])
  const [health, setHealth] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [events, setEvents] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [live, setLive] = useState(true)
  const [presetType, setPresetType] = useState(EVENT_PRESETS[0].type)
  const [extraJson, setExtraJson] = useState('{}')
  const debounceRef = useRef(null)
  const requestId = useRef(0)

  useEffect(() => {
    Promise.all([api('/api/health'), api('/api/sessions')])
      .then(([h, s]) => {
        setHealth(h)
        setSessions(s.sessions || [])
        if (s.sessions?.[0]) setActiveId(s.sessions[0].id)
      })
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    if (!activeId) return
    setError(null)
    api(`/api/sessions/${activeId}`)
      .then((data) => {
        setEvents(data.session.events || [])
        setResult(null)
      })
      .catch((err) => setError(err.message))
  }, [activeId])

  const classify = useCallback(async (nextEvents, { quiet } = {}) => {
    if (!nextEvents?.length) {
      setResult(null)
      return
    }
    const id = ++requestId.current
    if (!quiet) setLoading(true)
    setError(null)
    try {
      const data = await api('/api/classify', {
        method: 'POST',
        body: JSON.stringify({ events: nextEvents }),
      })
      if (id === requestId.current) setResult(data)
    } catch (err) {
      if (id === requestId.current) setError(err.message)
    } finally {
      if (id === requestId.current && !quiet) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!live || !events.length) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      classify(events, { quiet: true })
    }, 450)
    return () => clearTimeout(debounceRef.current)
  }, [events, live, classify])

  const activeMeta = useMemo(
    () => sessions.find((s) => s.id === activeId),
    [sessions, activeId],
  )

  function addEvent() {
    let extra = {}
    try {
      extra = JSON.parse(extraJson || '{}')
    } catch {
      setError('Extra fields must be valid JSON')
      return
    }
    const preset = EVENT_PRESETS.find((p) => p.type === presetType) || EVENT_PRESETS[0]
    const lastT = events.length ? events[events.length - 1].t : 0
    const next = [
      ...events,
      { t: lastT + 15, type: preset.type, ...preset.defaults, ...extra },
    ]
    setEvents(next)
  }

  function removeEvent(index) {
    setEvents(events.filter((_, i) => i !== index))
  }

  function resetSession() {
    if (!activeId) return
    api(`/api/sessions/${activeId}`).then((data) => {
      setEvents(data.session.events || [])
      setResult(null)
    })
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <span className="brand-dot" aria-hidden />
            <h1>IntentLab</h1>
          </div>
          <p>
            Classify shopper sessions into actionable states — with evidence,
            confidence, and a recommended on-site nudge. Edit the stream and
            watch classification update live.
          </p>
        </div>
        <div
          className={`status-pill ${health?.llmConfigured ? '' : 'warn'}`}
          title={
            health?.llmConfigured
              ? 'OpenAI key detected — LLM enrichment on'
              : 'No OPENAI_API_KEY — heuristic fallback'
          }
        >
          <span className="dot" />
          {health
            ? health.llmConfigured
              ? 'LLM + signals'
              : 'Heuristic mode'
            : 'Connecting…'}
        </div>
      </header>

      <div className="layout">
        <aside className="panel" style={{ animationDelay: '0.05s' }}>
          <h2>Sample sessions</h2>
          <ul className="session-list">
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`session-btn ${activeId === s.id ? 'active' : ''}`}
                  onClick={() => setActiveId(s.id)}
                >
                  <span className="label">{s.label}</span>
                  <span className="meta">
                    {formatState(s.expectedState)} · {s.eventCount} events · {s.durationSec}s
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="workspace">
          <div className="split">
            <section className="panel" style={{ animationDelay: '0.1s' }}>
              <h2>Event stream simulator</h2>
              <div className="panel-body">
                <div className="toolbar">
                  <button type="button" className="btn primary" disabled={loading || !events.length} onClick={() => classify(events)}>
                    {loading ? 'Classifying…' : 'Classify now'}
                  </button>
                  <button
                    type="button"
                    className={`btn ${live ? 'primary' : 'ghost'}`}
                    onClick={() => setLive((v) => !v)}
                  >
                    Live {live ? 'on' : 'off'}
                  </button>
                  <button type="button" className="btn ghost" onClick={resetSession}>
                    Reset
                  </button>
                  <button type="button" className="btn ghost" onClick={() => setEvents([])}>
                    Clear
                  </button>
                </div>

                {activeMeta && (
                  <p className="rationale" style={{ marginTop: 0 }}>
                    {activeMeta.persona}
                  </p>
                )}

                <ul className="event-stream">
                  {events.length === 0 && (
                    <li className="empty">No events — add one below or pick a sample session.</li>
                  )}
                  {events.map((ev, i) => (
                    <li className="event-row" key={`${ev.t}-${ev.type}-${i}`} style={{ animationDelay: `${Math.min(i, 12) * 0.03}s` }}>
                      <span className="t">t={ev.t}</span>
                      <div>
                        <div className="type">{ev.type}</div>
                        <div className="payload">{payloadSummary(ev)}</div>
                      </div>
                      <button type="button" className="remove" onClick={() => removeEvent(i)} aria-label="Remove event">
                        remove
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="composer">
                  <select value={presetType} onChange={(e) => setPresetType(e.target.value)}>
                    {EVENT_PRESETS.map((p) => (
                      <option key={p.type} value={p.type}>
                        {p.type}
                      </option>
                    ))}
                  </select>
                  <input
                    value={extraJson}
                    onChange={(e) => setExtraJson(e.target.value)}
                    placeholder='Extra JSON e.g. {"path":"/sale"}'
                    aria-label="Extra event fields JSON"
                  />
                  <button type="button" className="btn" onClick={addEvent}>
                    Add event
                  </button>
                </div>
                {error && <div className="error">{error}</div>}
              </div>
            </section>

            <section className="panel" style={{ animationDelay: '0.16s' }}>
              <h2>Classification</h2>
              <div className="panel-body">
                {!result ? (
                  <div className="empty">
                    {live
                      ? 'Live mode will classify as you edit the stream.'
                      : 'Run classify to see shopper state, evidence, and nudge.'}
                  </div>
                ) : (
                  <>
                    <div className="result-hero">
                      <div className="state">
                        {formatState(result.state)}{' '}
                        <span style={{ fontWeight: 500, fontSize: '0.9rem', opacity: 0.7 }}>
                          {(result.confidence * 100).toFixed(0)}% conf.
                        </span>
                      </div>
                      <div className="meter" aria-hidden>
                        <i style={{ width: `${Math.round(result.confidence * 100)}%` }} />
                      </div>
                      <div className="meta-row">
                        <span className="chip">source: {result.source}</span>
                        {result.meta?.agreement != null && (
                          <span className="chip">
                            heuristic {result.meta.agreement ? 'agrees' : `→ ${formatState(result.meta.heuristicState)}`}
                          </span>
                        )}
                        {result.model && <span className="chip">{result.model}</span>}
                      </div>
                    </div>

                    <p className="rationale">{result.rationale}</p>

                    <div className="section-label">Evidence</div>
                    <ul className="evidence-list">
                      {(result.evidence || []).map((e, i) => (
                        <li className="evidence-item" key={`${e.claim}-${i}`} style={{ animationDelay: `${i * 0.05}s` }}>
                          <strong>{e.claim}</strong>
                          <p>{e.detail}</p>
                        </li>
                      ))}
                    </ul>

                    {result.recommendedAction && (
                      <>
                        <div className="section-label">Recommended nudge</div>
                        <div className="nudge">
                          <div className="type">
                            {result.recommendedAction.type}
                            {result.recommendedAction.priority
                              ? ` · ${result.recommendedAction.priority} priority`
                              : ''}
                          </div>
                          <p>{result.recommendedAction.message || result.recommendedAction.copy}</p>
                        </div>
                      </>
                    )}

                    {result.alternatives?.length > 0 && (
                      <>
                        <div className="section-label">Alternatives</div>
                        <div className="alts">
                          {result.alternatives.map((a) => (
                            <span className="chip" key={a.state}>
                              {formatState(a.state)} {(a.confidence * 100).toFixed(0)}%
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}

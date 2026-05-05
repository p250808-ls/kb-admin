import { useState, useEffect, useCallback, useRef } from 'react'

// ── 預設值 ────────────────────────────────────────────────
const CONN_DEFAULTS = {
  kbUrl: 'https://tk-kb-proxy.zeabur.app',
  supabaseUrl: 'https://ttryhemtkvsybfhonwyh.supabase.co',
  supabaseKey: '',
  adminPassword: '',
}

const LLM_PROVIDERS = [
  { value: 'gemini',    label: 'Google Gemini',    keyEnv: 'GEMINI_API_KEY',    keyPlaceholder: 'AIza...',  models: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
  { value: 'openai',   label: 'OpenAI',            keyEnv: 'OPENAI_API_KEY',    keyPlaceholder: 'sk-...',   models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { value: 'anthropic',label: 'Anthropic Claude',  keyEnv: 'ANTHROPIC_API_KEY', keyPlaceholder: 'sk-ant-...', models: ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-5'] },
]

const EMBED_PROVIDERS = [
  {
    value: 'cohere', label: 'Cohere', keyEnv: 'COHERE_API_KEY', keyPlaceholder: '...',
    models: ['embed-multilingual-light-v3.0', 'embed-multilingual-v3.0', 'embed-english-v3.0'],
    dim: { 'embed-multilingual-light-v3.0': 384, 'embed-multilingual-v3.0': 1024, 'embed-english-v3.0': 1024 },
  },
  {
    value: 'openai', label: 'OpenAI', keyEnv: 'OPENAI_API_KEY', keyPlaceholder: 'sk-...',
    models: ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'],
    dim: { 'text-embedding-3-small': 1536, 'text-embedding-3-large': 3072, 'text-embedding-ada-002': 1536 },
  },
]

const AI_DEFAULTS = {
  systemPrompt: '你是一位專業的行政法規助理，專門解答職業訓練、長照服務、補助申請、人資法規與採購規範等相關問題。\n請用繁體中文回答，語氣親切專業，條列式說明重點，若知識庫中查無相關資料請誠實告知。',
  llmProvider: 'gemini',
  llmModel: 'gemini-2.5-flash',
  llmApiKey: '',
  embedProvider: 'cohere',
  embedModel: 'embed-multilingual-light-v3.0',
  embedApiKey: '',
}

const RAG_DEFAULTS = {
  chunkSize: 1500,
  chunkOverlap: 200,
  maxEmbedLength: 2048,
  temperature: 0.3,
  maxContextSnippets: 4,
  similarityThreshold: 0.25,
  maxChunksCapacity: 50000,
}

const INTENTS = [
  { value: 'TRAINING',    label: '職業訓練 TRAINING' },
  { value: 'LONGCARE',    label: '長照法規 LONGCARE' },
  { value: 'SUBSIDY',     label: '補助相關 SUBSIDY' },
  { value: 'HR',          label: '人資規定 HR' },
  { value: 'PROCUREMENT', label: '採購規範 PROCUREMENT' },
  { value: 'GENERAL',     label: '通用查詢 GENERAL' },
]

const SETTINGS_TABS = ['連線', 'LLM', 'Embedding', 'RAG 參數']

const loadLS = (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback } catch { return fallback } }
const saveLS = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)) } catch {} }

// ── 共用樣式 ──────────────────────────────────────────────
const s = {
  card: { borderRadius: 12, border: '1px solid #27272a', background: 'rgba(24,24,27,0.9)', padding: 18 },
  label: { fontSize: 10, color: '#71717a', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 },
  btn: { border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'opacity 0.15s' },
  btnPrimary:   { padding: '7px 18px', background: '#059669', color: '#ecfdf5', fontWeight: 700, fontSize: 12, borderRadius: 8 },
  btnSecondary: { padding: '7px 18px', background: 'transparent', color: '#71717a', fontSize: 12, borderRadius: 8, border: '1px solid #3f3f46' },
  btnBlue:      { padding: '7px 18px', background: '#2563eb', color: '#eff6ff', fontWeight: 700, fontSize: 12, borderRadius: 8 },
  mono: { fontFamily: "'IBM Plex Mono', monospace" },
}

const BADGE_STYLES = {
  green:  { background: '#064e3b', color: '#6ee7b7', border: '1px solid #065f46' },
  red:    { background: '#450a0a', color: '#fca5a5', border: '1px solid #7f1d1d' },
  yellow: { background: '#451a03', color: '#fcd34d', border: '1px solid #78350f' },
  blue:   { background: '#1e3a5f', color: '#93c5fd', border: '1px solid #1e40af' },
  gray:   { background: '#27272a', color: '#a1a1aa', border: '1px solid #3f3f46' },
  purple: { background: '#3b0764', color: '#d8b4fe', border: '1px solid #6b21a8' },
  orange: { background: '#431407', color: '#fb923c', border: '1px solid #9a3412' },
}

// ── 小元件 ────────────────────────────────────────────────
const Badge = ({ color, children }) => (
  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, ...s.mono, ...(BADGE_STYLES[color] || BADGE_STYLES.gray) }}>{children}</span>
)
const Card = ({ children, style }) => <div style={{ ...s.card, ...style }}>{children}</div>
const Label = ({ children }) => <div style={s.label}>{children}</div>
const Spinner = () => <span className="spinner" />
const InfoBox = ({ color, children }) => {
  const map = {
    yellow: { background: 'rgba(78,35,3,0.3)',   border: '1px solid #78350f', color: '#fcd34d' },
    red:    { background: 'rgba(127,29,29,0.3)', border: '1px solid #7f1d1d', color: '#fca5a5' },
    green:  { background: 'rgba(6,78,59,0.3)',   border: '1px solid #065f46', color: '#6ee7b7' },
    blue:   { background: 'rgba(30,58,95,0.4)',  border: '1px solid #1e40af', color: '#93c5fd' },
  }
  return <div style={{ fontSize: 11, borderRadius: 6, padding: '8px 12px', ...map[color] }}>{children}</div>
}

const SliderField = ({ label, value, min, max, step, onChange, unit = '', hint = '' }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
      <div style={{ fontSize: 11, color: '#a1a1aa' }}>{label}</div>
      <div style={{ fontSize: 13, color: '#6ee7b7', ...s.mono, fontWeight: 700 }}>{value}{unit}</div>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value))}
      style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer', background: 'transparent', height: 4 }} />
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#3f3f46', marginTop: 3 }}>
      <span>{min}{unit}</span>
      {hint && <span style={{ color: '#52525b' }}>{hint}</span>}
      <span>{max}{unit}</span>
    </div>
  </div>
)

// ── 容量進度條 ────────────────────────────────────────────
const UsageBar = ({ used, max, label, color = '#10b981' }) => {
  const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0
  const barColor = pct > 85 ? '#f87171' : pct > 60 ? '#fcd34d' : color
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: '#a1a1aa' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: barColor, ...s.mono }}>{used.toLocaleString()} / {max.toLocaleString()}</span>
          <Badge color={pct > 85 ? 'red' : pct > 60 ? 'yellow' : 'green'}>{pct.toFixed(1)}%</Badge>
        </div>
      </div>
      <div style={{ height: 6, background: '#27272a', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

// ── API Key 欄位（含「使用 env 變數」提示）──────────────────
const ApiKeyField = ({ value, onChange, placeholder, envName }) => {
  const [show, setShow] = useState(false)
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={`留空 → 使用伺服器 ${envName}`}
            style={{ ...s.mono, paddingRight: 32 }}
          />
          <button onClick={() => setShow(s => !s)}
            style={{ ...s.btn, position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#52525b', background: 'none', border: 'none', padding: 0 }}>
            {show ? '🙈' : '👁'}
          </button>
        </div>
      </div>
      <div style={{ fontSize: 10, color: '#3f3f46', marginTop: 4 }}>
        留空 = 使用 kb-service 的 <code style={{ color: '#52525b' }}>{envName}</code> 環境變數
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab] = useState('status')
  const [settingsTab, setSettingsTab] = useState('連線')

  const [conn, setConn] = useState(CONN_DEFAULTS)
  const [connDraft, setConnDraft] = useState(CONN_DEFAULTS)
  const [ai, setAi] = useState(() => loadLS('kb_ai', AI_DEFAULTS))
  const [aiDraft, setAiDraft] = useState(() => loadLS('kb_ai', AI_DEFAULTS))
  const [rag, setRag] = useState(() => loadLS('kb_rag', RAG_DEFAULTS))
  const [ragDraft, setRagDraft] = useState(() => loadLS('kb_rag', RAG_DEFAULTS))

  // status
  const [health, setHealth] = useState(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [docs, setDocs] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [dbStats, setDbStats] = useState(null)   // { totalDocs, totalChunks }
  const [statsLoading, setStatsLoading] = useState(false)

  // upload
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadResult, setUploadResult] = useState(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [jobStatus, setJobStatus] = useState(null)
  const pollIntervalRef = useRef(null)
  const fileRef = useRef()

  // query
  const [queryText, setQueryText] = useState('')
  const [queryIntent, setQueryIntent] = useState('GENERAL')
  const [queryResult, setQueryResult] = useState(null)
  const [queryLoading, setQueryLoading] = useState(false)
  const [queryError, setQueryError] = useState('')

  const currentLlmProvider   = LLM_PROVIDERS.find(p => p.value === aiDraft.llmProvider)   || LLM_PROVIDERS[0]
  const currentEmbedProvider = EMBED_PROVIDERS.find(p => p.value === aiDraft.embedProvider) || EMBED_PROVIDERS[0]
  const currentEmbedDim = currentEmbedProvider.dim?.[ai.embedModel] ?? '—'

  // ── API ────────────────────────────────────────────────
  const fetchHealth = useCallback(async () => {
    setHealthLoading(true)
    try { const r = await fetch(`${conn.kbUrl}/health`); const d = await r.json(); setHealth({ ok: r.ok, ...d }) }
    catch (e) { setHealth({ ok: false, error: e.message }) }
    setHealthLoading(false)
  }, [conn.kbUrl])

  const fetchStats = useCallback(async () => {
    if (!conn.supabaseUrl || !conn.supabaseKey) return
    setStatsLoading(true)
    try {
      const h = { apikey: conn.supabaseKey, Authorization: `Bearer ${conn.supabaseKey}`, 'Accept-Profile': 'kb' }

      // 文件數
      const r1 = await fetch(`${conn.supabaseUrl}/rest/v1/document_index?select=id,status`, { headers: h })
      const docs = await r1.json()
      const totalDocs = Array.isArray(docs) ? docs.length : 0
      const activeDocs = Array.isArray(docs) ? docs.filter(d => d.status === 'active').length : 0

      // chunk 數（用 HEAD + content-range）
      const r2 = await fetch(
        `${conn.supabaseUrl}/rest/v1/document_chunks?select=id`,
        { headers: { ...h, Prefer: 'count=exact', 'Range-Unit': 'items', Range: '0-0' } }
      )
      const cr = r2.headers.get('content-range')
      const totalChunks = cr ? parseInt(cr.split('/')[1]) || 0 : 0

      setDbStats({ totalDocs, activeDocs, totalChunks })
    } catch { setDbStats(null) }
    setStatsLoading(false)
  }, [conn.supabaseUrl, conn.supabaseKey])

  const fetchDocs = useCallback(async () => {
    if (!conn.supabaseUrl || !conn.supabaseKey) return
    setDocsLoading(true)
    try {
      const h = { apikey: conn.supabaseKey, Authorization: `Bearer ${conn.supabaseKey}`, 'Accept-Profile': 'kb' }
      const r = await fetch(`${conn.supabaseUrl}/rest/v1/document_index?select=*&order=uploaded_at.desc`, { headers: h })
      const d = await r.json()
      setDocs(Array.isArray(d) ? d : [])
    } catch { setDocs([]) }
    setDocsLoading(false)
  }, [conn.supabaseUrl, conn.supabaseKey])

  useEffect(() => {
    if (tab === 'status') { fetchHealth(); fetchStats() }
    if (tab === 'docs') { fetchDocs(); fetchStats() }
  }, [tab]) // eslint-disable-line

  useEffect(() => { return () => stopPolling() }, []) // eslint-disable-line

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }

  const startPolling = (jobId) => {
    stopPolling()
    pollIntervalRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${conn.kbUrl}/job/${jobId}`)
        const d = await r.json()
        setJobStatus(d)
        if (d.status === 'done' || d.status === 'failed') {
          stopPolling()
          if (d.status === 'done') { fetchStats(); fetchDocs() }
        }
      } catch { /* ignore poll errors */ }
    }, 3000)
  }

  const handleUpload = async () => {
    if (!uploadFile) return

    const MAX_SIZE = 50 * 1024 * 1024
    if (uploadFile.size > MAX_SIZE) {
      setUploadError(`檔案 ${(uploadFile.size/1024/1024).toFixed(1)}MB 超過上限 50MB，建議拆分後分批上傳`)
      return
    }

    stopPolling()
    setUploadLoading(true); setUploadError(''); setUploadResult(null); setJobStatus(null)
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('admin_password', conn.adminPassword)
      fd.append('chunk_size', rag.chunkSize)
      fd.append('chunk_overlap', rag.chunkOverlap)
      fd.append('max_embed_length', rag.maxEmbedLength)
      fd.append('embed_provider', ai.embedProvider)
      fd.append('embed_model', ai.embedModel)
      if (ai.embedApiKey) fd.append('embed_api_key', ai.embedApiKey)
      const r = await fetch(`${conn.kbUrl}/ingest`, { method: 'POST', body: fd })
      let d
      try { d = await r.json() } catch { d = {} }
      if (!r.ok) {
        const msg = d?.detail || d?.message || d?.error || `上傳失敗（HTTP ${r.status}）`
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
      }
      if (d.job_id) {
        setJobStatus({ job_id: d.job_id, status: 'queued', progress: 0, filename: uploadFile.name })
        startPolling(d.job_id)
      } else {
        setUploadResult(d)
        fetchStats(); fetchDocs()
      }
      setUploadFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      setUploadError(typeof e?.message === 'string' ? e.message : String(e))
    }
    setUploadLoading(false)
  }

  const handleQuery = async () => {
    if (!queryText.trim()) return
    setQueryLoading(true); setQueryError(''); setQueryResult(null)
    try {
      const body = {
        intent: queryIntent, question: queryText, session_id: 'admin-test',
        system_prompt: ai.systemPrompt,
        llm_provider: ai.llmProvider, llm_model: ai.llmModel,
        temperature: rag.temperature,
        embed_provider: ai.embedProvider, embed_model: ai.embedModel,
        max_context_snippets: rag.maxContextSnippets,
        similarity_threshold: rag.similarityThreshold,
      }
      if (ai.llmApiKey)   body.llm_api_key   = ai.llmApiKey
      if (ai.embedApiKey) body.embed_api_key = ai.embedApiKey
      const r = await fetch(`${conn.kbUrl}/query`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || d.message || JSON.stringify(d))
      setQueryResult(d)
    } catch (e) { setQueryError(e.message) }
    setQueryLoading(false)
  }

  const saveAllSettings = () => {
    setConn({ ...connDraft }); setAi({ ...aiDraft }); setRag({ ...ragDraft })
    saveLS('kb_ai', { ...aiDraft, llmApiKey: '', embedApiKey: '' })  // API Key 不存 localStorage
    saveLS('kb_rag', ragDraft)
    setTab('status')
  }

  const mainTabs = [
    { id: 'status',   icon: '⬡', label: '系統狀態' },
    { id: 'docs',     icon: '⬛', label: '文件管理' },
    { id: 'query',    icon: '◈', label: '查詢測試' },
    { id: 'settings', icon: '⚙', label: '設定' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#e4e4e7' }}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid #27272a', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: '#10b981', fontSize: 18 }}>◈</span>
        <span style={{ fontWeight: 700, letterSpacing: '0.15em', fontSize: 12, color: '#f4f4f5' }}>KB ADMIN</span>
        <span style={{ color: '#52525b', fontSize: 11 }}>v2</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Badge color={ai.llmApiKey ? 'purple' : 'gray'}>
            {ai.llmProvider} / {ai.llmModel} {ai.llmApiKey ? '🔑' : '(env)'}
          </Badge>
          <Badge color={ai.embedApiKey ? 'blue' : 'gray'}>
            {ai.embedProvider} / {ai.embedModel} {ai.embedApiKey ? '🔑' : '(env)'}
          </Badge>
          <span className="pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          <span style={{ fontSize: 11, color: '#52525b' }}>{conn.kbUrl}</span>
        </div>
      </header>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 45px)' }}>

        {/* Sidebar */}
        <nav style={{ width: 152, borderRight: '1px solid #27272a', padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
          {mainTabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              ...s.btn, padding: '9px 10px', borderRadius: 8, fontSize: 12,
              justifyContent: 'flex-start', width: '100%',
              background: tab === t.id ? 'rgba(16,185,129,0.08)' : 'transparent',
              color: tab === t.id ? '#6ee7b7' : '#71717a',
              border: tab === t.id ? '1px solid #065f46' : '1px solid transparent',
            }}>
              <span style={{ fontSize: 13 }}>{t.icon}</span> {t.label}
            </button>
          ))}

          {/* RAG 快覽 */}
          <div style={{ marginTop: 'auto', padding: '12px 4px 0', borderTop: '1px solid #27272a' }}>
            <div style={{ fontSize: 9, color: '#3f3f46', letterSpacing: '0.1em', marginBottom: 6, textTransform: 'uppercase' }}>RAG</div>
            {[
              ['Chunk', `${rag.chunkSize}/${rag.chunkOverlap}`],
              ['Temp', rag.temperature],
              ['Top-K', rag.maxContextSnippets],
              ['Sim', rag.similarityThreshold],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                <span style={{ color: '#52525b' }}>{k}</span>
                <span style={{ color: '#a1a1aa', ...s.mono }}>{v}</span>
              </div>
            ))}
            {dbStats && (
              <>
                <div style={{ marginTop: 8, borderTop: '1px solid #27272a', paddingTop: 8 }}>
                  <div style={{ fontSize: 9, color: '#3f3f46', letterSpacing: '0.1em', marginBottom: 5, textTransform: 'uppercase' }}>容量</div>
                  <div style={{ height: 4, background: '#27272a', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      width: `${Math.min((dbStats.totalChunks / rag.maxChunksCapacity) * 100, 100)}%`,
                      background: (dbStats.totalChunks / rag.maxChunksCapacity) > 0.85 ? '#f87171' : '#10b981',
                      transition: 'width 0.4s',
                    }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#52525b', marginTop: 3, ...s.mono }}>
                    {((dbStats.totalChunks / rag.maxChunksCapacity) * 100).toFixed(1)}%
                  </div>
                </div>
              </>
            )}
          </div>
        </nav>

        {/* Main */}
        <main style={{ flex: 1, padding: 20, overflow: 'auto' }}>

          {/* ── STATUS ─────────────────────────────────── */}
          {tab === 'status' && (
            <div style={{ maxWidth: 740 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ fontWeight: 700, fontSize: 15, color: '#f4f4f5' }}>系統狀態</h2>
                <button onClick={() => { fetchHealth(); fetchStats() }} style={{ ...s.btn, ...s.btnSecondary, fontSize: 11 }}>
                  {(healthLoading || statsLoading) ? <Spinner /> : '↻'} 重新整理
                </button>
              </div>

              {/* Service cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                {[
                  { name: 'kb-service v2', url: conn.kbUrl, info: health ? (health.ok ? `v${health.version || '2.0.0'}` : (health.error || '連線失敗')) : '尚未查詢', dot: health === null ? '#52525b' : health.ok ? '#10b981' : '#f87171' },
                  { name: 'n8n 2.17.8', url: 'tk-n8n.zeabur.app', info: '外部服務', dot: '#52525b' },
                  { name: 'Supabase pgvector', url: conn.supabaseUrl.replace('https://', ''), info: conn.supabaseKey ? '金鑰已設定' : '⚠ 未設定金鑰', dot: conn.supabaseKey ? '#10b981' : '#f87171' },
                  { name: 'LINE Bot Webhook', url: '/webhook/km-care', info: 'km-care 端點', dot: '#52525b' },
                ].map(svc => (
                  <Card key={svc.name} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: svc.dot, marginTop: 3, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: '#f4f4f5', fontWeight: 600, fontSize: 12 }}>{svc.name}</div>
                      <div style={{ color: '#52525b', fontSize: 11, marginTop: 2, ...s.mono }}>{svc.url}</div>
                      <div style={{ color: '#a1a1aa', fontSize: 11, marginTop: 3 }}>{svc.info}</div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                {[
                  { label: '文件數',      value: dbStats?.totalDocs    ?? '—', color: '#6ee7b7' },
                  { label: 'Chunks',      value: dbStats?.totalChunks  ?? '—', color: '#93c5fd' },
                  { label: 'Similarity',  value: rag.similarityThreshold,      color: '#fcd34d' },
                  { label: 'Temperature', value: rag.temperature,               color: '#c4b5fd' },
                ].map(stat => (
                  <Card key={stat.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: stat.color, ...s.mono }}>{typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}</div>
                    <div style={{ color: '#52525b', fontSize: 10, marginTop: 4 }}>{stat.label}</div>
                  </Card>
                ))}
              </div>

              {/* 容量儀表板 */}
              <Card style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <Label>資料庫使用容量</Label>
                  {statsLoading && <Spinner />}
                </div>
                {!conn.supabaseKey && <InfoBox color="yellow">⚠ 請先在「設定 → 連線」填入 Supabase Service Key</InfoBox>}
                {conn.supabaseKey && dbStats && (
                  <>
                    <UsageBar
                      label="Chunk 向量儲存"
                      used={dbStats.totalChunks}
                      max={rag.maxChunksCapacity}
                    />
                    <UsageBar
                      label="文件索引（全部）"
                      used={dbStats.totalDocs}
                      max={Math.ceil(rag.maxChunksCapacity / 30)}
                      color="#93c5fd"
                    />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                      <Badge color="gray">參考上限：{rag.maxChunksCapacity.toLocaleString()} chunks</Badge>
                      <Badge color="gray">每文件約 {Math.round(dbStats.totalChunks / Math.max(dbStats.activeDocs, 1))} chunks/份</Badge>
                      <Badge color="blue">向量維度 {currentEmbedDim}</Badge>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 10, color: '#3f3f46' }}>
                      ＊最大容量為參考值，可在「設定 → RAG 參數」調整。Supabase Free 約 500MB，384 維向量每筆 ≈ 1.5KB，理論上限約 33 萬 chunks。
                    </div>
                  </>
                )}
                {conn.supabaseKey && !dbStats && !statsLoading && (
                  <div style={{ fontSize: 11, color: '#52525b' }}>無法取得統計資料，請確認 Supabase Key 與 schema 設定。</div>
                )}
              </Card>

              {health && (
                <Card>
                  <Label>Health Response</Label>
                  <pre style={{ color: '#6ee7b7', fontSize: 11 }}>{JSON.stringify(health, null, 2)}</pre>
                </Card>
              )}
            </div>
          )}

          {/* ── DOCS ───────────────────────────────────── */}
          {tab === 'docs' && (
            <div style={{ maxWidth: 740 }}>
              <h2 style={{ fontWeight: 700, fontSize: 15, color: '#f4f4f5', marginBottom: 16 }}>文件管理</h2>

              {/* 容量小卡 */}
              {dbStats && (
                <Card style={{ marginBottom: 14 }}>
                  <Label>當前容量</Label>
                  <UsageBar label="Chunk 使用量" used={dbStats.totalChunks} max={rag.maxChunksCapacity} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Badge color="green">有效文件 {dbStats.activeDocs} 份</Badge>
                    <Badge color="gray">總文件 {dbStats.totalDocs} 份</Badge>
                    <Badge color="blue">{dbStats.totalChunks.toLocaleString()} chunks</Badge>
                  </div>
                </Card>
              )}

              <Card style={{ marginBottom: 14 }}>
                <Label>上傳新文件（PDF）</Label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  <Badge color="gray">chunk {rag.chunkSize} / overlap {rag.chunkOverlap}</Badge>
                  <Badge color="gray">maxEmbed {rag.maxEmbedLength}</Badge>
                  <Badge color={ai.embedApiKey ? 'blue' : 'gray'}>{ai.embedProvider} / {ai.embedModel} {ai.embedApiKey ? '🔑' : '(env)'}</Badge>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <input ref={fileRef} type="file" accept=".pdf" onChange={e => setUploadFile(e.target.files[0])}
                    style={{ background: '#18181b', border: '1px solid #3f3f46', color: '#a1a1aa', borderRadius: 8, padding: '6px 10px' }} />
                </div>
                {uploadFile && (
                  <div style={{ fontSize: 11, color: '#a1a1aa', background: '#18181b', borderRadius: 6, padding: '5px 10px', marginBottom: 8 }}>
                    {uploadFile.name}（{(uploadFile.size / 1024).toFixed(1)} KB）
                  </div>
                )}
                <button onClick={handleUpload} disabled={!uploadFile || uploadLoading}
                  style={{ ...s.btn, ...s.btnPrimary, opacity: (!uploadFile || uploadLoading) ? 0.45 : 1, cursor: (!uploadFile || uploadLoading) ? 'not-allowed' : 'pointer' }}>
                  {uploadLoading ? <><Spinner /> 上傳中…</> : '↑ 上傳並入庫'}
                </button>
                {uploadError  && <div style={{ marginTop: 10 }}><InfoBox color="red">✕ {uploadError}</InfoBox></div>}
                {uploadResult && (
                  <div style={{ marginTop: 10 }}>
                    <InfoBox color="green">
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>✓ 上傳成功</div>
                      檔名：{uploadResult.filename}<br />
                      自動分類：{uploadResult.workspace_tags?.join(', ')}<br />
                      Chunks：{uploadResult.chunks_count}　Doc ID：{uploadResult.doc_id}
                    </InfoBox>
                  </div>
                )}
                {jobStatus && (
                  <div style={{ marginTop: 10, background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, padding: '12px 14px' }}>
                    {jobStatus.status === 'failed' ? (
                      <InfoBox color="red">❌ 處理失敗：{jobStatus.error_message}</InfoBox>
                    ) : jobStatus.status === 'done' ? (
                      <InfoBox color="green">
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>✅ 處理完成</div>
                        檔名：{jobStatus.filename}<br />
                        自動分類：{jobStatus.workspace_tags?.join(', ')}<br />
                        Chunks：{jobStatus.chunks_count}　Doc ID：{jobStatus.job_id}
                      </InfoBox>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <Spinner />
                          <span style={{ fontSize: 12, color: '#a1a1aa' }}>
                            {jobStatus.status === 'queued' ? '等待處理中...' : `處理中 ${jobStatus.progress}%`}
                          </span>
                          <span style={{ fontSize: 10, color: '#52525b', marginLeft: 'auto' }}>Job ID：{jobStatus.job_id}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#71717a', marginBottom: 8 }}>{jobStatus.filename}</div>
                        <div style={{ height: 6, background: '#27272a', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 3,
                            width: `${jobStatus.progress || 0}%`,
                            background: jobStatus.status === 'failed' ? '#f87171' : '#10b981',
                            transition: 'width 0.6s ease',
                          }} />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </Card>

              <Card>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Label>文件索引（document_index）</Label>
                  <button onClick={() => { fetchDocs(); fetchStats() }} style={{ ...s.btn, fontSize: 11, color: '#71717a', background: 'transparent', border: 'none' }}>
                    {docsLoading ? <Spinner /> : '↻ 重新整理'}
                  </button>
                </div>
                {!conn.supabaseKey && <InfoBox color="yellow">⚠ 請先在「設定 → 連線」填入 Supabase Service Key</InfoBox>}
                {docsLoading && <div style={{ fontSize: 11, color: '#52525b', display: 'flex', alignItems: 'center', gap: 6 }}><Spinner /> 載入中…</div>}
                {!docsLoading && docs.length === 0 && conn.supabaseKey && <div style={{ fontSize: 11, color: '#52525b' }}>目前無文件記錄。</div>}
                {docs.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ color: '#52525b', borderBottom: '1px solid #27272a' }}>
                          {['ID', '檔名', 'Tags', '狀態', '建立日期'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '6px 10px 6px 0', fontWeight: 400 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {docs.map(d => (
                          <tr key={d.id} style={{ borderBottom: '1px solid rgba(39,39,42,0.5)' }}>
                            <td style={{ padding: '7px 10px 7px 0', color: '#52525b', ...s.mono }}>{d.id}</td>
                            <td style={{ padding: '7px 10px 7px 0', color: '#e4e4e7', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.filename}</td>
                            <td style={{ padding: '7px 10px 7px 0' }}>
                              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                {(d.workspace_tags || []).map(t => <Badge key={t} color="blue">{t}</Badge>)}
                              </div>
                            </td>
                            <td style={{ padding: '7px 10px 7px 0' }}><Badge color={d.status === 'active' ? 'green' : 'gray'}>{d.status}</Badge></td>
                            <td style={{ padding: '7px 0', color: '#52525b' }}>{d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString('zh-TW') : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ── QUERY ──────────────────────────────────── */}
          {tab === 'query' && (
            <div style={{ maxWidth: 640 }}>
              <h2 style={{ fontWeight: 700, fontSize: 15, color: '#f4f4f5', marginBottom: 16 }}>查詢測試</h2>
              <Card style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #27272a' }}>
                  <Badge color={ai.llmApiKey ? 'purple' : 'gray'}>{ai.llmProvider} / {ai.llmModel} {ai.llmApiKey ? '🔑' : '(env)'}</Badge>
                  <Badge color={ai.embedApiKey ? 'blue' : 'gray'}>{ai.embedProvider} {ai.embedApiKey ? '🔑' : '(env)'}</Badge>
                  <Badge color="gray">temp {rag.temperature}</Badge>
                  <Badge color="gray">top-{rag.maxContextSnippets}</Badge>
                  <Badge color="gray">≥{rag.similarityThreshold}</Badge>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <Label>Intent</Label>
                  <select value={queryIntent} onChange={e => setQueryIntent(e.target.value)}>
                    {INTENTS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <Label>問題</Label>
                  <textarea value={queryText} onChange={e => setQueryText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleQuery() }}
                    rows={3} placeholder="輸入問題⋯（Ctrl+Enter 送出）"
                    style={{ resize: 'vertical', fontFamily: 'inherit' }} />
                </div>
                <button onClick={handleQuery} disabled={!queryText.trim() || queryLoading}
                  style={{ ...s.btn, ...s.btnBlue, opacity: (!queryText.trim() || queryLoading) ? 0.45 : 1, cursor: (!queryText.trim() || queryLoading) ? 'not-allowed' : 'pointer' }}>
                  {queryLoading ? <><Spinner /> 查詢中…</> : '◈ 送出查詢'}
                </button>
              </Card>

              {queryError && <Card style={{ borderColor: '#7f1d1d', marginBottom: 12 }}><div style={{ fontSize: 12, color: '#fca5a5' }}>✕ {queryError}</div></Card>}

              {queryResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Card style={{ borderColor: queryResult.has_result ? '#065f46' : '#78350f' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                      <Badge color={queryResult.has_result ? 'green' : 'yellow'}>{queryResult.has_result ? '✓ 有命中' : '⚠ 無命中'}</Badge>
                      <Badge color="blue">slug: {queryResult.slug}</Badge>
                    </div>
                    <div style={{ fontSize: 13, color: '#e4e4e7', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{queryResult.answer}</div>
                  </Card>
                  {queryResult.sources?.length > 0 && (
                    <Card>
                      <Label>來源 Chunks</Label>
                      {queryResult.sources.map((src, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, background: '#18181b', borderRadius: 6, padding: '6px 10px', marginBottom: 4 }}>
                          <span style={{ color: '#52525b', width: 20 }}>#{i + 1}</span>
                          <span style={{ color: '#a1a1aa', ...s.mono }}>chunk {src.chunk_id}</span>
                          <span style={{ color: '#52525b' }}>頁 {src.page ?? '—'}</span>
                          <span style={{ marginLeft: 'auto' }}>
                            <Badge color={src.similarity > 0.6 ? 'green' : src.similarity > 0.4 ? 'yellow' : 'gray'}>
                              {(src.similarity * 100).toFixed(1)}%
                            </Badge>
                          </span>
                        </div>
                      ))}
                    </Card>
                  )}
                  <Card><Label>Raw Response</Label><pre style={{ color: '#71717a', fontSize: 11 }}>{JSON.stringify(queryResult, null, 2)}</pre></Card>
                </div>
              )}
            </div>
          )}

          {/* ── SETTINGS ───────────────────────────────── */}
          {tab === 'settings' && (
            <div style={{ maxWidth: 580 }}>
              <h2 style={{ fontWeight: 700, fontSize: 15, color: '#f4f4f5', marginBottom: 16 }}>設定</h2>
              <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #27272a', paddingBottom: 12 }}>
                {SETTINGS_TABS.map(t => (
                  <button key={t} onClick={() => setSettingsTab(t)} style={{
                    ...s.btn, padding: '5px 14px', borderRadius: 6, fontSize: 11,
                    background: settingsTab === t ? 'rgba(16,185,129,0.1)' : 'transparent',
                    color: settingsTab === t ? '#6ee7b7' : '#52525b',
                    border: settingsTab === t ? '1px solid #065f46' : '1px solid transparent',
                  }}>{t}</button>
                ))}
              </div>

              {/* 連線 */}
              {settingsTab === '連線' && (
                <>
                  <Card style={{ marginBottom: 14 }}>
                    <Label>服務端點</Label>
                    {[
                      { key: 'kbUrl', label: 'kb-service URL', ph: 'https://tk-kb-proxy.zeabur.app' },
                      { key: 'supabaseUrl', label: 'Supabase URL', ph: 'https://xxxx.supabase.co' },
                    ].map(f => (
                      <div key={f.key} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>{f.label}</div>
                        <input value={connDraft[f.key]} onChange={e => setConnDraft(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph} style={s.mono} />
                      </div>
                    ))}
                  </Card>
                  <Card style={{ marginBottom: 14 }}>
                    <Label>認證金鑰（僅存於瀏覽器記憶體）</Label>
                    {[
                      { key: 'supabaseKey', label: 'Supabase Service Key', ph: 'eyJ...' },
                      { key: 'adminPassword', label: '上傳管理員密碼', ph: 'admin password' },
                    ].map(f => (
                      <div key={f.key} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>{f.label}</div>
                        <input type="password" value={connDraft[f.key]} onChange={e => setConnDraft(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph} style={s.mono} />
                      </div>
                    ))}
                    <InfoBox color="yellow">⚠ 金鑰僅存放於當前頁面記憶體，重新整理後需重填。</InfoBox>
                  </Card>
                </>
              )}

              {/* LLM */}
              {settingsTab === 'LLM' && (
                <>
                  <Card style={{ marginBottom: 14 }}>
                    <Label>系統提示詞（System Prompt）</Label>
                    <textarea value={aiDraft.systemPrompt} onChange={e => setAiDraft(p => ({ ...p, systemPrompt: e.target.value }))}
                      rows={8} placeholder="輸入系統提示詞…" style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.7 }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                      <span style={{ fontSize: 10, color: '#52525b' }}>{aiDraft.systemPrompt.length} 字元</span>
                      <button onClick={() => setAiDraft(p => ({ ...p, systemPrompt: AI_DEFAULTS.systemPrompt }))}
                        style={{ ...s.btn, fontSize: 10, color: '#52525b', background: 'transparent', border: 'none' }}>↺ 還原預設</button>
                    </div>
                  </Card>
                  <Card style={{ marginBottom: 14 }}>
                    <Label>LLM 提供者 / 模型 / API Key</Label>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>提供者</div>
                      <select value={aiDraft.llmProvider} onChange={e => {
                        const p = LLM_PROVIDERS.find(x => x.value === e.target.value)
                        setAiDraft(prev => ({ ...prev, llmProvider: e.target.value, llmModel: p?.models[0] || '', llmApiKey: '' }))
                      }}>
                        {LLM_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>模型</div>
                      <select value={aiDraft.llmModel} onChange={e => setAiDraft(p => ({ ...p, llmModel: e.target.value }))}>
                        {currentLlmProvider.models.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>API Key（選填）</div>
                      <ApiKeyField
                        value={aiDraft.llmApiKey}
                        onChange={v => setAiDraft(p => ({ ...p, llmApiKey: v }))}
                        placeholder={currentLlmProvider.keyPlaceholder}
                        envName={currentLlmProvider.keyEnv}
                      />
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <InfoBox color="blue">
                        留空 → kb-service 使用伺服器端 <code>{currentLlmProvider.keyEnv}</code> 環境變數<br />
                        填入 → 此 Key 會在每次請求中傳送，優先於環境變數（僅存記憶體）
                      </InfoBox>
                    </div>
                  </Card>
                </>
              )}

              {/* Embedding */}
              {settingsTab === 'Embedding' && (
                <Card style={{ marginBottom: 14 }}>
                  <Label>向量嵌入提供者 / 模型 / API Key</Label>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>提供者</div>
                    <select value={aiDraft.embedProvider} onChange={e => {
                      const p = EMBED_PROVIDERS.find(x => x.value === e.target.value)
                      setAiDraft(prev => ({ ...prev, embedProvider: e.target.value, embedModel: p?.models[0] || '', embedApiKey: '' }))
                    }}>
                      {EMBED_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>Embedding Model</div>
                    <select value={aiDraft.embedModel} onChange={e => setAiDraft(p => ({ ...p, embedModel: e.target.value }))}>
                      {currentEmbedProvider.models.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>API Key（選填）</div>
                    <ApiKeyField
                      value={aiDraft.embedApiKey}
                      onChange={v => setAiDraft(p => ({ ...p, embedApiKey: v }))}
                      placeholder={currentEmbedProvider.keyPlaceholder}
                      envName={currentEmbedProvider.keyEnv}
                    />
                  </div>
                  <div style={{ padding: '10px 12px', background: '#18181b', borderRadius: 8, fontSize: 11, marginBottom: 10 }}>
                    <div style={{ color: '#52525b', marginBottom: 6 }}>模型資訊</div>
                    <div style={{ display: 'flex', gap: 20 }}>
                      <div><span style={{ color: '#52525b' }}>維度：</span><span style={{ color: '#93c5fd', ...s.mono }}>{currentEmbedProvider.dim?.[aiDraft.embedModel] ?? '—'}</span></div>
                      <div><span style={{ color: '#52525b' }}>提供者：</span><span style={{ color: '#a1a1aa' }}>{currentEmbedProvider.label}</span></div>
                    </div>
                  </div>
                  <InfoBox color="yellow">
                    ⚠ 更換 Embedding 模型後，原有向量與新模型不相容，需重新上傳所有文件重建索引。<br />
                    API Key 不會存入 localStorage，重新整理後需重填。
                  </InfoBox>
                </Card>
              )}

              {/* RAG 參數 */}
              {settingsTab === 'RAG 參數' && (
                <Card style={{ marginBottom: 14 }}>
                  <Label>切割參數</Label>
                  <SliderField label="Text Chunk Size（切割字數）" value={ragDraft.chunkSize} min={200} max={3000} step={100} unit=" 字" hint="建議 800–1500" onChange={v => setRagDraft(p => ({ ...p, chunkSize: v }))} />
                  <SliderField label="Text Chunk Overlap（重疊字數）" value={ragDraft.chunkOverlap} min={0} max={600} step={20} unit=" 字" hint="建議 chunk×15–20%" onChange={v => setRagDraft(p => ({ ...p, chunkOverlap: v }))} />
                  <SliderField label="Max Embedding Chunk Length（嵌入上限）" value={ragDraft.maxEmbedLength} min={256} max={4096} step={128} unit=" 字" onChange={v => setRagDraft(p => ({ ...p, maxEmbedLength: v }))} />

                  <div style={{ margin: '16px 0 14px', borderTop: '1px solid #27272a' }} />
                  <Label>LLM 生成參數</Label>
                  <SliderField label="LLM Temperature（創意程度）" value={ragDraft.temperature} min={0} max={1} step={0.05} hint="0=精確　1=發散" onChange={v => setRagDraft(p => ({ ...p, temperature: v }))} />

                  <div style={{ margin: '16px 0 14px', borderTop: '1px solid #27272a' }} />
                  <Label>檢索參數</Label>
                  <SliderField label="Max Context Snippets（最多引用 chunk 數）" value={ragDraft.maxContextSnippets} min={1} max={10} step={1} unit=" 筆" onChange={v => setRagDraft(p => ({ ...p, maxContextSnippets: v }))} />
                  <SliderField label="Document Similarity Threshold（相似度門檻）" value={ragDraft.similarityThreshold} min={0.1} max={0.9} step={0.05} hint="太高→無結果　太低→雜訊多" onChange={v => setRagDraft(p => ({ ...p, similarityThreshold: v }))} />

                  <div style={{ margin: '16px 0 14px', borderTop: '1px solid #27272a' }} />
                  <Label>容量參考設定</Label>
                  <SliderField label="最大 Chunks 參考上限（用於顯示使用率）" value={ragDraft.maxChunksCapacity} min={5000} max={330000} step={5000} unit="" hint="Free ≈ 330,000" onChange={v => setRagDraft(p => ({ ...p, maxChunksCapacity: v }))} />

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => setRagDraft(RAG_DEFAULTS)} style={{ ...s.btn, fontSize: 10, color: '#52525b', background: 'transparent', border: 'none' }}>↺ 還原 RAG 預設</button>
                  </div>
                </Card>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={saveAllSettings} style={{ ...s.btn, ...s.btnPrimary }}>✓ 儲存全部設定</button>
                <button onClick={() => { setConnDraft(CONN_DEFAULTS); setAiDraft(AI_DEFAULTS); setRagDraft(RAG_DEFAULTS) }}
                  style={{ ...s.btn, ...s.btnSecondary }}>還原全部預設</button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}


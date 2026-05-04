import { useState, useEffect, useCallback, useRef } from 'react'

// ── 設定預設值 ──────────────────────────────────────────────
const DEFAULTS = {
  kbUrl: 'https://tk-kb-proxy.zeabur.app',
  supabaseUrl: 'https://ttryhemtkvsybfhonwyh.supabase.co',
  supabaseKey: '',
  adminPassword: '',
}

const INTENTS = [
  { value: 'TRAINING',    label: '職業訓練 TRAINING' },
  { value: 'LONGCARE',    label: '長照法規 LONGCARE' },
  { value: 'SUBSIDY',     label: '補助相關 SUBSIDY' },
  { value: 'HR',          label: '人資規定 HR' },
  { value: 'PROCUREMENT', label: '採購規範 PROCUREMENT' },
  { value: 'GENERAL',     label: '通用查詢 GENERAL' },
]

// ── 共用樣式 ────────────────────────────────────────────────
const s = {
  card: {
    borderRadius: 12, border: '1px solid #27272a',
    background: 'rgba(24,24,27,0.9)', padding: 18,
  },
  label: {
    fontSize: 10, color: '#71717a', letterSpacing: '0.1em',
    textTransform: 'uppercase', marginBottom: 6,
  },
  btn: {
    border: 'none', cursor: 'pointer',
    fontFamily: 'inherit', display: 'inline-flex',
    alignItems: 'center', gap: 6, transition: 'opacity 0.15s',
  },
  btnPrimary: {
    padding: '7px 18px', background: '#059669', color: '#ecfdf5',
    fontWeight: 700, fontSize: 12, borderRadius: 8,
  },
  btnSecondary: {
    padding: '7px 18px', background: 'transparent',
    color: '#71717a', fontSize: 12, borderRadius: 8,
    border: '1px solid #3f3f46',
  },
  btnBlue: {
    padding: '7px 18px', background: '#2563eb', color: '#eff6ff',
    fontWeight: 700, fontSize: 12, borderRadius: 8,
  },
  mono: { fontFamily: "'IBM Plex Mono', monospace" },
}

// ── 小元件 ──────────────────────────────────────────────────
const Badge = ({ color, children }) => {
  const map = {
    green:  { background: '#064e3b', color: '#6ee7b7', border: '1px solid #065f46' },
    red:    { background: '#450a0a', color: '#fca5a5', border: '1px solid #7f1d1d' },
    yellow: { background: '#451a03', color: '#fcd34d', border: '1px solid #78350f' },
    blue:   { background: '#1e3a5f', color: '#93c5fd', border: '1px solid #1e40af' },
    gray:   { background: '#27272a', color: '#a1a1aa', border: '1px solid #3f3f46' },
  }
  return (
    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, ...s.mono, ...(map[color] || map.gray) }}>
      {children}
    </span>
  )
}

const Card = ({ children, style }) => (
  <div style={{ ...s.card, ...style }}>{children}</div>
)

const Label = ({ children }) => <div style={s.label}>{children}</div>

const Spinner = () => <span className="spinner" />

const InfoBox = ({ color, children }) => {
  const map = {
    yellow: { background: 'rgba(78,35,3,0.3)', border: '1px solid #78350f', color: '#fcd34d' },
    red:    { background: 'rgba(127,29,29,0.3)', border: '1px solid #7f1d1d', color: '#fca5a5' },
    green:  { background: 'rgba(6,78,59,0.3)', border: '1px solid #065f46', color: '#6ee7b7' },
  }
  return (
    <div style={{ fontSize: 11, borderRadius: 6, padding: '6px 10px', ...map[color] }}>
      {children}
    </div>
  )
}

// ── 主元件 ──────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('status')
  const [cfg, setCfg] = useState(DEFAULTS)
  const [cfgDraft, setCfgDraft] = useState(DEFAULTS)

  // status
  const [health, setHealth] = useState(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [docs, setDocs] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [stats, setStats] = useState(null)

  // upload
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadResult, setUploadResult] = useState(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef()

  // query
  const [queryText, setQueryText] = useState('')
  const [queryIntent, setQueryIntent] = useState('GENERAL')
  const [queryResult, setQueryResult] = useState(null)
  const [queryLoading, setQueryLoading] = useState(false)
  const [queryError, setQueryError] = useState('')

  // ── API ──────────────────────────────────────────────────
  const fetchHealth = useCallback(async () => {
    setHealthLoading(true)
    try {
      const r = await fetch(`${cfg.kbUrl}/health`)
      const d = await r.json()
      setHealth({ ok: r.ok, ...d })
    } catch (e) {
      setHealth({ ok: false, error: e.message })
    }
    setHealthLoading(false)
  }, [cfg.kbUrl])

  const fetchDocs = useCallback(async () => {
    if (!cfg.supabaseUrl || !cfg.supabaseKey) return
    setDocsLoading(true)
    try {
      const headers = {
        apikey: cfg.supabaseKey,
        Authorization: `Bearer ${cfg.supabaseKey}`,
      }
      const r = await fetch(
        `${cfg.supabaseUrl}/rest/v1/document_index?select=*&order=created_at.desc`,
        { headers: { ...headers, 'Accept-Profile': 'kb' } }
      )
      const d = await r.json()
      const list = Array.isArray(d) ? d : []
      setDocs(list)
      setStats({ totalDocs: list.length })
    } catch (e) {
      setDocs([])
    }
    setDocsLoading(false)
  }, [cfg.supabaseUrl, cfg.supabaseKey])

  useEffect(() => {
    if (tab === 'status') { fetchHealth(); fetchDocs() }
    if (tab === 'docs') fetchDocs()
  }, [tab]) // eslint-disable-line

  const handleUpload = async () => {
    if (!uploadFile) return
    setUploadLoading(true); setUploadError(''); setUploadResult(null)
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('admin_password', cfg.adminPassword)
      const r = await fetch(`${cfg.kbUrl}/ingest`, { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || JSON.stringify(d))
      setUploadResult(d)
      setUploadFile(null)
      if (fileRef.current) fileRef.current.value = ''
      fetchDocs()
    } catch (e) {
      setUploadError(e.message)
    }
    setUploadLoading(false)
  }

  const handleQuery = async () => {
    if (!queryText.trim()) return
    setQueryLoading(true); setQueryError(''); setQueryResult(null)
    try {
      const r = await fetch(`${cfg.kbUrl}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: queryIntent, question: queryText, session_id: 'admin-test' }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || JSON.stringify(d))
      setQueryResult(d)
    } catch (e) {
      setQueryError(e.message)
    }
    setQueryLoading(false)
  }

  // ── LAYOUT ───────────────────────────────────────────────
  const tabs = [
    { id: 'status',   icon: '⬡', label: '系統狀態' },
    { id: 'docs',     icon: '⬛', label: '文件管理' },
    { id: 'query',    icon: '◈', label: '查詢測試' },
    { id: 'settings', icon: '⚙', label: '設定' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#e4e4e7' }}>

      {/* Header */}
      <header style={{
        borderBottom: '1px solid #27272a', padding: '10px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ color: '#10b981', fontSize: 18 }}>◈</span>
        <span style={{ fontWeight: 700, letterSpacing: '0.15em', fontSize: 12, color: '#f4f4f5' }}>
          KB ADMIN
        </span>
        <span style={{ color: '#52525b', fontSize: 11 }}>v2</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#52525b' }}>
          <span className="pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          {cfg.kbUrl}
        </div>
      </header>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 45px)' }}>

        {/* Sidebar */}
        <nav style={{
          width: 148, borderRight: '1px solid #27272a',
          padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: 4,
          flexShrink: 0,
        }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              ...s.btn,
              padding: '9px 10px', borderRadius: 8, fontSize: 12,
              justifyContent: 'flex-start', width: '100%',
              background: tab === t.id ? 'rgba(16,185,129,0.08)' : 'transparent',
              color: tab === t.id ? '#6ee7b7' : '#71717a',
              border: tab === t.id ? '1px solid #065f46' : '1px solid transparent',
            }}>
              <span style={{ fontSize: 13 }}>{t.icon}</span> {t.label}
            </button>
          ))}
        </nav>

        {/* Main */}
        <main style={{ flex: 1, padding: 20, overflow: 'auto' }}>

          {/* ── STATUS ─────────────────────────────────── */}
          {tab === 'status' && (
            <div style={{ maxWidth: 680 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ fontWeight: 700, fontSize: 15, color: '#f4f4f5' }}>系統狀態</h2>
                <button onClick={() => { fetchHealth(); fetchDocs() }} style={{
                  ...s.btn, ...s.btnSecondary, fontSize: 11,
                }}>
                  {healthLoading ? <Spinner /> : '↻'} 重新整理
                </button>
              </div>

              {/* Service cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                {[
                  {
                    name: 'kb-service v2', url: cfg.kbUrl,
                    info: health ? (health.ok ? `v${health.version || '2.0.0'}` : (health.error || '連線失敗')) : '尚未查詢',
                    dot: health === null ? '#52525b' : health.ok ? '#10b981' : '#f87171',
                  },
                  { name: 'n8n 2.17.8', url: 'tk-n8n.zeabur.app', info: '外部服務', dot: '#52525b' },
                  {
                    name: 'Supabase pgvector', url: cfg.supabaseUrl.replace('https://', ''),
                    info: cfg.supabaseKey ? '金鑰已設定' : '⚠ 未設定金鑰',
                    dot: cfg.supabaseKey ? '#10b981' : '#f87171',
                  },
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

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                {[
                  { label: '文件總數', value: stats?.totalDocs ?? '—', color: '#6ee7b7' },
                  { label: '向量維度', value: '384', color: '#93c5fd' },
                  { label: 'Embedding', value: 'Cohere', color: '#c4b5fd' },
                ].map(stat => (
                  <Card key={stat.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: stat.color, ...s.mono }}>{stat.value}</div>
                    <div style={{ color: '#52525b', fontSize: 11, marginTop: 4 }}>{stat.label}</div>
                  </Card>
                ))}
              </div>

              {/* Health raw */}
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
            <div style={{ maxWidth: 720 }}>
              <h2 style={{ fontWeight: 700, fontSize: 15, color: '#f4f4f5', marginBottom: 16 }}>文件管理</h2>

              {/* Upload */}
              <Card style={{ marginBottom: 14 }}>
                <Label>上傳新文件（PDF）</Label>
                <div style={{ marginBottom: 10 }}>
                  <input ref={fileRef} type="file" accept=".pdf"
                    onChange={e => setUploadFile(e.target.files[0])}
                    style={{ background: '#18181b', border: '1px solid #3f3f46', color: '#a1a1aa', borderRadius: 8, padding: '6px 10px' }}
                  />
                </div>
                {uploadFile && (
                  <div style={{ fontSize: 11, color: '#a1a1aa', background: '#18181b', borderRadius: 6, padding: '5px 10px', marginBottom: 8 }}>
                    {uploadFile.name}（{(uploadFile.size / 1024).toFixed(1)} KB）
                  </div>
                )}
                <button
                  onClick={handleUpload}
                  disabled={!uploadFile || uploadLoading}
                  style={{
                    ...s.btn, ...s.btnPrimary,
                    opacity: (!uploadFile || uploadLoading) ? 0.45 : 1,
                    cursor: (!uploadFile || uploadLoading) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {uploadLoading ? <><Spinner /> 上傳中…</> : '↑ 上傳並入庫'}
                </button>

                {uploadError && (
                  <div style={{ marginTop: 10 }}>
                    <InfoBox color="red">✕ {uploadError}</InfoBox>
                  </div>
                )}
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
              </Card>

              {/* Doc list */}
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Label>文件索引（document_index）</Label>
                  <button onClick={fetchDocs} style={{ ...s.btn, fontSize: 11, color: '#71717a', background: 'transparent', border: 'none' }}>
                    {docsLoading ? <Spinner /> : '↻ 重新整理'}
                  </button>
                </div>

                {!cfg.supabaseKey && (
                  <InfoBox color="yellow">⚠ 請先在「設定」填入 Supabase Service Key 才能讀取文件清單</InfoBox>
                )}
                {docsLoading && (
                  <div style={{ fontSize: 11, color: '#52525b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Spinner /> 載入中…
                  </div>
                )}
                {!docsLoading && docs.length === 0 && cfg.supabaseKey && (
                  <div style={{ fontSize: 11, color: '#52525b' }}>目前無文件記錄。</div>
                )}
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
                            <td style={{ padding: '7px 10px 7px 0' }}>
                              <Badge color={d.status === 'active' ? 'green' : 'gray'}>{d.status}</Badge>
                            </td>
                            <td style={{ padding: '7px 0', color: '#52525b' }}>
                              {d.created_at ? new Date(d.created_at).toLocaleDateString('zh-TW') : '—'}
                            </td>
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
                <div style={{ marginBottom: 10 }}>
                  <Label>Intent（知識庫分類）</Label>
                  <select value={queryIntent} onChange={e => setQueryIntent(e.target.value)}>
                    {INTENTS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <Label>問題</Label>
                  <textarea
                    value={queryText}
                    onChange={e => setQueryText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleQuery() }}
                    rows={3}
                    placeholder="輸入測試問題，例如：職業訓練補助申請條件為何？（Ctrl+Enter 送出）"
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
                <button
                  onClick={handleQuery}
                  disabled={!queryText.trim() || queryLoading}
                  style={{
                    ...s.btn, ...s.btnBlue,
                    opacity: (!queryText.trim() || queryLoading) ? 0.45 : 1,
                    cursor: (!queryText.trim() || queryLoading) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {queryLoading ? <><Spinner /> 查詢中…</> : '◈ 送出查詢'}
                </button>
              </Card>

              {queryError && (
                <Card style={{ borderColor: '#7f1d1d', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: '#fca5a5' }}>✕ {queryError}</div>
                </Card>
              )}

              {queryResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Card style={{ borderColor: queryResult.has_result ? '#065f46' : '#78350f' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                      <Badge color={queryResult.has_result ? 'green' : 'yellow'}>
                        {queryResult.has_result ? '✓ 有命中' : '⚠ 無命中'}
                      </Badge>
                      <Badge color="blue">slug: {queryResult.slug}</Badge>
                    </div>
                    <div style={{ fontSize: 13, color: '#e4e4e7', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
                      {queryResult.answer}
                    </div>
                  </Card>

                  {queryResult.sources?.length > 0 && (
                    <Card>
                      <Label>來源 Chunks（相似度）</Label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {queryResult.sources.map((src, i) => (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            fontSize: 11, background: '#18181b', borderRadius: 6, padding: '6px 10px',
                          }}>
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
                      </div>
                    </Card>
                  )}

                  <Card>
                    <Label>Raw Response</Label>
                    <pre style={{ color: '#71717a', fontSize: 11 }}>{JSON.stringify(queryResult, null, 2)}</pre>
                  </Card>
                </div>
              )}
            </div>
          )}

          {/* ── SETTINGS ───────────────────────────────── */}
          {tab === 'settings' && (
            <div style={{ maxWidth: 520 }}>
              <h2 style={{ fontWeight: 700, fontSize: 15, color: '#f4f4f5', marginBottom: 16 }}>設定</h2>

              <Card style={{ marginBottom: 14 }}>
                <Label>服務端點</Label>
                {[
                  { key: 'kbUrl',       label: 'kb-service URL',  ph: 'https://tk-kb-proxy.zeabur.app' },
                  { key: 'supabaseUrl', label: 'Supabase URL',    ph: 'https://xxxx.supabase.co' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>{f.label}</div>
                    <input
                      value={cfgDraft[f.key]}
                      onChange={e => setCfgDraft(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.ph}
                      style={{ ...s.mono }}
                    />
                  </div>
                ))}
              </Card>

              <Card style={{ marginBottom: 14 }}>
                <Label>認證金鑰（僅存於瀏覽器記憶體，重新整理後需重填）</Label>
                {[
                  { key: 'supabaseKey',    label: 'Supabase Service Key',  ph: 'eyJ...' },
                  { key: 'adminPassword',  label: '上傳管理員密碼',         ph: 'admin password' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>{f.label}</div>
                    <input
                      type="password"
                      value={cfgDraft[f.key]}
                      onChange={e => setCfgDraft(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.ph}
                      style={{ ...s.mono }}
                    />
                  </div>
                ))}
                <div style={{ fontSize: 11, color: '#3f3f46', background: '#18181b', borderRadius: 6, padding: '6px 10px', marginTop: 4 }}>
                  ⚠ 如需持久化儲存，可將預設值直接寫入 src/App.jsx 的 DEFAULTS 物件，再重新 build。
                </div>
              </Card>

              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <button
                  onClick={() => { setCfg({ ...cfgDraft }); setTab('status') }}
                  style={{ ...s.btn, ...s.btnPrimary }}
                >
                  ✓ 儲存設定
                </button>
                <button
                  onClick={() => setCfgDraft(DEFAULTS)}
                  style={{ ...s.btn, ...s.btnSecondary }}
                >
                  還原預設
                </button>
              </div>

              <Card>
                <Label>目前生效設定</Label>
                <pre style={{ color: '#71717a', fontSize: 11 }}>
                  {JSON.stringify({
                    ...cfg,
                    supabaseKey:   cfg.supabaseKey   ? '***' : '(未設定)',
                    adminPassword: cfg.adminPassword ? '***' : '(未設定)',
                  }, null, 2)}
                </pre>
              </Card>
            </div>
          )}

        </main>
      </div>
    </div>
  )
    }

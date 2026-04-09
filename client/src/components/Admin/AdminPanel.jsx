import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { apiGet, apiPost, apiDelete } from '../../utils/api.js'
import PageHeader from '../PageHeader.jsx'

const TABS = ['Dashboard', 'Online', 'Utenti', 'Mostri', 'Superfici', 'Livelli', 'Attività']

const PAGE_LABELS = {
  home:     '⌂ Home',
  game:     '► Gioco',
  monsters: '☠ Mostri',
  surfaces: '▦ Superfici',
  levels:   '⊞ Livelli',
  admin:    '⚙ Admin',
}

export default function AdminPanel() {
  const { user } = useAuth()
  const [tab, setTab]     = useState('Dashboard')
  const [data, setData]   = useState({})
  const [loading, setLoading] = useState(false)
  const onlineTimerRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (tab === 'Dashboard') {
        const r = await apiGet('/admin/stats')
        setData(await r.json())
      } else if (tab === 'Online') {
        const r = await apiGet('/admin/online')
        setData({ list: await r.json() })
      } else if (tab === 'Utenti') {
        const r = await apiGet('/admin/users')
        setData({ list: await r.json() })
      } else if (tab === 'Mostri') {
        const r = await apiGet('/admin/monsters')
        setData({ list: await r.json() })
      } else if (tab === 'Superfici') {
        const r = await apiGet('/admin/surfaces')
        setData({ list: await r.json() })
      } else if (tab === 'Livelli') {
        const r = await apiGet('/admin/levels')
        setData({ list: await r.json() })
      } else if (tab === 'Attività') {
        const r = await apiGet('/admin/activity')
        setData(await r.json())
      }
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { load() }, [load])

  // Auto-refresh Online tab every 15s
  useEffect(() => {
    clearInterval(onlineTimerRef.current)
    if (tab === 'Online') {
      onlineTimerRef.current = setInterval(load, 15_000)
    }
    return () => clearInterval(onlineTimerRef.current)
  }, [tab, load])

  if (!user?.isAdmin) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#cc2200', fontFamily:'monospace' }}>
        Accesso negato — area riservata agli amministratori.
      </div>
    )
  }

  const del = async (endpoint, id) => {
    if (!confirm('Eliminare questo elemento?')) return
    await apiDelete(`/admin/${endpoint}/${id}`)
    load()
  }

  const promote = async (id) => { await apiPost(`/admin/users/${id}/promote`); load() }
  const demote  = async (id) => { await apiDelete(`/admin/users/${id}/demote`); load() }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <PageHeader title="Pannello Admin" />

      {/* Tab bar */}
      <div className="tab-bar">
        {TABS.map(t => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
            style={t === 'Online' ? { position:'relative' } : {}}
          >
            {t}
            {t === 'Online' && data.list?.length > 0 && tab !== 'Online' && (
              <span style={{
                position:'absolute', top:4, right:4,
                background:'#cc2200', color:'#fff', borderRadius:'50%',
                width:14, height:14, fontSize:9, display:'flex',
                alignItems:'center', justifyContent:'center', fontWeight:'bold',
              }}>{data.list.length}</span>
            )}
          </div>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:20 }}>
        {loading && <div style={{ color:'#664422', fontSize:12 }}><span className="spinner"/>Caricamento...</div>}

        {/* ── Dashboard ── */}
        {tab === 'Dashboard' && !loading && (
          <div>
            <div style={{ color:'#cc2200', fontSize:11, letterSpacing:3, marginBottom:20 }}>STATISTICHE GLOBALI</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12 }}>
              {[
                { label:'Utenti',    val: data.users,    color:'#4488ff' },
                { label:'Admin',     val: data.admins,   color:'#ffcc00' },
                { label:'Online ora',val: data.online,   color:'#44cc44' },
                { label:'Mostri',    val: data.monsters, color:'#cc2200' },
                { label:'Superfici', val: data.surfaces, color:'#44aa44' },
                { label:'Livelli',   val: data.levels,   color:'#aa44aa' },
              ].map(s => (
                <div key={s.label} style={{ background:'#111', border:'1px solid #222', padding:'16px 20px' }}>
                  <div style={{ fontSize:28, fontWeight:'bold', color:s.color, fontFamily:'monospace' }}>{s.val ?? '—'}</div>
                  <div style={{ fontSize:11, color:'#555', letterSpacing:2, marginTop:4 }}>{s.label.toUpperCase()}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:32, color:'#332211', fontSize:11 }}>
              Loggato come: <span style={{color:'#664422'}}>{user.email}</span>
            </div>
          </div>
        )}

        {/* ── Online ── */}
        {tab === 'Online' && !loading && (
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ color:'#cc2200', fontSize:11, letterSpacing:3 }}>UTENTI CONNESSI ORA</div>
              <div style={{ color:'#332211', fontSize:10 }}>aggiornamento automatico ogni 15s</div>
            </div>
            {!(data.list?.length) ? (
              <div style={{ color:'#333', fontSize:13, marginTop:40, textAlign:'center' }}>Nessun utente connesso.</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {(data.list || []).map(u => (
                  <div key={u.id} style={{
                    display:'flex', alignItems:'center', gap:14,
                    background:'#111', border:'1px solid #1a0a00',
                    padding:'12px 16px',
                  }}>
                    {u.avatar
                      ? <img src={u.avatar} style={{ width:32, height:32, borderRadius:'50%', border:'1px solid #331500' }} alt="" />
                      : <div style={{ width:32, height:32, borderRadius:'50%', background:'#1a0800', border:'1px solid #331500' }} />
                    }
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:'#cc8844', fontSize:12, fontFamily:'monospace' }}>{u.name}</div>
                      <div style={{ color:'#443322', fontSize:10 }}>{u.email}</div>
                    </div>
                    {/* Current page */}
                    <div style={{
                      background: u.page === 'game' ? '#1a0600' : '#0a0d00',
                      border: `1px solid ${u.page === 'game' ? '#cc220044' : '#22440044'}`,
                      color: u.page === 'game' ? '#cc4400' : '#448822',
                      fontFamily:'monospace', fontSize:11, padding:'4px 12px', letterSpacing:1,
                    }}>
                      {PAGE_LABELS[u.page] || u.page || '—'}
                    </div>
                    {/* Session duration */}
                    <div style={{ color:'#554422', fontSize:10, minWidth:70, textAlign:'right', fontFamily:'monospace' }}>
                      {fmtDuration(u.session_secs)}
                    </div>
                    {/* Heartbeat */}
                    <div style={{ color:'#332211', fontSize:10, minWidth:55, textAlign:'right' }}>
                      {u.seconds_ago < 60 ? `${u.seconds_ago}s fa` : `${Math.floor(u.seconds_ago/60)}m fa`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Utenti ── */}
        {tab === 'Utenti' && !loading && (
          <ContentTable
            columns={['Nome','Email','Mostri','Superfici','Livelli','Admin','Azioni']}
            rows={(data.list || []).map(u => [
              <UserCell key="u" name={u.name} avatar={u.avatar_url} />,
              <span style={{color:'#888',fontSize:11}}>{u.email}</span>,
              u.monsters, u.surfaces, u.levels,
              <AdminBadge key="a" isAdmin={!!u.is_admin} />,
              <div key="act" style={{display:'flex',gap:6}}>
                {!u.is_admin
                  ? <ActionBtn label="Promuovi" color="#ffcc00" onClick={() => promote(u.id)} />
                  : u.email !== user.email
                    ? <ActionBtn label="Revoca" color="#cc4400" onClick={() => demote(u.id)} />
                    : null
                }
                {u.email !== user.email && (
                  <ActionBtn label="Elimina" color="#cc2200" onClick={() => del('users', u.id)} />
                )}
              </div>
            ])}
          />
        )}

        {/* ── Mostri ── */}
        {tab === 'Mostri' && !loading && (
          <ContentTable
            columns={['Nome','Utente','HP','Speed','Comportamento','Data','Azioni']}
            rows={(data.list || []).map(m => [
              m.name,
              <span key="u" style={{color:'#666',fontSize:11}}>{m.user_name}</span>,
              m.health, m.speed, m.behavior,
              <DateCell key="d" val={m.created_at} />,
              <ActionBtn key="del" label="Elimina" color="#cc2200" onClick={() => del('monsters', m.id)} />
            ])}
          />
        )}

        {/* ── Superfici ── */}
        {tab === 'Superfici' && !loading && (
          <ContentTable
            columns={['Nome','Utente','Tipo','Pattern','Colore','Data','Azioni']}
            rows={(data.list || []).map(s => [
              s.name,
              <span key="u" style={{color:'#666',fontSize:11}}>{s.user_name}</span>,
              s.surface_type, s.pattern,
              <ColorSwatch key="c" color={s.primary_color} />,
              <DateCell key="d" val={s.created_at} />,
              <ActionBtn key="del" label="Elimina" color="#cc2200" onClick={() => del('surfaces', s.id)} />
            ])}
          />
        )}

        {/* ── Livelli ── */}
        {tab === 'Livelli' && !loading && (
          <ContentTable
            columns={['Nome','Utente','Descrizione','Data','Azioni']}
            rows={(data.list || []).map(l => [
              l.name,
              <span key="u" style={{color:'#666',fontSize:11}}>{l.user_name}</span>,
              <span key="d" style={{color:'#555',fontSize:11}}>{l.description || '—'}</span>,
              <DateCell key="dt" val={l.created_at} />,
              <ActionBtn key="del" label="Elimina" color="#cc2200" onClick={() => del('levels', l.id)} />
            ])}
          />
        )}

        {/* ── Attività ── */}
        {tab === 'Attività' && !loading && (
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ color:'#cc2200', fontSize:11, letterSpacing:3 }}>SESSIONI UTENTI</div>
              <div style={{ color:'#332211', fontSize:10 }}>
                {data.total ?? 0} sessioni totali
              </div>
            </div>
            <ContentTable
              columns={['Utente','Login','Logout','Durata','Motivo','IP']}
              rows={(data.rows || []).map(s => [
                <UserCell key="u" name={s.user_name} avatar={s.avatar} />,
                <DateTimeCell key="li" val={s.login_at} />,
                s.logout_at
                  ? <DateTimeCell key="lo" val={s.logout_at} />
                  : <span key="lo" style={{color:'#44cc44',fontSize:10,fontFamily:'monospace'}}>● ONLINE</span>,
                s.duration_secs != null
                  ? <span key="d" style={{color:'#886644',fontSize:11,fontFamily:'monospace'}}>{fmtDuration(s.duration_secs)}</span>
                  : <span key="d" style={{color:'#333'}}>—</span>,
                s.logout_reason ? <ReasonBadge key="r" reason={s.logout_reason} /> : <span key="r" style={{color:'#333'}}>—</span>,
                <span key="ip" style={{color:'#333',fontSize:10,fontFamily:'monospace'}}>{s.ip || '—'}</span>,
              ])}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ContentTable({ columns, rows }) {
  if (!rows.length) return <div style={{color:'#333',fontSize:13,marginTop:40,textAlign:'center'}}>Nessun elemento.</div>
  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'monospace', fontSize:12 }}>
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c} style={{ textAlign:'left', padding:'8px 12px', color:'#553322', fontSize:10, letterSpacing:2, borderBottom:'1px solid #1a0a00' }}>
                {c.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom:'1px solid #111' }}
              onMouseEnter={e => e.currentTarget.style.background='#110a00'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}
            >
              {row.map((cell, j) => (
                <td key={j} style={{ padding:'8px 12px', color:'#aaa', verticalAlign:'middle' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ActionBtn({ label, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      background:'transparent', border:`1px solid ${color}33`,
      color, fontFamily:'monospace', fontSize:10, letterSpacing:1,
      padding:'3px 8px', cursor:'pointer', transition:'all 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.background = color + '22'}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >{label}</button>
  )
}

function AdminBadge({ isAdmin }) {
  return isAdmin
    ? <span style={{color:'#ffcc00',fontSize:10,border:'1px solid #ffcc0044',padding:'2px 6px'}}>ADMIN</span>
    : <span style={{color:'#333',fontSize:10}}>—</span>
}

function fmtDuration(secs) {
  if (secs == null) return '—'
  if (secs < 60)   return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs/60)}m ${secs%60}s`
  return `${Math.floor(secs/3600)}h ${Math.floor((secs%3600)/60)}m`
}

function ReasonBadge({ reason }) {
  const colors = { manual:'#888', timeout:'#cc8800', system:'#4488cc' }
  const c = colors[reason] || '#555'
  return <span style={{color:c,fontSize:10}}>{reason}</span>
}

function UserCell({ name, avatar }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      {avatar && <img src={avatar} style={{ width:22, height:22, borderRadius:'50%' }} alt="" />}
      <span>{name}</span>
    </div>
  )
}

function ColorSwatch({ color }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <div style={{ width:14, height:14, background:color, border:'1px solid #333' }} />
      <span style={{ color:'#555', fontSize:10 }}>{color}</span>
    </div>
  )
}

function DateCell({ val }) {
  if (!val) return <span style={{color:'#333'}}>—</span>
  return <span style={{color:'#443322',fontSize:10}}>{new Date(val).toLocaleDateString('it-IT')}</span>
}

function DateTimeCell({ val }) {
  if (!val) return <span style={{color:'#333'}}>—</span>
  const d = new Date(val)
  return (
    <span style={{color:'#443322',fontSize:10,fontFamily:'monospace'}}>
      {d.toLocaleDateString('it-IT')} {d.toLocaleTimeString('it-IT')}
    </span>
  )
}

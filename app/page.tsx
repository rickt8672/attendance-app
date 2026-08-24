'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface Event {
  id: string
  title: string
  event_date: string
  event_time: string
  location: string
  created_at: string
}

interface Member {
  id: string
  name: string
  role: string
}

interface Attendance {
  id: string
  event_id: string
  member_id: string
  status: 'yes' | 'maybe' | 'no' | null
  updated_at: string
}

export default function Home() {
  const [tab, setTab] = useState<'events' | 'stats' | 'admin'>('events')
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUser, setCurrentUser] = useState('')
  const [memberIdInput, setMemberIdInput] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [hasEnteredApp, setHasEnteredApp] = useState(false)
  const [verificationError, setVerificationError] = useState('')
  const [databaseMembers, setDatabaseMembers] = useState<Member[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [detailEvent, setDetailEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)

  // Form states
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const [editingEventId, setEditingEventId] = useState<string | null>(null)

  const currentMember = databaseMembers.find(member => member.name === currentUser)
  const canSwitchAdminMode = isVerified && currentMember?.role === 'admin'

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: memberData }, { data: evData }, { data: attData }] = await Promise.all([
      supabase.from('members').select('*'),
      supabase.from('events').select('*').order('event_date', { ascending: true }),
      supabase.from('attendances').select('*'),
    ])
    const loadedMembers = [...(memberData || [])].sort((a, b) => {
      const getIdNumber = (value: string) => {
        const match = value.match(/\d+/g)
        if (!match) return Number.MAX_SAFE_INTEGER
        return Number(match[match.length - 1])
      }

      const aNumber = getIdNumber(String(a.id))
      const bNumber = getIdNumber(String(b.id))

      if (aNumber !== bNumber) return aNumber - bNumber
      return String(a.id).localeCompare(String(b.id), undefined, { numeric: true, sensitivity: 'base' })
    })
    setDatabaseMembers(loadedMembers)
    setEvents(evData || [])
    setAttendances(attData || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getStatus = (eventId: string, memberId: string) => {
    const a = attendances.find(x => x.event_id === eventId && x.member_id === memberId)
    return a?.status || null
  }

  const countFor = (eventId: string, status: string) => {
    return attendances.filter(a => a.event_id === eventId && a.status === status).length
  }

  const setRSVP = async (eventId: string, status: string) => {
    if (!isVerified) return
    const memberId = databaseMembers.find(m => m.name === currentUser)?.id
    if (!memberId) return
    const existing = attendances.find(a => a.event_id === eventId && a.member_id === memberId)
    if (existing) {
      await supabase.from('attendances').update({ status }).eq('id', existing.id)
    } else {
      await supabase.from('attendances').insert({ event_id: eventId, member_id: memberId, status })
    }
    await fetchData()
  }

  const verifyMember = () => {
    const selectedMember = databaseMembers.find(member => member.name === currentUser)
    if (selectedMember && memberIdInput.trim() === selectedMember.id) {
      setIsVerified(true)
      setHasEnteredApp(true)
      setIsAdmin(false)
      setVerificationError('')
      return
    }
    setIsVerified(false)
    setVerificationError('會員姓名和會員 ID 不相符')
  }

  const addEvent = async () => {
    if (!isAdmin) return
    if (!newTitle || !newDate) return alert('請填寫活動名稱和日期')
    await supabase.from('events').insert({
      title: newTitle,
      event_date: newDate,
      event_time: newTime,
      location: newLocation,
    })
    setNewTitle(''); setNewDate(''); setNewTime(''); setNewLocation('')
    await fetchData()
  }

  const startEditingEvent = (event: Event) => {
    setEditingEventId(event.id)
    setNewTitle(event.title)
    setNewDate(event.event_date)
    setNewTime(event.event_time)
    setNewLocation(event.location)
  }

  const cancelEditingEvent = () => {
    setEditingEventId(null)
    setNewTitle('')
    setNewDate('')
    setNewTime('')
    setNewLocation('')
  }

  const updateEvent = async () => {
    if (!isAdmin || !editingEventId) return
    if (!newTitle || !newDate) return alert('請填寫活動名稱和日期')
    await supabase.from('events').update({
      title: newTitle,
      event_date: newDate,
      event_time: newTime,
      location: newLocation,
    }).eq('id', editingEventId)
    cancelEditingEvent()
    await fetchData()
  }

  const deleteEvent = async (id: string) => {
    if (!isAdmin) return
    if (!confirm('確定刪除此活動？')) return
    await supabase.from('events').delete().eq('id', id)
    await fetchData()
  }

  // Seed demo data
  const seedData = async () => {
    if (databaseMembers.length === 0) return alert('資料庫中尚無團員，請先新增 members 資料。')
    // Insert demo events
    const { data: evs } = await supabase.from('events').insert([
      { title: '8月會員大會', event_date: '2026-08-30', event_time: '14:00-17:00', location: '市民活動中心 3F' },
      { title: '中秋烤肉聯誼', event_date: '2026-09-15', event_time: '18:00-22:00', location: '河濱公園烤肉區' },
      { title: '年度志工培訓', event_date: '2026-09-28', event_time: '09:00-16:00', location: '線上 Zoom' },
    ]).select()

    if (evs) {
      const demoAttendances = []
      for (const ev of evs) {
        for (const m of databaseMembers) {
          const r = Math.random()
          let status: string | null = null
          if (r < 0.5) status = 'yes'
          else if (r < 0.7) status = 'maybe'
          else if (r < 0.85) status = 'no'
          if (status) {
            demoAttendances.push({ event_id: ev.id, member_id: m.id, status })
          }
        }
      }
      await supabase.from('attendances').insert(demoAttendances)
    }
    await fetchData()
    alert('示範資料已建立！')
  }

  const myStatus = (eventId: string) => {
    const m = databaseMembers.find(x => x.name === currentUser)
    return m ? getStatus(eventId, m.id) : null
  }

  const statusLabel = (s: string | null) => {
    if (s === 'yes') return { text: '出席', color: '#16a34a', bg: '#dcfce7' }
    if (s === 'maybe') return { text: '可能', color: '#ca8a04', bg: '#fef9c3' }
    if (s === 'no') return { text: '不出席', color: '#dc2626', bg: '#fee2e2' }
    return { text: '未回覆', color: '#9ca3af', bg: '#f3f4f6' }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>載入中...</div>

  if (!hasEnteredApp) return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 24, background: '#fff', minHeight: '100vh', boxSizing: 'border-box' }}>
      <h1 style={{ margin: '40px 0 8px', fontSize: 22, fontWeight: 800 }}>東福領唱出席調查</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: 14 }}>請選擇您的會員姓名並輸入會員 ID。</p>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 5 }}>會員姓名</label>
        <select
          value={currentUser}
          onChange={e => { setCurrentUser(e.target.value); setVerificationError('') }}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' }}
        >
          <option value="">請選擇會員姓名</option>
          {databaseMembers.map(member => <option key={member.id} value={member.name}>{member.name}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 5 }}>會員 ID</label>
        <input
          value={memberIdInput}
          onChange={e => { setMemberIdInput(e.target.value); setVerificationError('') }}
          placeholder="輸入您的會員 ID"
          autoComplete="off"
          style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' }}
        />
      </div>
      {verificationError && <div style={{ marginBottom: 14, color: '#dc2626', fontSize: 13 }}>{verificationError}</div>}
      <button
        onClick={verifyMember}
        disabled={!currentUser || !memberIdInput.trim()}
        style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: currentUser && memberIdInput.trim() ? '#111' : '#d1d5db', color: '#fff', fontSize: 14, fontWeight: 700, cursor: currentUser && memberIdInput.trim() ? 'pointer' : 'not-allowed' }}
      >
        驗證並進入
      </button>
      <button
        onClick={() => { setHasEnteredApp(true); setIsVerified(false) }}
        disabled={!currentUser}
        style={{ width: '100%', marginTop: 10, padding: 12, borderRadius: 10, border: '1px solid #d1d5db', background: '#fff', color: currentUser ? '#111' : '#9ca3af', fontSize: 14, fontWeight: 700, cursor: currentUser ? 'pointer' : 'not-allowed' }}
      >
        以唯讀模式進入
      </button>
    </div>
  )

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', background: '#fff', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>📅 東福領唱出席調查</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={currentUser}
            onChange={e => { setCurrentUser(e.target.value); setIsVerified(false); setHasEnteredApp(false); setIsAdmin(false); setMemberIdInput('') }}
            style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb' }}
          >
            {databaseMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>
          <span style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 12, fontWeight: 700,
            background: isAdmin ? '#dbeafe' : '#f3f4f6',
            color: isAdmin ? '#2563eb' : '#6b7280'
          }}>
            {isAdmin ? '管理者' : '團員'}
          </span>
        </div>
      </div>

      {/* Admin toggle */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, color: '#6b7280' }}>
        <span>切換管理者模式</span>
        <div
          onClick={() => { if (canSwitchAdminMode) setIsAdmin(!isAdmin) }}
          role="switch"
          aria-checked={isAdmin}
          aria-disabled={!canSwitchAdminMode}
          style={{
            width: 40, height: 22, borderRadius: 11, background: canSwitchAdminMode && isAdmin ? '#2563eb' : '#d1d5db',
            position: 'relative', cursor: canSwitchAdminMode ? 'pointer' : 'not-allowed', transition: 'background 0.2s', opacity: canSwitchAdminMode ? 1 : 0.6
          }}
        >
          <div style={{
            width: 18, height: 18, borderRadius: '50%', background: '#fff',
            position: 'absolute', top: 2, left: canSwitchAdminMode && isAdmin ? 20 : 2, transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
          }} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
        {[
          { key: 'events', label: '活動列表' },
          { key: 'stats', label: '統計總覽' },
          ...(isAdmin ? [{ key: 'admin', label: '活動管理' }] : [])
        ].map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key as any); setDetailEvent(null) }}
            style={{
              flex: 1, padding: '12px 4px', fontSize: 13, fontWeight: 700,
              border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: tab === t.key ? '2px solid #111' : '2px solid transparent',
              color: tab === t.key ? '#111' : '#9ca3af'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '12px 16px 40px' }}>

        {/* Events Tab */}
        {tab === 'events' && !detailEvent && (
          <>
            {events.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13 }}>
                尚無活動，請到「活動管理」新增，或點下方按鈕建立示範資料。<br/><br/>
                <button onClick={seedData} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                  🚀 建立示範資料
                </button>
              </div>
            )}
            {events.map(ev => {
              const s = myStatus(ev.id)
              const sl = statusLabel(s)
              const yes = countFor(ev.id, 'yes')
              const maybe = countFor(ev.id, 'maybe')
              const no = countFor(ev.id, 'no')
              const empty = databaseMembers.length - yes - maybe - no
              return (
                <div
                  key={ev.id}
                  onClick={() => setDetailEvent(ev)}
                  style={{
                    border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, marginBottom: 10,
                    cursor: 'pointer', transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.background = '#fafafa' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#fff' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 6 }}>{ev.title}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10, background: sl.bg, color: sl.color }}>
                      {sl.text}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>📅 {ev.event_date}</span>
                    <span>🕐 {ev.event_time}</span>
                    <span>📍 {ev.location}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 8, background: '#f3f4f6', color: '#6b7280' }}>
                      ✅ <span style={{ color: '#111' }}>{yes}</span>
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 8, background: '#f3f4f6', color: '#6b7280' }}>
                      🤔 <span style={{ color: '#111' }}>{maybe}</span>
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 8, background: '#f3f4f6', color: '#6b7280' }}>
                      ❌ <span style={{ color: '#111' }}>{no}</span>
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 8, background: '#f3f4f6', color: '#6b7280' }}>
                      ❓ <span style={{ color: '#111' }}>{empty}</span>
                    </span>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* Detail View */}
        {detailEvent && (
          <div>
            <button
              onClick={() => setDetailEvent(null)}
              style={{ fontSize: 13, color: '#9ca3af', background: 'none', border: 'none', padding: '0 0 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              ← 返回活動列表
            </button>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#111', marginBottom: 8 }}>{detailEvent.title}</div>
            <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              <span>📅 {detailEvent.event_date}</span>
              <span>🕐 {detailEvent.event_time}</span>
              <span>📍 {detailEvent.location}</span>
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '16px 0 10px', paddingBottom: 6, borderBottom: '1px solid #e5e7eb' }}>你的回覆</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {[
                { key: 'yes', label: '✅ 出席', color: '#16a34a' },
                { key: 'maybe', label: '🤔 可能', color: '#ca8a04' },
                { key: 'no', label: '❌ 不出席', color: '#dc2626' },
              ].map(btn => {
                const selected = myStatus(detailEvent.id) === btn.key
                return (
                  <button
                    key={btn.key}
                    onClick={() => isVerified && setRSVP(detailEvent.id, btn.key)}
                    disabled={!isVerified}
                    style={{
                      flex: 1, padding: 12, borderRadius: 10,
                      border: `1.5px solid ${selected ? btn.color : '#e5e7eb'}`,
                      background: selected ? btn.color + '14' : '#fff',
                      color: selected ? btn.color : '#6b7280',
                      fontSize: 13, fontWeight: 700, cursor: isVerified ? 'pointer' : 'not-allowed', opacity: isVerified ? 1 : 0.55
                    }}
                  >
                    {btn.label}
                  </button>
                )
              })}
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '16px 0 10px', paddingBottom: 6, borderBottom: '1px solid #e5e7eb' }}>出席統計</div>
            {[
              { label: '出席', status: 'yes', color: '#16a34a' },
              { label: '可能', status: 'maybe', color: '#ca8a04' },
              { label: '不出席', status: 'no', color: '#dc2626' },
              { label: '未回覆', status: 'empty', color: '#9ca3af' },
            ].map(item => {
              const count = item.status === 'empty'
                ? databaseMembers.length - countFor(detailEvent.id, 'yes') - countFor(detailEvent.id, 'maybe') - countFor(detailEvent.id, 'no')
                : countFor(detailEvent.id, item.status)
              const pct = databaseMembers.length ? (count / databaseMembers.length) * 100 : 0
              return (
                <div key={item.status} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 50, fontSize: 13, fontWeight: 600, color: item.color }}>{item.label}</div>
                  <div style={{ flex: 1, height: 10, background: '#e5e7eb', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: item.color, borderRadius: 5, transition: 'width 0.4s' }} />
                  </div>
                  <div style={{ width: 28, textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#111' }}>{count}</div>
                </div>
              )
            })}

            <div style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '16px 0 10px', paddingBottom: 6, borderBottom: '1px solid #e5e7eb' }}>團員名單</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px 14px' }}>
              {databaseMembers.map(m => {
                const s = getStatus(detailEvent.id, m.id)
                const sl = statusLabel(s)
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid #f3f4f6', borderRadius: 10, background: '#fff' }}>
                    <span style={{ fontSize: 14, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: sl.bg, color: sl.color, flexShrink: 0 }}>
                      {sl.text}
                    </span>
                  </div>
                )
              })}
            </div>
            <style jsx>{`
              @media (min-width: 640px) {
                div[style*="grid-template-columns: repeat(2, minmax(0, 1fr))"] {
                  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                }
              }
              @media (min-width: 960px) {
                div[style*="grid-template-columns: repeat(2, minmax(0, 1fr))"] {
                  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
                }
              }
            `}</style>
          </div>
        )}

        {/* Stats Tab */}
        {tab === 'stats' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { label: '確認出席', get: () => attendances.filter(a => a.status === 'yes').length, color: '#16a34a' },
                { label: '可能出席', get: () => attendances.filter(a => a.status === 'maybe').length, color: '#ca8a04' },
                { label: '不出席', get: () => attendances.filter(a => a.status === 'no').length, color: '#dc2626' },
                { label: '未回覆', get: () => events.length * databaseMembers.length - attendances.filter(a => a.status).length, color: '#9ca3af' },
              ].map(s => (
                <div key={s.label} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.get()}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '16px 0 10px', paddingBottom: 6, borderBottom: '1px solid #e5e7eb' }}>各活動出席率</div>
            {events.map(ev => {
              const yes = countFor(ev.id, 'yes')
              const maybe = countFor(ev.id, 'maybe')
              const no = countFor(ev.id, 'no')
              return (
                <div key={ev.id} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 6 }}>{ev.title}</div>
                  {[
                    { label: '出席', count: yes, color: '#16a34a' },
                    { label: '可能', count: maybe, color: '#ca8a04' },
                    { label: '不出席', count: no, color: '#dc2626' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <div style={{ width: 50, fontSize: 12, fontWeight: 600, color: item.color }}>{item.label}</div>
                      <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${databaseMembers.length ? (item.count / databaseMembers.length) * 100 : 0}%`, height: '100%', background: item.color, borderRadius: 4 }} />
                      </div>
                      <div style={{ width: 24, textAlign: 'right', fontSize: 12, fontWeight: 700 }}>{item.count}</div>
                    </div>
                  ))}
                </div>
              )
            })}
          </>
        )}

        {/* Admin Tab */}
        {tab === 'admin' && isAdmin && (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 12 }}>{editingEventId ? '修改活動' : '新增活動'}</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 5 }}>活動名稱</label>
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="例如：年度聚餐" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 5 }}>日期</label>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 5 }}>時間</label>
              <input value={newTime} onChange={e => setNewTime(e.target.value)} placeholder="例如：18:00-21:00" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 5 }}>地點</label>
              <input value={newLocation} onChange={e => setNewLocation(e.target.value)} placeholder="例如：市中心餐廳" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <button onClick={editingEventId ? updateEvent : addEvent} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: '#111', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              {editingEventId ? '儲存修改' : '➕ 新增活動'}
            </button>
            {editingEventId && (
              <button onClick={cancelEditingEvent} style={{ width: '100%', marginTop: 8, padding: 12, borderRadius: 10, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                取消修改
              </button>
            )}

            <div style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '20px 0 10px', paddingBottom: 6, borderBottom: '1px solid #e5e7eb' }}>現有活動</div>
            {events.map(ev => (
              <div key={ev.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 6 }}>{ev.title}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>📅 {ev.event_date}</span>
                      <span>🕐 {ev.event_time}</span>
                      <span>📍 {ev.location}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => startEditingEvent(ev)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #2563eb', background: '#fff', color: '#2563eb', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      修改
                    </button>
                    <button onClick={() => deleteEvent(ev.id)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #dc2626', background: '#fff', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      刪除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

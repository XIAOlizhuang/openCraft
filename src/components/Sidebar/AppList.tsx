import { useEffect, useRef, useState, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '@/store/useStore'
import { microAppApi, dataApi, favoriteApi } from '@/services/api'
import type { MicroApp } from '@/types'

const typeMeta: Record<string, { bg: string; text: string; label: string }> = {
  scheduled: { bg: 'bg-orange-100', text: 'text-orange-600', label: '定时' },
  query: { bg: 'bg-blue-100', text: 'text-blue-600', label: '查询' },
  generation: { bg: 'bg-purple-100', text: 'text-purple-600', label: '生成' },
}

function getAppMeta(app: MicroApp) {
  return typeMeta[app.app_type] || typeMeta.query
}

function getInitials(name: string) {
  return name.slice(0, 1).toUpperCase()
}

export default function AppList() {
  const store = useStore()
  const {
    microApps,
    myMicroApps,
    selectedMicroApp,
    loadingMicroApps,
    loadingMyApps,
    editingAppId,
    editingAppName,
  } = store

  const renameInputRef = useRef<HTMLInputElement>(null)

  // ---------- Drag & Drop ----------
  const [draggingId, setDraggingId] = useState<string | null>(null)

  // ---------- More menu ----------
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpenId) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpenId])

  // ---------- Global hover tooltip (Portal + Fixed) ----------
  const [hoveredApp, setHoveredApp] = useState<MicroApp | null>(null)
  const hoveredElRef = useRef<HTMLElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useLayoutEffect(() => {
    if (!hoveredApp || !hoveredElRef.current) {
      setTooltipPos(null)
      return
    }

    const calculatePos = () => {
      const el = hoveredElRef.current
      const tooltipEl = tooltipRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const tooltipHeight = tooltipEl ? tooltipEl.offsetHeight : 120
      const tooltipWidth = 240
      const gap = 10

      const spaceAbove = rect.top
      const spaceBelow = window.innerHeight - rect.bottom

      let top: number
      if (spaceAbove >= tooltipHeight + gap || spaceAbove >= spaceBelow) {
        top = rect.top - tooltipHeight - gap
      } else {
        top = rect.bottom + gap
      }

      let left = rect.left
      if (left + tooltipWidth > window.innerWidth - 8) {
        left = window.innerWidth - tooltipWidth - 8
      }
      if (left < 8) left = 8

      setTooltipPos({ top, left })
    }

    calculatePos()

    let observer: ResizeObserver | null = null
    if (tooltipRef.current) {
      observer = new ResizeObserver(calculatePos)
      observer.observe(tooltipRef.current)
    }

    window.addEventListener('scroll', calculatePos, true)

    return () => {
      if (observer) observer.disconnect()
      window.removeEventListener('scroll', calculatePos, true)
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    }
  }, [hoveredApp])

  const handleMouseEnter = (app: MicroApp, e: React.MouseEvent<HTMLDivElement>) => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
    hoveredElRef.current = e.currentTarget
    hoverTimerRef.current = setTimeout(() => {
      setHoveredApp(app)
    }, 400)
  }

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    leaveTimerRef.current = setTimeout(() => {
      hoveredElRef.current = null
      setHoveredApp(null)
    }, 150)
  }

  const tooltipNode = hoveredApp && tooltipPos ? (
    <div
      ref={tooltipRef}
      className="fixed z-[9999] pointer-events-none"
      style={{
        top: tooltipPos.top,
        left: tooltipPos.left,
        width: 240,
        opacity: 1,
        transition: 'opacity 150ms ease',
      }}
    >
      <div className="bg-white rounded-lg shadow-xl border border-[#e5e6eb] p-3">
        <div className="text-sm font-semibold text-[#1a1a1a]">{hoveredApp.name}</div>
        <div className="text-xs text-[#4e5969] mt-1 leading-relaxed break-words">{hoveredApp.description}</div>
        {hoveredApp.trigger && (
          <div className="mt-2 text-[11px] text-[#86909c]">触发：{hoveredApp.trigger}</div>
        )}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] px-1.5 py-0.5 bg-[#f2f3f5] text-[#86909c] rounded">{hoveredApp.interfaces?.length || 0} 个接口</span>
          {hoveredApp.app_type === 'scheduled' && (
            <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-[#fff7e8] text-[#ff7d00] rounded flex-shrink-0">
              <svg className="flex-shrink-0" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              定时任务
            </span>
          )}
        </div>
      </div>
    </div>
  ) : null

  useEffect(() => {
    initAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (editingAppId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [editingAppId])

  const initAll = async () => {
    await fetchCurrentData()
    await fetchMicroApps()
    await fetchMyMicroApps()
  }

  const fetchCurrentData = async () => {
    try {
      const res = await dataApi.current()
      store.setCurrentDomain(res.data.domain || '')
    } catch {
      store.setCurrentDomain('')
    }
  }

  const fetchMicroApps = async () => {
    store.setLoadingMicroApps(true)
    try {
      const res = await microAppApi.list('system')
      store.setMicroApps(res.data.items || [])
    } catch (e: any) {
      store.showToast('微应用加载失败：' + e.message, 'error')
    } finally {
      store.setLoadingMicroApps(false)
    }
  }

  const fetchMyMicroApps = async () => {
    store.setLoadingMyApps(true)
    try {
      const res = await microAppApi.list('user')
      store.setMyMicroApps(res.data.items || [])
    } catch (e: any) {
      store.showToast('我的微应用加载失败：' + e.message, 'error')
    } finally {
      store.setLoadingMyApps(false)
    }
  }

  const deleteMyApp = async (app: MicroApp) => {
    if (!confirm('确定要删除这个微应用吗？')) return
    try {
      if (app.favorite_id) {
        await favoriteApi.delete(app.favorite_id)
      } else {
        await microAppApi.delete(app.id)
      }
      await fetchMyMicroApps()
      if (selectedMicroApp?.id === app.id) {
        store.setSelectedMicroApp(null)
        store.setDedicatedMessages([])
      }
      store.showToast('删除成功', 'success')
    } catch (e: any) {
      store.showToast('删除失败：' + e.message, 'error')
    }
  }

  const handleDragStart = (app: MicroApp) => {
    setDraggingId(app.id)
  }

  const handleDragOver = (e: React.DragEvent, targetApp: MicroApp) => {
    e.preventDefault()
    if (!draggingId || draggingId === targetApp.id) return
    const fromIndex = myMicroApps.findIndex((a) => a.id === draggingId)
    const toIndex = myMicroApps.findIndex((a) => a.id === targetApp.id)
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return
    const newApps = [...myMicroApps]
    const [moved] = newApps.splice(fromIndex, 1)
    newApps.splice(toIndex, 0, moved)
    store.setMyMicroApps(newApps)
  }

  const handleDragEnd = async () => {
    if (!draggingId) return
    const favIds = myMicroApps.filter((a) => a.favorite_id).map((a) => a.favorite_id!)
    if (favIds.length > 1) {
      try {
        await favoriteApi.reorder(favIds)
      } catch (e: any) {
        store.showToast('排序保存失败：' + e.message, 'error')
      }
    }
    setDraggingId(null)
  }

  const startRename = (app: MicroApp) => {
    store.setEditingAppId(app.id)
    store.setEditingAppName(app.name)
    setMenuOpenId(null)
  }

  const saveRename = async () => {
    if (!editingAppId || !editingAppName.trim()) {
      cancelRename()
      return
    }
    try {
      await microAppApi.update(editingAppId, { name: editingAppName.trim() })
      await fetchMyMicroApps()
      if (selectedMicroApp?.id === editingAppId) {
        store.setSelectedMicroApp({ ...selectedMicroApp, name: editingAppName.trim() })
      }
      store.showToast('重命名成功', 'success')
    } catch (e: any) {
      store.showToast('重命名失败：' + e.message, 'error')
    } finally {
      store.setEditingAppId(null)
      store.setEditingAppName('')
    }
  }

  const cancelRename = () => {
    store.setEditingAppId(null)
    store.setEditingAppName('')
  }

  const startCreateApp = () => {
    store.setShowAppCreator(true)
    store.setChatMode('build')
    store.setAppCreatorDraft({
      name: '',
      description: '',
      trigger: '',
      input: '',
      output: '',
      interfaces: [] as string[],
      flow: { type: 'sequence', steps: [] },
      app_type: 'query',
    })
  }

  const selectMicroApp = (app: MicroApp) => {
    store.setSelectedMicroApp(app)
    store.setDedicatedMessages([])
    store.setChatMode('in-app')
  }

  // ---------- Render item ----------
  const renderAppItem = (app: MicroApp, isMyApp: boolean) => {
    const meta = getAppMeta(app)
    const isSelected = selectedMicroApp?.id === app.id
    const isEditing = editingAppId === app.id && isMyApp

    return (
      <div
        key={app.id}
        draggable={isMyApp}
        onDragStart={() => handleDragStart(app)}
        onDragOver={(e) => handleDragOver(e, app)}
        onDragEnd={handleDragEnd}
        className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
          isSelected ? 'bg-[#e8f3ff]' : 'hover:bg-[#f2f3f5]'
        } ${draggingId === app.id ? 'opacity-50' : ''}`}
        onClick={() => selectMicroApp(app)}
        onMouseEnter={(e) => handleMouseEnter(app, e)}
        onMouseLeave={handleMouseLeave}
      >
        {/* Drag handle for my apps */}
        {isMyApp && (
          <div
            className="flex flex-col gap-[2px] opacity-0 group-hover:opacity-40 transition-opacity cursor-grab active:cursor-grabbing"
            title="拖拽排序"
            onMouseEnter={(e) => {
              e.stopPropagation()
              if (hoverTimerRef.current) {
                clearTimeout(hoverTimerRef.current)
                hoverTimerRef.current = null
              }
              if (leaveTimerRef.current) {
                clearTimeout(leaveTimerRef.current)
                leaveTimerRef.current = null
              }
              hoveredElRef.current = null
              setHoveredApp(null)
            }}
          >
            <span className="w-[3px] h-[3px] rounded-full bg-[#86909c]" />
            <span className="w-[3px] h-[3px] rounded-full bg-[#86909c]" />
            <span className="w-[3px] h-[3px] rounded-full bg-[#86909c]" />
          </div>
        )}

        {/* Avatar */}
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${meta.bg} ${meta.text}`}
        >
          {getInitials(app.name)}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <input
                ref={renameInputRef}
                className="flex-1 px-1.5 py-0.5 border border-[#165dff] rounded text-[13px] outline-none min-w-0"
                value={editingAppName}
                onChange={(e) => store.setEditingAppName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    saveRename()
                  } else if (e.key === 'Escape') {
                    cancelRename()
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <span
                className="text-xs text-[#00b42a] cursor-pointer px-1 py-0.5 rounded hover:bg-[#e8ffea]"
                onClick={(e) => {
                  e.stopPropagation()
                  saveRename()
                }}
                title="保存"
              >
                ✓
              </span>
              <span
                className="text-xs text-[#86909c] cursor-pointer px-1 py-0.5 rounded hover:bg-[#f2f3f5] hover:text-[#f53f3f]"
                onClick={(e) => {
                  e.stopPropagation()
                  cancelRename()
                }}
                title="取消"
              >
                ✕
              </span>
            </div>
          ) : (
            <>
              <div className={`text-sm font-medium truncate flex items-center gap-1 ${isSelected ? 'text-[#165dff]' : 'text-[#1a1a1a]'}`}>
                {app.app_type === 'scheduled' && (
                  <svg className="flex-shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff7d00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                )}
                {app.name}
              </div>
              <div className="text-xs text-[#86909c] truncate mt-0.5">{app.description}</div>
            </>
          )}
        </div>

        {/* Right actions */}
        <div
          className={`flex items-center gap-1 flex-shrink-0 transition-opacity ${isMyApp ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}
          onMouseEnter={(e) => {
            e.stopPropagation()
            if (hoverTimerRef.current) {
              clearTimeout(hoverTimerRef.current)
              hoverTimerRef.current = null
            }
            if (leaveTimerRef.current) {
              clearTimeout(leaveTimerRef.current)
              leaveTimerRef.current = null
            }
            hoveredElRef.current = null
            setHoveredApp(null)
          }}
        >
          {/* Interface count badge */}
          <span className="text-[10px] text-[#86909c] bg-[#f2f3f5] px-1.5 py-0.5 rounded">
            {app.interfaces?.length || 0}
          </span>

          {/* More menu for my apps */}
          {isMyApp && !isEditing && (
            <div className="relative" ref={menuOpenId === app.id ? menuRef : undefined}>
              <button
                className="p-1 rounded hover:bg-[#e5e6eb] text-[#86909c]"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpenId(menuOpenId === app.id ? null : app.id)
                }}
                title="更多"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
              </button>
              {menuOpenId === app.id && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-[#e5e6eb] py-1 z-50 w-24 text-[13px]">
                  <button
                    className="w-full text-left px-3 py-1.5 hover:bg-[#f2f3f5] text-[#1a1a1a]"
                    onClick={(e) => {
                      e.stopPropagation()
                      startRename(app)
                    }}
                  >
                    重命名
                  </button>
                  <button
                    className="w-full text-left px-3 py-1.5 hover:bg-[#ffe8e8] text-[#f53f3f]"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpenId(null)
                      deleteMyApp(app)
                    }}
                  >
                    删除
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="px-4 py-4 border-b border-[#e5e6eb]">
        <div className="flex items-center gap-2 text-base font-semibold">
          <span>📁</span>
          <span>我的MicroApps</span>
        </div>
      </div>

      {/* My Apps */}
      <div className="flex items-center justify-between px-4 py-3 text-xs font-semibold text-[#86909c] uppercase tracking-wide">
        <span>
          收藏夹 {myMicroApps.length > 0 ? '(' + myMicroApps.length + ')' : ''}
        </span>
        {/* <button
          className="px-3 py-1.5 rounded-md text-[13px] bg-[#165dff] text-white hover:bg-[#114ec2] transition-colors"
          onClick={startCreateApp}
        >
          + 新建
        </button> */}
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loadingMyApps ? (
          <div className="flex flex-col items-center justify-center py-5 text-[#86909c]">
            <div className="flex gap-1 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#86909c] animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#86909c] animate-bounce [animation-delay:0.1s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#86909c] animate-bounce [animation-delay:0.2s]" />
            </div>
            <span className="text-sm">加载中...</span>
          </div>
        ) : myMicroApps.length === 0 ? (
          <div className="text-center py-5 text-[#86909c] text-sm">
            暂无微应用
            <br />
            在对话中输入"帮我建一个..."来创建
          </div>
        ) : (
          myMicroApps.map((app) => renderAppItem(app, true))
        )}
      </div>

      {/* System Presets */}
      <div className="flex items-center px-4 py-3 text-xs font-semibold text-[#86909c] uppercase tracking-wide mt-2">
        系统预置 {microApps.length > 0 ? '(' + microApps.length + ')' : ''}
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loadingMicroApps ? (
          <div className="flex flex-col items-center justify-center py-5 text-[#86909c]">
            <div className="flex gap-1 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#86909c] animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#86909c] animate-bounce [animation-delay:0.1s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#86909c] animate-bounce [animation-delay:0.2s]" />
            </div>
            <span className="text-sm">加载中...</span>
          </div>
        ) : microApps.length === 0 ? (
          <div className="text-center py-5 text-[#86909c] text-sm">暂无系统预置微应用</div>
        ) : (
          microApps.map((app) => renderAppItem(app, false))
        )}
      </div>
      {createPortal(tooltipNode, document.body)}
    </>
  )
}

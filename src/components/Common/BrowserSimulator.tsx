import { useState, useRef, useCallback, useEffect } from 'react'

/** 智能补全协议：
 * - 已有协议前缀（http/https/file/ftp）→ 原样返回
 * - localhost / 127.0.0.1 / 内网 IP → 补 http://
 * - 普通域名 → 补 https://
 */
function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''

  // 已有协议前缀
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return trimmed
  }

  // 本地 / 内网 IP → 默认 http（内网通常没有 https 证书）
  const isLocalOrPrivate =
    trimmed.startsWith('localhost') ||
    trimmed.startsWith('127.') ||
    /^192\.168\.\d+\.\d+/i.test(trimmed) ||
    /^10\.\d+\.\d+\.\d+/i.test(trimmed) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/i.test(trimmed)

  if (isLocalOrPrivate) {
    return 'http://' + trimmed
  }

  // 默认 https
  return 'https://' + trimmed
}

interface BrowserSimulatorProps {
  initialUrl?: string
  height?: number
}

export default function BrowserSimulator({
  initialUrl = 'about:blank',
  height = 480,
}: BrowserSimulatorProps) {
  const [url, setUrl] = useState(initialUrl)
  const [inputUrl, setInputUrl] = useState(initialUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [srcDoc, setSrcDoc] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [historyStack, setHistoryStack] = useState<string[]>([initialUrl])
  const [historyIdx, setHistoryIdx] = useState(0)

  // Respond to initialUrl prop changes from parent (e.g. quick tags)
  const prevInitialUrlRef = useRef(initialUrl)
  useEffect(() => {
    if (initialUrl !== prevInitialUrlRef.current) {
      prevInitialUrlRef.current = initialUrl
      setError('')
      setLoading(initialUrl !== 'about:blank')
      setUrl(initialUrl)
      setInputUrl(initialUrl)
      setHistoryStack([initialUrl])
      setHistoryIdx(0)
    }
  }, [initialUrl])

  const navigate = useCallback(
    (targetUrl: string) => {
      setError('')
      setLoading(true)
      setUrl(targetUrl)
      setInputUrl(targetUrl)
      setSrcDoc(null)

      const newStack = historyStack.slice(0, historyIdx + 1)
      newStack.push(targetUrl)
      setHistoryStack(newStack)
      setHistoryIdx(newStack.length - 1)
    },
    [historyIdx, historyStack]
  )

  const handleNavigate = useCallback(() => {
    const target = normalizeUrl(inputUrl)
    if (!target) return
    setInputUrl(target)
    // 输入 file:// 时给出提示
    if (target.startsWith('file://')) {
      setLoading(false)
      setError('浏览器安全限制：无法直接加载 file:// 本地文件。请使用下方"📂"按钮选择 HTML 文件，或启动本地 HTTP 服务器后访问 http://localhost:port')
      return
    }
    navigate(target)
  }, [inputUrl, navigate])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleNavigate()
  }

  const goBack = useCallback(() => {
    if (historyIdx > 0) {
      const newIdx = historyIdx - 1
      const prev = historyStack[newIdx]
      setHistoryIdx(newIdx)
      setUrl(prev)
      setInputUrl(prev)
      setError('')
    }
  }, [historyIdx, historyStack])

  const goForward = useCallback(() => {
    if (historyIdx < historyStack.length - 1) {
      const newIdx = historyIdx + 1
      const next = historyStack[newIdx]
      setHistoryIdx(newIdx)
      setUrl(next)
      setInputUrl(next)
      setError('')
    }
  }, [historyIdx, historyStack])

  const refresh = useCallback(() => {
    if (iframeRef.current) {
      setLoading(true)
      iframeRef.current.src = url
    }
  }, [url])

  const goHome = useCallback(() => {
    navigate('about:blank')
  }, [navigate])

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev)
  }, [])

  const openExternal = useCallback(() => {
    if (url && url !== 'about:blank') {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }, [url])

  const handleFileOpen = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const onFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 只接受 HTML 文件
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      setError('请选择 .html 或 .htm 文件')
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      if (content) {
        const displayName = `file://${file.name}`
        setSrcDoc(content)
        setUrl(displayName)
        setInputUrl(displayName)
        setError('')
        setLoading(false)

        const newStack = historyStack.slice(0, historyIdx + 1)
        newStack.push(displayName)
        setHistoryStack(newStack)
        setHistoryIdx(newStack.length - 1)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [historyIdx, historyStack])

  // Close fullscreen on Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isFullscreen])

  const onIframeLoad = useCallback(() => {
    setLoading(false)
  }, [])

  const onIframeError = useCallback(() => {
    setLoading(false)
    setError('页面加载失败，可能被拒绝嵌入（X-Frame-Options）')
  }, [])

  // Auto-detect embed-blocking after a timeout and show a fallback UI
  const [blocked, setBlocked] = useState(false)
  useEffect(() => {
    if (url === 'about:blank' || srcDoc) {
      setBlocked(false)
      return
    }
    setBlocked(false)
    const timer = setTimeout(() => {
      // If still loading after 6s, assume the page blocks embedding
      // or frame-busting prevented load completion.
      setLoading((prev) => {
        if (prev) {
          setBlocked(true)
          return false
        }
        return prev
      })
    }, 6000)
    return () => clearTimeout(timer)
  }, [url, srcDoc])

  // Keyboard shortcuts: Alt+Left/Right for back/forward
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault()
        goBack()
      }
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault()
        goForward()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goBack, goForward])

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-[9999] bg-white flex flex-col'
          : 'rounded-lg border border-[#e5e6eb] bg-white flex flex-col overflow-hidden'
      }
      style={isFullscreen ? undefined : { height }}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#e5e6eb] bg-[#f7f8fa]">
        {/* Traffic lights */}
        <div className="flex gap-1.5 mr-1">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </div>

        {/* Navigation buttons */}
        <button
          onClick={goBack}
          disabled={historyIdx <= 0}
          title="后退 (Alt+←)"
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#e5e6eb] disabled:opacity-30 disabled:cursor-not-allowed text-[#4e5969]"
        >
          ←
        </button>
        <button
          onClick={goForward}
          disabled={historyIdx >= historyStack.length - 1}
          title="前进 (Alt+→)"
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#e5e6eb] disabled:opacity-30 disabled:cursor-not-allowed text-[#4e5969]"
        >
          →
        </button>
        <button
          onClick={refresh}
          title="刷新"
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#e5e6eb] text-[#4e5969]"
        >
          ↻
        </button>
        <button
          onClick={goHome}
          title="主页"
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#e5e6eb] text-[#4e5969]"
        >
          ⌂
        </button>
        <button
          onClick={handleFileOpen}
          title="打开本地 HTML 文件"
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#e5e6eb] text-[#4e5969]"
        >
          📂
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".html,.htm"
          className="hidden"
          onChange={onFileSelected}
        />

        {/* Address bar */}
        <div className="flex-1 flex items-center bg-white rounded-md border border-[#d9d9d9] px-2.5 py-1 focus-within:border-[#165dff] transition-colors">
          {url.startsWith('https') ? (
            <span className="text-xs text-[#00b42a] mr-1.5">🔒</span>
          ) : (
            <span className="text-xs text-[#86909c] mr-1.5">⚠️</span>
          )}
          <input
            className="flex-1 text-xs bg-transparent outline-none text-[#1a1a1a]"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入网址 https://..."
          />
        </div>

        <button
          onClick={handleNavigate}
          disabled={loading}
          className="px-3 py-1 rounded-md text-xs bg-[#165dff] text-white hover:bg-[#114ec2] disabled:opacity-50 transition-colors"
        >
          {loading ? '加载中...' : '访问'}
        </button>

        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? '退出全屏 (Esc)' : '全屏'}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#e5e6eb] text-[#4e5969]"
        >
          {isFullscreen ? '▣' : '⛶'}
        </button>
        <button
          onClick={openExternal}
          disabled={url === 'about:blank'}
          title="在系统浏览器中打开"
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#e5e6eb] disabled:opacity-30 disabled:cursor-not-allowed text-[#4e5969]"
        >
          ↗
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 relative bg-white">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10">
            <div className="w-6 h-6 border-2 border-[#e5e6eb] border-t-[#165dff] rounded-full animate-spin mb-2" />
            <div className="text-xs text-[#86909c]">正在加载页面...</div>
          </div>
        )}

        {url === 'about:blank' ? (
          <div className="flex flex-col items-center justify-center h-full text-[#86909c]">
            <div className="text-4xl mb-3">🌐</div>
            <div className="text-sm font-medium mb-1">网页浏览模拟器</div>
            <div className="text-xs max-w-[320px] text-center leading-relaxed mb-3">
              在地址栏输入网址并点击访问，即可在下方窗口中真实浏览网页。
            </div>
            <div className="text-[11px] max-w-[320px] text-center leading-relaxed text-[#86909c] opacity-80">
              地址栏支持智能协议补全：内网 IP / localhost 自动使用 http://，公网域名自动使用 https://。
              <br />
              如需加载本地 HTML 文件，请点击工具栏 📂 按钮选择文件。
            </div>
          </div>
        ) : blocked ? (
          <div className="flex flex-col items-center justify-center h-full text-[#86909c] px-6">
            <div className="text-3xl mb-3">🚫</div>
            <div className="text-sm font-medium mb-2 text-[#1a1a1a]">该网站禁止嵌入浏览</div>
            <div className="text-xs max-w-[320px] text-center leading-relaxed mb-4">
              目标网页设置了安全策略，无法在当前窗口内预览。您可以选择在系统浏览器中打开。
            </div>
            <button
              onClick={openExternal}
              className="px-4 py-2 rounded-md text-xs bg-[#165dff] text-white hover:bg-[#114ec2] transition-colors"
            >
              ↗ 在新窗口打开
            </button>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            key={url + historyIdx}
            src={url}
            className="w-full h-full border-0"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
            referrerPolicy="no-referrer"
            onLoad={onIframeLoad}
            onError={onIframeError}
            title="Browser Simulator"
          />
        )}
      </div>

      {/* Error bar */}
      {error && (
        <div className="px-3 py-2 text-xs text-[#f53f3f] bg-[#fff2f0] border-t border-[#ffccc7]">
          {error}
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-[#e5e6eb] bg-[#f7f8fa] text-[11px] text-[#86909c]">
        <div className="truncate max-w-[70%]">{url !== 'about:blank' ? url : '就绪'}</div>
        <div>
          {loading ? '正在加载...' : url !== 'about:blank' ? '完成' : ''}
        </div>
      </div>
    </div>
  )
}

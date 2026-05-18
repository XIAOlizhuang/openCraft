import { useRef, useCallback, useEffect, useState } from 'react'
import { useStore } from '@/store/useStore'
import { microAppApi, dataApi } from '@/services/api'
import FlowChart from '@/components/Common/FlowChart'
import BrowserSimulator from '@/components/Common/BrowserSimulator'
import type { ChatMessage } from '@/types'
import { Select,Tooltip,Modal,message } from 'antd'
import {API_PREFIX} from '@/services/api'
const { Option } = Select;
const accountOptions = [
  { key: 'P00001100', label: 'P00001100' },
  { key: 'soaadmin', label: 'soaadmin' },
  { key: 'P00001108', label: 'P00001108' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function removeThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '')
}

function renderInline(html: string): string {
  // bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  // links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  return html
}

function renderMarkdownBlock(block: string): string {
  const trimmed = block.trim()
  if (!trimmed) return ''

  // Headers
  if (trimmed.startsWith('### ')) {
    return `<h3>${renderInline(escapeHtml(trimmed.slice(4)))}</h3>`
  }
  if (trimmed.startsWith('## ')) {
    return `<h2>${renderInline(escapeHtml(trimmed.slice(3)))}</h2>`
  }
  if (trimmed.startsWith('# ')) {
    return `<h1>${renderInline(escapeHtml(trimmed.slice(2)))}</h1>`
  }

  // Blockquote
  if (trimmed.startsWith('> ')) {
    const inner = trimmed
      .split('\n')
      .map((l) => l.replace(/^>\s?/, ''))
      .join('\n')
    return `<blockquote>${renderMarkdownLines(inner)}</blockquote>`
  }

  // Unordered list
  if (/^(\*|\-|\+)\s/.test(trimmed)) {
    const items = trimmed
      .split('\n')
      .filter((l) => l.trim().match(/^(\*|\-|\+)\s/))
      .map((l) => `<li>${renderInline(escapeHtml(l.trim().replace(/^(\*|\-|\+)\s+/, '')))}</li>`)
      .join('')
    return `<ul>${items}</ul>`
  }

  // Ordered list
  if (/^\d+\.\s/.test(trimmed)) {
    const items = trimmed
      .split('\n')
      .filter((l) => l.trim().match(/^\d+\.\s/))
      .map((l) => `<li>${renderInline(escapeHtml(l.trim().replace(/^\d+\.\s+/, '')))}</li>`)
      .join('')
    return `<ol>${items}</ol>`
  }

  // Table
  if (trimmed.includes('|') && trimmed.split('\n').length >= 2) {
    const lines = trimmed.split('\n').filter((l) => l.trim())
    if (lines.length >= 2 && lines[1].replace(/[\|\-\s]/g, '') === '') {
      const headers = lines[0]
        .split('|')
        .filter((c) => c.trim() !== '')
        .map((c) => `<th>${renderInline(escapeHtml(c.trim()))}</th>`)
        .join('')
      const rows = lines
        .slice(2)
        .map((row) => {
          const cells = row
            .split('|')
            .filter((c) => c.trim() !== '')
            .map((c) => `<td>${renderInline(escapeHtml(c.trim()))}</td>`)
            .join('')
          return `<tr>${cells}</tr>`
        })
        .join('')
      return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`
    }
  }

  // Horizontal rule
  if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
    return '<hr>'
  }

  // Check if paragraph contains embedded table
  const hasTableInParagraph = (text: string): boolean => {
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('|') && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim()
        if (/^[\|\-:-\s]+$/.test(nextLine)) {
          return true
        }
      }
    }
    return false
  }

  const renderTableFromLines = (lines: string[]): string => {
    if (lines.length < 2) return ''
    const headers = lines[0]
      .split('|')
      .filter((c) => c.trim() !== '')
      .map((c) => `<th>${renderInline(escapeHtml(c.trim()))}</th>`)
      .join('')
    const rows = lines
      .slice(2)
      .map((row) => {
        const cells = row
          .split('|')
          .filter((c) => c.trim() !== '')
          .map((c) => `<td>${renderInline(escapeHtml(c.trim()))}</td>`)
          .join('')
        return `<tr>${cells}</tr>`
      })
      .join('')
    return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`
  }

  if (hasTableInParagraph(trimmed)) {
    const lines = trimmed.split('\n')
    const parts: string[] = []
    let currentPart: string[] = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.includes('|') && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim()
        if (/^[\|\-:-\s]+$/.test(nextLine)) {
          if (currentPart.length > 0) {
            parts.push(`<p>${renderInline(escapeHtml(currentPart.join('\n').trim()).replace(/\n/g, '<br>'))}</p>`)
            currentPart = []
          }
          const tableLines = [line, lines[i + 1]]
          i += 2
          while (i < lines.length && lines[i].trim().startsWith('|')) {
            tableLines.push(lines[i])
            i++
          }
          i--
          parts.push(renderTableFromLines(tableLines))
          continue
        }
      }
      currentPart.push(line)
    }
    if (currentPart.length > 0) {
      parts.push(`<p>${renderInline(escapeHtml(currentPart.join('\n').trim()).replace(/\n/g, '<br>'))}</p>`)
    }
    return parts.join('')
  }

  // Normal paragraph
  return `<p>${renderInline(escapeHtml(trimmed).replace(/\n/g, '<br>'))}</p>`
}

function isTableBlock(lines: string[], startIdx: number): boolean {
  if (startIdx >= lines.length) return false
  const line = lines[startIdx].trim()
  if (!line.includes('|')) return false
  if (startIdx + 1 >= lines.length) return false
  const nextLine = lines[startIdx + 1].trim()
  const separatorPattern = /^[\|\-:-\s]+$/
  if (!separatorPattern.test(nextLine)) return false
  return true
}

function extractTablesFromText(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (line.includes('|') && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim()
      const separatorPattern = /^[\|\-:-\s]+$/
      if (separatorPattern.test(nextLine)) {
        let tableText = lines[i] + '\n' + lines[i + 1] + '\n'
        i += 2
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableText += lines[i] + '\n'
          i++
        }
        result.push(tableText)
        continue
      }
    }
    result.push(lines[i])
    i++
  }
  return result.join('\n')
}

function renderMarkdownLines(text: string): string {
  const blocks: string[] = []
  let currentBlock = ''
  const lines = text.split('\n')

  const isBlockStart = (line: string) =>
    line.match(/^(#{1,4}\s|>\s|\*|\-|\+|\d+\.\s|```)/)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim().startsWith('```')) {
      if (currentBlock.trim()) {
        blocks.push(renderMarkdownBlock(currentBlock))
        currentBlock = ''
      }
      const lang = line.trim().slice(3).trim()
      let code = ''
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code += lines[i] + '\n'
        i++
      }
      let formatted = code.trimEnd()
      if (lang === 'json') {
        try {
          formatted = JSON.stringify(JSON.parse(formatted), null, 2)
        } catch {
          // keep original
        }
      }
      const headerHtml = lang
        ? `<div class="code-header"><span>${escapeHtml(lang)}</span></div>`
        : `<div class="code-header"></div>`
      blocks.push(
        `<div class="code-wrapper">${headerHtml}<div class="code-block relative"><pre>${escapeHtml(formatted)}</pre></div></div>`
      )
      continue
    }

    if (isTableBlock(lines, i) && currentBlock.trim()) {
      blocks.push(renderMarkdownBlock(currentBlock))
      currentBlock = line + '\n'
      continue
    }

    if (isBlockStart(line) && currentBlock.trim()) {
      blocks.push(renderMarkdownBlock(currentBlock))
      currentBlock = line + '\n'
    } else {
      currentBlock += line + '\n'
    }
  }

  if (currentBlock.trim()) {
    blocks.push(renderMarkdownBlock(currentBlock))
  }

  return blocks.join('')
}

function renderContent(content: string): string {
  if (!content) return ''
  return `<div class="msg-content">${renderMarkdownLines(content)}</div>`
}

function parseAskConfirmMarker(content: string): Record<string, unknown> | null {
  if (!content) return null
  const regex = /\[ASK_CONFIRM_CREATE\]\n?([\s\S]*?)\n?\[\/ASK_CONFIRM_CREATE\]/
  const m = content.match(regex)
  if (!m) return null
  try {
    return JSON.parse(m[1].trim())
  } catch {
    return null
  }
}

function stripAskConfirmMarker(content: string): string {
  if (!content) return ''
  return content.replace(/\[ASK_CONFIRM_CREATE\]\n?[\s\S]*?\n?\[\/ASK_CONFIRM_CREATE\]/, '').trim()
}

function parseConfirmMarker(content: string): Record<string, unknown> | null {
  if (!content) return null
  const confirmRegex = /\[CONFIRM_CREATE_APP\]\n?([\s\S]*?)\n?\[\/CONFIRM_CREATE_APP\]/
  const m = content.match(confirmRegex)
  if (!m) return null
  try {
    return JSON.parse(m[1].trim())
  } catch {
    return null
  }
}

function stripConfirmMarker(content: string): string {
  if (!content) return ''
  return content.replace(/\[CONFIRM_CREATE_APP\]\n?[\s\S]*?\n?\[\/CONFIRM_CREATE_APP\]/, '').trim()
}

function parseDraftUpdateMarker(content: string): Record<string, unknown> | null {
  if (!content) return null
  const regex = /<!--DRAFT_UPDATE:([\s\S]*?)-->/
  const m = content.match(regex)
  if (!m) return null
  try {
    return JSON.parse(m[1].trim())
  } catch {
    return null
  }
}

function stripDraftUpdateMarker(content: string): string {
  if (!content) return ''
  return content.replace(/<!--DRAFT_UPDATE:[\s\S]*?-->/, '').trim()
}

function stripHtmlComments(content: string): string {
  if (!content) return ''
  return content.replace(/<!--[\s\S]*?-->/g, '').trim()
}

function formatTime(ts: string): string {
  const d = new Date(ts)
  const now = new Date()
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  if (d.toDateString() !== now.toDateString()) {
    return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`
  }
  return `${hh}:${mm}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChatWindow() {
  const store = useStore()
  const {
    selectedMicroApp,
    messages,
    dedicatedMessages,
    inputText,
    isThinking,
    showJsonEditor,
    jsonInput,
    pendingCreation,
    currentDomain,
    isOnline,
    microApps,
    apis,
    showAppCreator,
    appCreatorDraft,
    askedCreation,
    showBrowserSimulator,
    browserUrl,
    showBrowserModal,
  } = store

  const currentAccount = useStore((state) => state.currentAccount)
  const setCurrentAccount = useStore((state) => state.setCurrentAccount)

  const messageScrollRef = useRef<HTMLDivElement>(null)
  const outerScrollRef = useRef<HTMLDivElement>(null)
  const userScrolledUp = useRef(false)

  // Creation card preview tab state
  const [previewTab, setPreviewTab] = useState<'basic' | 'code' | 'render'>('basic')

  // Execution history for scheduled micro-apps
  const [executionHistory, setExecutionHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)

  // User input values for micro-app execution
  const [userInputValues, setUserInputValues] = useState<Record<string, unknown>>({})

  // Check if the inner message list is already near bottom.
  const isNearBottom = useCallback(() => {
    const el = messageScrollRef.current
    if (!el) return true
    const threshold = 80
    return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold
  }, [])

  // Scroll a single element to its bottom.
  const scrollElToBottom = (el: HTMLDivElement | null, behavior: 'auto' | 'smooth' = 'smooth') => {
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
  }

  // Scroll the inner message list (daily chat auto-follow).
  const scrollToBottom = useCallback((behavior: 'auto' | 'smooth' = 'smooth', delayMs = 0) => {
    const doScroll = () => scrollElToBottom(messageScrollRef.current, behavior)
    if (delayMs > 0) {
      setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(doScroll)), delayMs)
    } else {
      requestAnimationFrame(() => requestAnimationFrame(doScroll))
    }
  }, [])

  // Scroll both outer and inner containers to bottom (used on page-restore / mode-switch).
  const scrollAllToBottom = useCallback((behavior: 'auto' | 'smooth' = 'auto', delayMs = 0) => {
    const doScroll = () => {
      scrollElToBottom(outerScrollRef.current, behavior)
      scrollElToBottom(messageScrollRef.current, behavior)
    }
    if (delayMs > 0) {
      setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(doScroll)), delayMs)
    } else {
      requestAnimationFrame(() => requestAnimationFrame(doScroll))
    }
  }, [])

  // Smart auto-scroll: only follow when user hasn't manually scrolled up inside the message list.
  useEffect(() => {
    if (!userScrolledUp.current) {
      scrollToBottom('smooth')
    }
  }, [messages, dedicatedMessages, isThinking, scrollToBottom])

  // When switching micro-apps, scroll both outer and inner to bottom immediately.
  useEffect(() => {
    userScrolledUp.current = false
    scrollAllToBottom('auto', 50)
    // Reset browser simulator when switching between global / in-app modes
    store.setShowBrowserSimulator(false)
    // Load execution history for scheduled apps
    if (selectedMicroApp?.app_type === 'scheduled') {
      loadExecutionHistory(selectedMicroApp.id)
      setShowHistory(true)
    } else {
      setExecutionHistory([])
      setShowHistory(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMicroApp, scrollAllToBottom])

  // When the creation confirmation card appears, scroll so the card is fully visible.
  useEffect(() => {
    if (pendingCreation) {
      userScrolledUp.current = false
      scrollToBottom('smooth', 100)
    }
  }, [pendingCreation, scrollToBottom])

  // localStorage message persistence + scroll on restore
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dtv_messages')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) store.setMessages(parsed)
      }
    } catch {
      // ignore
    }
    // After React paints the restored messages, force-scroll BOTH containers to bottom.
    // We retry multiple times because dangerouslySetInnerHTML + images may shift layout.
    userScrolledUp.current = false
    const scrollNow = () => {
      scrollElToBottom(outerScrollRef.current, 'auto')
      scrollElToBottom(messageScrollRef.current, 'auto')
    }
    const timers = [
      setTimeout(() => { userScrolledUp.current = false; scrollNow() }, 100),
      setTimeout(() => { userScrolledUp.current = false; scrollNow() }, 300),
      setTimeout(() => { userScrolledUp.current = false; scrollNow() }, 600),
    ]
    return () => timers.forEach(clearTimeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('dtv_messages', JSON.stringify(messages))
      } catch {
        // ignore
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [messages])

  const apiMap = () => {
    const map: Record<string, { name: string; method: string }> = {}
    apis.forEach((a) => (map[a.id] = a))
    return map
  }

  const globalQuickTags = (): string[] => {
    const domain = currentDomain
    if (domain && domain.includes('电力')) {
      return ['避雷器动作', '未处理缺陷', '油色谱预警', '开关柜局放', '电缆头测温', '主变状态', '故障诊断', '负荷预测']
    }
    if (domain && domain.includes('园区')) {
      return ['安防态势', '今日能耗', '电梯状态', '停车空位', '环境参数']
    }
    return ['避雷器动作', '未处理缺陷', '油色谱预警', '开关柜局放', '电缆头测温', '打开网页', '国家电网官网']
  }

  const dedicatedQuickTags = (): string[] => {
    if (!selectedMicroApp) return []
    const quickTagMap: Record<string, string[]> = {
      'line-monitor': ['线路温度', '覆冰情况', '健康评分', '沿线天气', '执行检查'],
      'substation-inspection': ['巡检结果', '设备缺陷', '红外热像', '机器人巡检', '执行检查'],
      'load-forecast': ['明日负荷', '预测精度', '峰谷分析', '高温天气', '执行预测'],
      'fault-diagnosis': ['故障定位', '保护动作', '录波分析', '处置建议', '执行诊断'],
      'transformer-monitor': ['油色谱分析', '局部放电', '健康评分', '剩余寿命', '执行检查'],
      'energy-optimization': ['网损分析', '无功优化', '电压质量', '电容器投切', '执行优化'],
      'arrester-monitor': ['避雷器动作', '泄漏电流', '动作次数', '未处理清单', '执行监视'],
      'unhandled-defects': ['严重缺陷', '危急缺陷', '缺陷清单', '处理期限', '执行查询'],
      'dga-early-warning': ['油色谱分析', '三比值法', '大卫三角形', '故障预警', '执行分析'],
      'switchgear-pd-monitor': ['局放监测', 'UHF检测', 'PRPD谱图', '绝缘状态', '执行监测'],
      'cable-infrared-monitor': ['红外测温', '电缆头温度', '温升分析', '缺陷判定', '执行测温'],
      'security-monitor': ['安防评分', '摄像头状态', '通行记录', '消防状态', '执行检查'],
      'energy-management': ['今日能耗', '碳排放', '用电排名', '节能建议', '执行统计'],
      'elevator-monitor': ['运行状态', '轿厢人数', '健康评分', '维保日期', '执行检查'],
      'parking-management': ['车位空位', '今日流量', '引导路线', '停车费用', '执行查询'],
      'enviroment-control': ['室内温度', '空气质量', 'HVAC状态', '舒适度评分', '执行检查'],
    }
    return quickTagMap[selectedMicroApp.id] || ['查看状态', '执行检查', '数据分析']
  }

  const startCreateApp = () => {
    store.setInputText('帮我建一个')
    setTimeout(() => {
      const input = document.querySelector('.chat-input') as HTMLTextAreaElement
      if (input) input.focus()
    }, 100)
  }

  const backToGlobal = () => {
    store.setSelectedMicroApp(null)
    store.setDedicatedMessages([])
    store.setChatMode('global')
    store.setShowBrowserSimulator(false)
  }

  const clearMessages = async () => {
  Modal.confirm({
    title: '清空对话记录',
    content: '确定要清空当前对话记录吗？',
    okText: '确定',
    cancelText: '取消',
    onOk: async () => {
      store.setMessages([]);
      store.setDedicatedMessages([]);
      try {
        localStorage.removeItem('dtv_messages');
      } catch {
        // ignore
      }
      try {
        await fetch(`${API_PREFIX}/api/chat/history`, { method: 'DELETE' });
      } catch {
        // ignore
      }
    },
    onCancel: () => {
      // 取消，不做任何操作
    },
  });
};

  const loadExecutionHistory = async (appId: string) => {
    try {
      const res = await microAppApi.history(appId)
      setExecutionHistory(res.data.data || [])
    } catch {
      setExecutionHistory([])
    }
  }

  function tableCell(value: any): string {
    if (value === null || value === undefined || value === '') return '-'
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
    return text.replace(/\n/g, ' ').replace(/\|/g, '\\|')
  }

  function extractRecords(data: any): any[] {
    if (Array.isArray(data)) {
      const nested = data.flatMap((item) => Array.isArray(item?.psrList) ? item.psrList : [])
      return nested.length > 0 ? nested : data
    }
    if (!data || typeof data !== 'object') return []
    // Grid PSRCenter: result.{psrType}.records[].resource holds the flat fields
    const result = data.result
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      for (const key of Object.keys(result)) {
        const val = result[key]
        if (val && typeof val === 'object' && !Array.isArray(val) && Array.isArray(val.records)) {
          const resources = val.records
            .map((rec: any) => rec?.resource || rec)
            .filter((r: any) => r && typeof r === 'object')
          if (resources.length > 0) return resources
        }
      }
    }
    const resultList = Array.isArray(data.result) ? data.result : []
    const nestedPsrList = resultList.flatMap((item: any) => Array.isArray(item?.psrList) ? item.psrList : [])
    const candidates = [
      data.records,
      data.items,
      data.data,
      nestedPsrList.length > 0 ? nestedPsrList : undefined,
      resultList.length > 0 ? resultList : undefined,
      data.result?.records,
      data.result?.data,
      data.result?.data?.records,
      data.stations,
      data.defects,
      data.devices,
      data.lines,
      data.transformers,
    ]
    for (const value of candidates) {
      if (Array.isArray(value)) return value
    }
    return []
  }

  function recordCount(data: any): number | undefined {
    if (Array.isArray(data)) return extractRecords(data).length
    if (!data || typeof data !== 'object') return undefined
    const records = extractRecords(data)
    if (records.length > 0) return records.length
    // Grid PSRCenter: result.{psrType}.total
    if (data.result && typeof data.result === 'object' && !Array.isArray(data.result)) {
      for (const key of Object.keys(data.result)) {
        const val = data.result[key]
        if (val && typeof val === 'object' && !Array.isArray(val) && val.total !== undefined) {
          return val.total
        }
      }
    }
    if (Array.isArray(data.result?.records)) return data.result.records.length
    if (Array.isArray(data.result?.data?.records)) return data.result.data.records.length
    if (Array.isArray(data.result)) return 0
    const explicit = data.total ?? data.count ?? data.totalCount ?? data.result?.total ?? data.result?.count ?? data.result?.totalCount
    if (explicit !== undefined) return explicit
    if (data.status !== undefined || data.reply?.code !== undefined) return 0
    return undefined
  }

  function recordValue(item: any, key: string): any {
    if (!item || typeof item !== 'object') return undefined
    if (key === 'psrId') return item.psrId || item.psrID || item.resource?.psrId || item.resource?.psrID || item.id || item.astId
    if (item[key] !== undefined) return item[key]
    if (item.resource && typeof item.resource === 'object') return item.resource[key]
    return undefined
  }

  function appendRecordsTable(records: any[], maxRows = 8): string {
    if (!Array.isArray(records) || records.length === 0) return ''
    const preferred = ['name', 'psrId', 'dispatchName', 'voltageLevel#Name', 'psrState#Name', 'transformerQuantity', 'stationCapacity', 'address',
      'psrName', 'containerName', 'voltageLevel', 'maintOrg', 'maintGroup', 'equipMaintainerName', 'equipMaintcrewName', 'defectNatureCode', 'defectStatus', 'defectContent']
    const keys: string[] = []
    const pushKey = (key: string) => {
      if (!keys.includes(key)) keys.push(key)
    }
    preferred.forEach((key) => {
      if (records.some((item) => recordValue(item, key) !== undefined && recordValue(item, key) !== null && recordValue(item, key) !== '')) {
        pushKey(key)
      }
    })
    records.forEach((item) => {
      if (item && typeof item === 'object') {
        Object.keys(item).forEach((key) => {
          if (!keys.includes(key) && keys.length < 9) pushKey(key)
        })
      }
    })
    if (keys.length === 0) return ''
    let table = '| ' + keys.join(' | ') + ' |\n'
    table += '| ' + keys.map(() => '---').join(' | ') + ' |\n'
    records.slice(0, maxRows).forEach((item: any) => {
      table += '| ' + keys.map((key) => {
        if (key === 'psrId') {
          const psrId = recordValue(item, key)
          if (psrId) {
            return `[${psrId}](http://172.29.141.225:3000/?psrld=${psrId}&psrType=zf01)`
          }
        }
        return tableCell(recordValue(item, key))
      }).join(' | ') + ' |\n'
    })
    if (records.length > maxRows) {
      table += `| *…还有 ${records.length - maxRows} 条记录* |${' |'.repeat(keys.length - 1)}\n`
    }
    return table + '\n'
  }

  function buildExecutionReport(app: any, execution: any, apiMap: Record<string, { name: string; method: string }>): string {
    const results = execution?.results ?? execution
    const apiTrace = Array.isArray(execution?.api_trace) ? execution.api_trace : []
    const hasFailure = apiTrace.some((item: any) => item.status === 'failed' || item.error)
    const mockUsed = execution?.mock_execution || apiTrace.some((item: any) => item.mock)
    let report = `微应用 **${app?.name || ''}** ${hasFailure ? '执行存在异常' : '执行完成'}。\n\n`
    if (mockUsed) {
      report += '> 本次存在模拟数据回退，部分接口未能真实访问。\n\n'
    }

    // Only show real data records, not internal orchestration details
    if (app?.code && results && typeof results === 'object' && !Array.isArray(results)) {
      const objectRecords = extractRecords(results)
      const count = recordCount(results)
      if (results.stationName !== undefined) report += `**查询站点**：${results.stationName}\n\n`
      if (results.totalDevices !== undefined) report += `**设备数量**：${results.totalDevices}\n\n`
      if (count !== undefined && count > 0) {
        report += `共查询到 ${count} 条记录。\n\n`
        report += appendRecordsTable(objectRecords)
      } else if (objectRecords.length > 0) {
        report += `共查询到 ${objectRecords.length} 条记录。\n\n`
        report += appendRecordsTable(objectRecords)
      } else if (count === 0) {
        report += '未查询到数据。\n\n'
      }
      if (Array.isArray(results.links) && results.links.length > 0) {
        report += '**详情链接**：\n\n'
        results.links.forEach((link: any) => {
          report += `- [${link.name || '查看详情'}](${link.url})\n`
        })
      }
      if (count === undefined && objectRecords.length === 0) {
        try {
          report += '```json\n' + JSON.stringify(results, null, 2).slice(0, 4000) + '\n```\n\n'
        } catch { /* skip */ }
      }
      return report
    }

    if (Array.isArray(results)) {
      const flowSteps = (app?.flow as any)?.steps || []
      results.forEach((result: any, idx: number) => {
        const step = flowSteps[idx] || {}
        const trace = apiTrace[idx] || {}
        const apiId = step.apiId || trace.api_id
        const api = apiMap[apiId]
        const stepName = step.label || trace.name || api?.name || apiId || `步骤 ${idx + 1}`
        const records = extractRecords(result)
        const count = recordCount(result)
        report += `### ${stepName}\n\n`
        if (hasFailure && trace.status === 'failed') {
          report += `> 接口调用失败${trace.error ? '：' + trace.error : ''}\n\n`
        }
        if (count !== undefined && count > 0) {
          report += `共查询到 ${count} 条记录。\n\n`
          report += appendRecordsTable(records)
        } else if (count === 0) {
          report += '未查询到数据。\n\n'
        } else {
          // No recognizable record structure — show raw JSON
          if (result && typeof result === 'object' && !Array.isArray(result)) {
            const status = result.status ?? result.reply?.code
            const msg = result.message ?? result.reply?.msg ?? result.errors
            if (status !== undefined) report += `状态：${status}\n\n`
            if (msg) report += `消息：${msg}\n\n`
            // Try to show any meaningful data fields
            const dataFields = Object.entries(result).filter(([k]) => !['status', 'message', 'errors', 'reply'].includes(k))
            if (dataFields.length > 0) {
              try {
                report += '```json\n' + JSON.stringify(result, null, 2).slice(0, 4000) + '\n```\n\n'
              } catch { /* skip */ }
            }
          }
        }
        report += '---\n\n'
      })
      return report
    }

    const count = recordCount(results)
    if (count !== undefined && count > 0) {
      report += `共查询到 ${count} 条记录。\n\n`
      report += appendRecordsTable(extractRecords(results))
    } else if (count === 0) {
      report += '未查询到数据。\n\n'
    } else {
      // Fallback: show raw JSON for unrecognizable structures
      if (results && typeof results === 'object') {
        try {
          report += '```json\n' + JSON.stringify(results, null, 2).slice(0, 4000) + '\n```\n\n'
        } catch { /* skip */ }
      }
    }
    return report
  }

  const executeMicroApp = async (appId: string, userInput?: Record<string, unknown>) => {
    store.setExecutingApp(appId)
    try {
      const res = await microAppApi.execute(appId, userInput)
      const data = res.data
      const allApps = [...microApps, ...useStore.getState().myMicroApps]
      const app = allApps.find((a) => a.id === appId)
      const msg = buildExecutionReport(app, data, apiMap())

      const target = selectedMicroApp ? store.dedicatedMessages : store.messages
      const setTarget = selectedMicroApp ? store.setDedicatedMessages : store.setMessages
      const newMsg: ChatMessage = {
        id: 'msg-' + Date.now(),
        role: 'assistant',
        content: msg,
        timestamp: new Date().toISOString(),
      }
      setTarget([...target, newMsg])
      scrollToBottom('smooth', 100)
      // 刷新执行历史
      if (selectedMicroApp?.app_type === 'scheduled') {
        await loadExecutionHistory(appId)
      }
    } catch (e: any) {
      message.error('执行失败：' + e.message)
    } finally {
      store.setExecutingApp('')
    }
  }

  const handleLinkClick = useCallback((e: React.MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest('a')
    if (anchor) {
      const href = anchor.getAttribute('href')
      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        e.preventDefault()
        store.setBrowserUrl(href)
        store.setShowBrowserSimulator(false)
        store.setShowBrowserModal(true)
      }
    }
  }, [])

  const sendQuick = (text: string) => {
    if (text === '打开网页') {
      store.setBrowserUrl('about:blank')
      store.setShowBrowserSimulator(true)
      return
    }
    if (text === '国家电网官网') {
      store.setBrowserUrl('https://www.sgcc.com.cn')
      store.setShowBrowserSimulator(true)
      return
    }
    store.setInputText(text)
    sendMessage()
  }

  const sendMessage = () => {
  const text = inputText.trim()
  if (!text || isThinking) return

  // 关闭浏览器模拟器
  store.setShowBrowserSimulator(false)

  store.setInputText('')
  const isBuild = store.chatMode === 'build'
  const target = isBuild
    ? store.buildMessages
    : selectedMicroApp
    ? store.dedicatedMessages
    : store.messages
  const setTarget = isBuild
    ? store.setBuildMessages
    : selectedMicroApp
    ? store.setDedicatedMessages
    : store.setMessages
  
  // 添加用户消息
  const newMsg: ChatMessage = {
    id: 'msg-' + Date.now(),
    role: 'user',
    content: text,
    timestamp: new Date().toISOString(),
  }
  setTarget([...target, newMsg])
  scrollToBottom('smooth', 50)
  store.setIsThinking(true)

  const appId = selectedMicroApp ? selectedMicroApp.id : ''
  const chatMode = store.chatMode
  const account = currentAccount
  
  // 拼接请求地址
  let url = `${API_PREFIX}/api/chat/stream?message=` + encodeURIComponent(text)
  if (appId) url += '&appId=' + encodeURIComponent(appId)
  url += '&mode=' + encodeURIComponent(chatMode)
  url += '&token=' + encodeURIComponent(account)
  
  if (chatMode === 'build' && appCreatorDraft) {
    url += '&draftApp=' + encodeURIComponent(JSON.stringify(appCreatorDraft))
  } else if (pendingCreation) {
    url += '&draftApp=' + encodeURIComponent(JSON.stringify(pendingCreation))
  }

  // ====================== 核心修复：定义 eventSource ======================
  let assistantContent = ''
  let assistantMsgId: string | null = null
  let sseTimeout: ReturnType<typeof setTimeout> | null = null

  // 创建 EventSource 实例（修复未定义问题）
  const eventSource = new EventSource(url, {
    withCredentials: false
  })

  const getCurrentMessages = () =>
    isBuild ? useStore.getState().buildMessages : selectedMicroApp ? useStore.getState().dedicatedMessages : useStore.getState().messages

  // 清理函数
  const cleanupSse = () => {
    if (sseTimeout) clearTimeout(sseTimeout)
    eventSource.close()
    store.setIsThinking(false)
  }

  // 超时机制
  const resetTimeout = () => {
    if (sseTimeout) clearTimeout(sseTimeout)
    sseTimeout = setTimeout(() => {
      cleanupSse()
      if (!assistantContent) {
        const errMsg: ChatMessage = {
          id: 'msg-' + Date.now(),
          role: 'assistant',
          content: '请求超时，请稍后重试。',
          timestamp: new Date().toISOString(),
        }
        setTarget([...getCurrentMessages(), errMsg])
        scrollToBottom('smooth', 50)
      }
    }, 120000)
  }

  resetTimeout()

  // 接收消息
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      resetTimeout()

      if (data.type === 'delta') {
        assistantContent += data.content
        const visibleContent = removeThinkTags(stripHtmlComments(assistantContent))
        if (!assistantMsgId) {
          assistantMsgId = 'msg-' + Date.now()
          const msg: ChatMessage = {
            id: assistantMsgId,
            role: 'assistant',
            content: visibleContent,
            timestamp: new Date().toISOString(),
            _streaming: true,
          }
          setTarget([...getCurrentMessages(), msg])
        } else {
          const msgs = getCurrentMessages()
          const msg = msgs.find((m) => m.id === assistantMsgId)
          if (msg) {
            const updated = msgs.map((m) => (m.id === assistantMsgId ? { ...m, content: visibleContent } : m))
            setTarget(updated)
          }
        }
        scrollToBottom('auto')
      } else if (data.type === 'done') {
        const msgs = getCurrentMessages()
        const msg = msgs.find((m) => m.id === assistantMsgId)
        const cleanContent = removeThinkTags(stripHtmlComments(stripDraftUpdateMarker(stripConfirmMarker(stripAskConfirmMarker(data.content)))))
        if (msg) {
          const updated = msgs.map((m) =>
            m.id === assistantMsgId ? { ...m, content: cleanContent, _streaming: false } : m
          )
          setTarget(updated)
        }
        // 处理创建应用逻辑
        const draft = parseConfirmMarker(data.content)
        store.setPendingCreation(draft ?? null)
        const askDraft = parseAskConfirmMarker(data.content)
        store.setAskedCreation(askDraft ?? null)
        
        // 构建模式自动更新草稿
        if (chatMode === 'build') {
          const draftUpdate = parseDraftUpdateMarker(data.content)
          if (draftUpdate && store.appCreatorDraft) {
            const next = { ...store.appCreatorDraft, ...draftUpdate }
            if (draftUpdate.interfaces && Array.isArray(draftUpdate.interfaces)) {
              const steps = (draftUpdate.interfaces as string[]).map((id: string) => {
                const a = apis.find((x) => x.id === id)
                return { type: 'api', apiId: id, label: a?.name || id }
              })
              next.flow = { type: 'sequence', steps }
            }
            store.setAppCreatorDraft(next)
          }
        }
        
        // 打开浏览器
        if (data.browserUrl) {
          store.setBrowserUrl(data.browserUrl)
          store.setShowBrowserSimulator(true)
        }
        
        cleanupSse()
        scrollToBottom('smooth', 100)
      }
    } catch {
      // 忽略格式错误的消息
    }
  }

  // 错误处理
  eventSource.onerror = () => {
    cleanupSse()
    if (!assistantContent) {
      const errMsg: ChatMessage = {
        id: 'msg-' + Date.now(),
        role: 'assistant',
        content: '连接出错，请稍后重试。',
        timestamp: new Date().toISOString(),
      }
      setTarget([...getCurrentMessages(), errMsg])
    }
    scrollToBottom('smooth', 50)
  }
}

  const confirmCreateApp = async () => {
    if (!pendingCreation) return
    try {
      await microAppApi.create(pendingCreation)
      store.setPendingCreation(null)
      // Refresh my apps
      const res = await microAppApi.list('user')
      store.setMyMicroApps(res.data.items || [])
      message.success('微应用创建成功')
    } catch (e: any) {
      message.error('创建失败：' + e.message)
    }
  }

  const cancelCreateApp = () => {
    store.setPendingCreation(null)
  }

  const confirmAskCreateApp = () => {
    if (!askedCreation) return
    store.setAskedCreation(null)
    store.setInputText('确认创建该微应用')
    setTimeout(() => sendMessage(), 50)
  }

  const cancelAskCreateApp = () => {
    store.setAskedCreation(null)
  }

  const removeDraftStep = (index: number) => {
    if (!pendingCreation || !pendingCreation.flow || !Array.isArray((pendingCreation.flow as any).steps)) return
    const flow = pendingCreation.flow as { type: string; steps: { type: string; apiId?: string; label?: string }[] }
    const steps = [...flow.steps]
    const removed = steps.splice(index, 1)[0]
    if (removed && removed.apiId) {
      const stillUsed = steps.some((s) => s.apiId === removed.apiId)
      if (!stillUsed) {
        const idx = (pendingCreation.interfaces as string[]).indexOf(removed.apiId)
        if (idx >= 0) {
          const newInterfaces = [...(pendingCreation.interfaces as string[])]
          newInterfaces.splice(idx, 1)
          store.setPendingCreation({ ...pendingCreation, interfaces: newInterfaces, flow: { ...flow, steps } })
          return
        }
      }
    }
    if (steps.length === 0) {
      store.setPendingCreation({ ...pendingCreation, flow: null })
    } else {
      store.setPendingCreation({ ...pendingCreation, flow: { ...flow, steps } })
    }
  }

  const loadJsonData = async () => {
    if (!jsonInput.trim()) {
      message.error('请输入 JSON 数据')
      return
    }
    try {
      const payload = JSON.parse(jsonInput)
      await dataApi.load(payload)
      store.setShowJsonEditor(false)
      store.setJsonInput('')
      message.success('加载成功')
    } catch (e: any) {
      message.error('JSON 格式错误：' + e.message)
    }
  }

  const exportCurrentData = async () => {
    try {
      const res = await dataApi.export()
      const data = res.data
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = (data.domain || 'digital-twin') + '_export.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      message.success('导出成功')
    } catch {
      message.error('导出失败')
    }
  }

  const handleCreateApp = async () => {
    if (!appCreatorDraft) return
    const name = String(appCreatorDraft.name || '').trim()
    if (!name) {
      message.error('请填写应用名称')
      return
    }
    try {
      await microAppApi.create(appCreatorDraft)
      store.setShowAppCreator(false)
      store.setAppCreatorDraft(null)
      store.setChatMode('global')
      store.setBuildMessages([])
      const res = await microAppApi.list('user')
      store.setMyMicroApps(res.data.items || [])
      message.success('微应用创建成功')
    } catch (e: any) {
      message.error('创建失败：' + e.message)
    }
  }

  // Helper to update param binding for a specific flow step
  const updateParamBinding = (stepIndex: number, paramName: string, binding: any) => {
    if (!appCreatorDraft) return
    const flow = (appCreatorDraft.flow as any) || { type: 'sequence', steps: [] }
    const steps = [...(flow.steps || [])]
    const step = steps[stepIndex]
    if (!step) return
    const params = [...(step.params || [])]
    const existingIdx = params.findIndex((p: any) => p.name === paramName)
    if (existingIdx >= 0) {
      params[existingIdx] = binding
    } else {
      params.push(binding)
    }
    steps[stepIndex] = { ...step, params }
    store.setAppCreatorDraft({ ...appCreatorDraft, flow: { ...flow, steps } })
  }
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
  } = store
  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

 return (
    <>
      {/* Header */}
      <div className="h-14 bg-white border-b border-[#e5e6eb] flex items-center px-5 justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* 默认进来 */}
          {!selectedMicroApp ? (
            <>
             <button
                className="p-1.5 rounded hover:bg-[#f2f3f5] text-[#86909c] transition-colors"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                title={sidebarCollapsed ? '展开' : '收起'}
              >
            {sidebarCollapsed ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            )}
          </button>
              {/* <span className="text-[15px] font-semibold">⚙️ OpenCraft 智能助手</span> */}
              <span className="text-[15px] font-semibold">OpenCraft 智能助手</span>
              <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-[#e8f3ff] text-[#165dff]">通用对话</span>
              {currentDomain && <span className="text-xs px-2.5 py-[3px] rounded bg-[#f5e8ff] text-[#722ed1] font-medium">{currentDomain}</span>}
            </>
          ) : (
            <>
             <button
                className="p-1.5 rounded hover:bg-[#f2f3f5] text-[#86909c] transition-colors"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                title={sidebarCollapsed ? '展开' : '收起'}
              >
                {sidebarCollapsed ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                )}
              </button>
            {/* 选中了左侧的收藏夹/系统预置 */}
            {
              !sidebarCollapsed?(<><Tooltip title={selectedMicroApp.name}>
                <span className="text-[15px] font-semibold cursor-pointer hover:text-blue-500">
                  {selectedMicroApp.name?.length > 7
                    ? selectedMicroApp.name.slice(0, 7) + '...'
                    : selectedMicroApp.name}
                </span>
              </Tooltip></>):(<span>{selectedMicroApp.name}</span>)
            }
              <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-[#e8ffea] text-[#00b42a]">专属对话</span>
              {currentDomain && <span className="text-xs px-2.5 py-[3px] rounded bg-[#f5e8ff] text-[#722ed1] font-medium">{currentDomain}</span>}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedMicroApp && (
            <button
              className="px-3 py-1.5 rounded-md text-[13px] text-[#4e5969] border border-[#e5e6eb] hover:bg-[#f2f3f5] transition-colors"
              onClick={backToGlobal}
            >
              ← 返回通用对话
            </button>
          )}
      
           <Select 
              defaultValue="P00001100" 
              placeholder="请选择" 
              onChange={(val) => {
                console.log("选中的值：", val);
                setCurrentAccount(val);
              }} 
              style={{ width: 150 }} 
              size="middle">
                {accountOptions.map((item) => (
                  <Option key={item.key} value={item.key}>
                    {item.key}
                  </Option>
                ))}
            </Select>
          {/* 更多菜单 */}
          <div className="relative group">
            <button
              className="w-7 h-7 flex items-center justify-center rounded text-[#86909c] hover:bg-[#f2f3f5] hover:text-[#1a1a1a] transition-colors"
              title="更多"
            >
              ⋯
            </button>
            <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-[#e5e6eb] py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <button
                className="w-full text-left px-3 py-2 text-[13px] text-[#1a1a1a] hover:bg-[#f2f3f5] transition-colors"
                onClick={() => store.setShowJsonEditor(!showJsonEditor)}
              >
                {showJsonEditor ? '收起编辑器' : '自定义 JSON'}
              </button>
            </div>
          </div>
          {/* 网络状态：极简圆点 */}
          <div className="relative group flex items-center">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#00b42a]' : 'bg-[#f53f3f]'}`} />
            <div className="absolute right-0 top-full mt-1 px-2 py-1 bg-[#1a1a1a] text-white text-[11px] rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
              {isOnline ? '系统正常' : '网络断开'}
            </div>
          </div>
        </div>
      </div>

      {/* JSON Editor */}
      {showJsonEditor && (
        <div className="px-4 py-4 bg-white border-b border-[#e5e6eb]">
          <textarea
            className="w-full min-h-[120px] px-2.5 py-2.5 border border-[#e5e6eb] rounded-md text-[13px] font-mono outline-none focus:border-[#165dff] resize-y"
            value={jsonInput}
            onChange={(e) => store.setJsonInput(e.target.value)}
            placeholder="在此粘贴 JSON 数据..."
          />
          <div className="flex gap-2 mt-2 justify-end">
            <button
              className="px-3 py-1.5 rounded-md text-[13px] bg-[#f2f3f5] text-[#1a1a1a] border border-[#e5e6eb] hover:bg-[#e5e6eb] transition-colors"
              onClick={exportCurrentData}
            >
              导出当前
            </button>
            <button
              className="px-3 py-1.5 rounded-md text-[13px] bg-[#165dff] text-white hover:bg-[#114ec2] transition-colors"
              onClick={loadJsonData}
            >
              加载数据
            </button>
          </div>
        </div>
      )}

      {/* 创建微应用 Modal */}
      <Modal
        title={
          <div>
            <div className="text-lg font-semibold text-[#1a1a1a]">创建微应用</div>
            <div className="text-xs text-[#86909c] mt-1">手动填写信息并组装接口流程，或在下方通过对话让助手辅助完善</div>
          </div>
        }
        open={showAppCreator}
        onCancel={() => { 
          store.setShowAppCreator(false); 
          store.setAppCreatorDraft(null); 
          store.setChatMode('global') 
        }}
        footer={null}
        width={800}
        style={{ top: 20 }}
        bodyStyle={{ padding: 0, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}
      >
        <div className="px-6 py-4">
          {/* 基本信息 */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-[13px] font-medium text-[#1a1a1a] mb-1.5">应用名称 *</label>
              <input
                className="w-full px-3 py-2 border border-[#e5e6eb] rounded-md text-[13px] outline-none focus:border-[#165dff]"
                value={String(appCreatorDraft?.name || '')}
                onChange={(e) => store.setAppCreatorDraft({ ...appCreatorDraft!, name: e.target.value })}
                placeholder="例如：避雷器动作监视"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#1a1a1a] mb-1.5">应用描述</label>
              <textarea
                className="w-full px-3 py-2 border border-[#e5e6eb] rounded-md text-[13px] outline-none focus:border-[#165dff] resize-y min-h-[60px]"
                value={String(appCreatorDraft?.description || '')}
                onChange={(e) => store.setAppCreatorDraft({ ...appCreatorDraft!, description: e.target.value })}
                placeholder="描述这个微应用的用途..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-medium text-[#1a1a1a] mb-1.5">触发条件</label>
                <input
                  className="w-full px-3 py-2 border border-[#e5e6eb] rounded-md text-[13px] outline-none focus:border-[#165dff]"
                  value={String(appCreatorDraft?.trigger || '')}
                  onChange={(e) => store.setAppCreatorDraft({ ...appCreatorDraft!, trigger: e.target.value })}
                  placeholder="例如：每日 9:00"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#1a1a1a] mb-1.5">应用类型</label>
                <select
                  className="w-full px-3 py-2 border border-[#e5e6eb] rounded-md text-[13px] outline-none focus:border-[#165dff] bg-white"
                  value={String(appCreatorDraft?.app_type || 'query')}
                  onChange={(e) => store.setAppCreatorDraft({ ...appCreatorDraft!, app_type: e.target.value })}
                >
                  <option value="query">查询型</option>
                  <option value="generation">生成型</option>
                  <option value="scheduled">定时任务</option>
                </select>
              </div>
            </div>
          </div>

          {/* 接口选择 */}
          <div className="mb-6">
            <div className="text-[13px] font-medium text-[#1a1a1a] mb-2">选择接口</div>
            <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto border border-[#e5e6eb] rounded-md p-2">
              {apis.length === 0 ? (
                <div className="text-center py-4 text-[#86909c] text-xs">暂无可用接口</div>
              ) : (
                apis.map((api) => {
                  const selected = ((appCreatorDraft?.interfaces as string[]) || []).includes(api.id)
                  return (
                    <label
                      key={api.id}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded cursor-pointer transition-colors ${
                        selected ? 'bg-[#e8f3ff]' : 'hover:bg-[#f2f3f5]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => {
                          const current = ((appCreatorDraft?.interfaces as string[]) || [])
                          const updated = selected ? current.filter((id) => id !== api.id) : [...current, api.id]
                          const existingSteps = ((appCreatorDraft?.flow as any)?.steps as any[]) || []
                          const steps = updated.map((id) => {
                            const existing = existingSteps.find((s: any) => s.apiId === id)
                            const a = apis.find((x) => x.id === id)
                            return existing
                              ? { ...existing, type: 'api', apiId: id, label: a?.name || id }
                              : { type: 'api', apiId: id, label: a?.name || id }
                          })
                          store.setAppCreatorDraft({
                            ...appCreatorDraft!,
                            interfaces: updated,
                            flow: { type: 'sequence', steps },
                          })
                        }}
                        className="accent-[#165dff]"
                      />
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          api.method === 'GET'
                            ? 'bg-[#e8ffea] text-[#00b42a]'
                            : api.method === 'POST'
                            ? 'bg-[#e8f3ff] text-[#165dff]'
                            : api.method === 'PUT'
                            ? 'bg-[#fff7e8] text-[#ff7d00]'
                            : 'bg-[#ffe8e8] text-[#f53f3f]'
                        }`}
                      >
                        {api.method}
                      </span>
                      <span className="text-[13px] text-[#1a1a1a] flex-1 min-w-0 truncate">{api.name}</span>
                    </label>
                  )
                })
              )}
            </div>
          </div>

          {/* 参数映射配置 */}
          {((appCreatorDraft?.interfaces as string[]) || []).length > 0 && (
            <div className="mb-6">
              <div className="text-[13px] font-medium text-[#1a1a1a] mb-2">参数映射配置</div>
              <div className="space-y-3">
                {((appCreatorDraft?.flow as any)?.steps || []).map((step: any, idx: number) => {
                  const api = apis.find((a) => a.id === step.apiId)
                  if (!api) return null
                  const paramDefs = api.params ? Object.entries(api.params as Record<string, any>) : []
                  const stepParams = (step.params || []) as any[]
                  return (
                    <div key={step.apiId} className="border border-[#e5e6eb] rounded-md p-3 bg-white">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-[#e8f3ff] text-[#165dff]">{api.method}</span>
                        <span className="text-[13px] font-medium text-[#1a1a1a]">{api.name}</span>
                        <span className="text-[11px] text-[#86909c]">步骤 {idx + 1}</span>
                      </div>
                      {paramDefs.length === 0 && (
                        <div className="text-[11px] text-[#86909c]">该接口无预设参数，如需配置请先完善接口定义。</div>
                      )}
                      {paramDefs.map(([paramName, paramInfo]: [string, any]) => {
                        const binding = stepParams.find((p: any) => p.name === paramName) || {
                          name: paramName,
                          source: 'static',
                          value: '',
                          mapping: '',
                        }
                        return (
                          <div key={paramName} className="flex items-center gap-2 mb-2 last:mb-0">
                            <span className="text-[12px] text-[#1a1a1a] w-24 truncate" title={paramInfo.description}>{paramName}</span>
                            <select
                              className="text-[12px] border border-[#e5e6eb] rounded px-2 py-1 outline-none focus:border-[#165dff]"
                              value={binding.source}
                              onChange={(e) => updateParamBinding(idx, paramName, { ...binding, source: e.target.value })}
                            >
                              <option value="static">固定值</option>
                              <option value="user_input">用户输入</option>
                              <option value="prev_step">上一步输出</option>
                            </select>
                            {binding.source === 'static' && (
                              <input
                                className="flex-1 text-[12px] border border-[#e5e6eb] rounded px-2 py-1 outline-none focus:border-[#165dff]"
                                placeholder="固定值"
                                value={binding.value}
                                onChange={(e) => updateParamBinding(idx, paramName, { ...binding, value: e.target.value })}
                              />
                            )}
                            {binding.source === 'user_input' && (
                              <input
                                className="flex-1 text-[12px] border border-[#e5e6eb] rounded px-2 py-1 outline-none focus:border-[#165dff]"
                                placeholder="参数提示，如：请输入变电站ID"
                                value={binding.value}
                                onChange={(e) => updateParamBinding(idx, paramName, { ...binding, value: e.target.value })}
                              />
                            )}
                            {binding.source === 'prev_step' && (
                              <>
                                <select
                                  className="w-28 text-[12px] border border-[#e5e6eb] rounded px-2 py-1 outline-none focus:border-[#165dff]"
                                  value={binding.value}
                                  onChange={(e) => updateParamBinding(idx, paramName, { ...binding, value: e.target.value })}
                                >
                                  <option value="">选择步骤</option>
                                  {Array.from({ length: idx }).map((_, i) => {
                                    const prevStep = (appCreatorDraft?.flow as any)?.steps?.[i]
                                    const prevApi = apis.find((a) => a.id === prevStep?.apiId)
                                    return (
                                      <option key={i} value={String(i)}>步骤{i + 1} · {prevApi?.name || '未知'}</option>
                                    )
                                  })}
                                </select>
                                <input
                                  className="flex-1 text-[12px] border border-[#e5e6eb] rounded px-2 py-1 outline-none focus:border-[#165dff]"
                                  placeholder="JSON path，如 data.0.id"
                                  value={binding.mapping}
                                  onChange={(e) => updateParamBinding(idx, paramName, { ...binding, mapping: e.target.value })}
                                />
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 流程预览 */}
          {((appCreatorDraft?.interfaces as string[]) || []).length > 0 && (
            <div className="mb-6">
              <div className="text-[13px] font-medium text-[#1a1a1a] mb-2">调用流程预览</div>
              <div className="bg-[#f8f9fa] rounded-md p-4 border border-[#e5e6eb]">
                <FlowChart flow={appCreatorDraft?.flow as any} apis={apiMap()} />
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2 pt-2 pb-4">
            <button
              className="px-4 py-2 rounded-md text-[13px] bg-[#f2f3f5] text-[#1a1a1a] border border-[#e5e6eb] hover:bg-[#e5e6eb] transition-colors"
              onClick={() => { store.setShowAppCreator(false); store.setAppCreatorDraft(null); store.setChatMode('global') }}
            >
              取消
            </button>
            <button
              className="px-4 py-2 rounded-md text-[13px] bg-[#165dff] text-white hover:bg-[#114ec2] transition-colors"
              onClick={handleCreateApp}
            >
              创建微应用
            </button>
          </div>
        </div>
      </Modal>

      {/* Conversation assistant - 智能辅助对话区域 */}
      {showAppCreator && store.buildMessages.length > 0 && (
        <div className="border-t border-[#e5e6eb] bg-white flex-shrink-0 h-[420px] flex flex-col">
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-[#e5e6eb] bg-[#f7f8fa] flex items-center gap-2">
            <span className="text-sm">🤖</span>
            <span className="text-[13px] font-medium text-[#1a1a1a]">智能辅助对话</span>
            <span className="text-[11px] text-[#86909c]">· 描述需求即可自动修改上方表单</span>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" onClick={handleLinkClick}>
            {store.buildMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-[#86909c]">
                <div className="text-3xl mb-2">💬</div>
                <div className="text-sm mb-1">智能助手已就绪</div>
                <div className="text-xs text-center max-w-[260px] leading-relaxed">
                  在下方输入需求，例如“再加一个电缆接口”或“把名称改成设备巡检”，助手会自动帮您修改上方表单。
                </div>
              </div>
            )}
            {store.buildMessages.map((msg) => (
              <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-[#f2f3f5] flex items-center justify-center text-sm flex-shrink-0 mt-0.5">🤖</div>
                )}
                <div
                  className={`px-3.5 py-2.5 rounded-xl text-sm leading-relaxed max-w-[85%] shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-[#165dff] text-white rounded-br-md'
                      : 'bg-[#f8f9fa] text-[#1a1a1a] border border-[#e5e6eb] rounded-bl-md'
                  }`}
                  dangerouslySetInnerHTML={{
                    __html: msg.role === 'assistant' ? renderContent(msg.content) : escapeHtml(msg.content),
                  }}
                />
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-[#165dff] flex items-center justify-center text-sm flex-shrink-0 mt-0.5 text-white">👤</div>
                )}
              </div>
            ))}
            {isThinking && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#f2f3f5] flex items-center justify-center text-sm flex-shrink-0 mt-0.5">🤖</div>
                <div className="px-3.5 py-2.5 rounded-xl text-sm leading-relaxed bg-[#f8f9fa] text-[#86909c] border border-[#e5e6eb] rounded-bl-md shadow-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#86909c] animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#86909c] animate-bounce [animation-delay:0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#86909c] animate-bounce [animation-delay:0.3s]" />
                    正在思考…
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="px-4 py-3 border-t border-[#e5e6eb] bg-white flex gap-2 items-end">
            <textarea
              className="chat-input flex-1 px-3.5 py-2.5 border border-[#d9d9d9] rounded-lg text-sm outline-none resize-none min-h-[44px] max-h-[120px] leading-relaxed focus:border-[#165dff] focus:ring-1 focus:ring-[#165dff]/20 transition-all bg-[#f8f9fa]"
              value={inputText}
              onChange={(e) => store.setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="描述需求，例如：再加一个电缆接口…"
              rows={1}
              disabled={isThinking}
            />
            <button
              className="px-4 py-2.5 rounded-lg text-sm bg-[#165dff] text-white hover:bg-[#114ec2] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
              onClick={sendMessage}
              disabled={isThinking || !inputText.trim()}
            >
              发送
            </button>
          </div>
        </div>
      )}

      {/* 主内容区域 - 仅在非创建微应用模式时显示 */}
      {!showAppCreator && (
        <div className="flex-1 flex flex-col min-h-0 p-5" ref={outerScrollRef}>
          {/* ==================== Global Mode ==================== */}
          {!selectedMicroApp && (
            <>
              {/* Welcome Card */}
              {/* <div className="rounded-xl p-7 mb-4 text-white" style={{ background: 'linear-gradient(135deg, #165dff 0%, #114ec2 100%)' }}>
                <div className="text-xl font-semibold mb-2">欢迎使用数字孪生智能助手</div>
                <div className="text-sm opacity-90 leading-relaxed mb-4">
                  当前场景为 <strong>{currentDomain || '数字孪生'}</strong>，共有 {microApps.length} 个微应用、{apis.length} 个 API 接口。
                  <br />
                  您可以向我提问任何问题，我会自动识别并调用对应的微应用。
                </div>
              </div> */}

              {/* Global Chat */}
              <div className="bg-white rounded-lg border border-[#e5e6eb] flex flex-col flex-1 min-h-0">
                <div className="px-4 py-3 border-b border-[#e5e6eb] flex items-center justify-between flex-shrink-0">
                  <div>
                    <div className="text-sm font-semibold">⚙️ OpenCraft 智能助手 · 通用对话</div>
                    <div className="text-xs text-[#86909c]">我可以帮您调用任意微应用，请描述您的需求</div>
                  </div>
                  <div>
                    <button
                      className="text-xs text-[#86909c] px-2 py-1 rounded cursor-pointer hover:text-[#f53f3f] hover:bg-[#fff2f0] border border-transparent hover:border-[#ffccc7] transition-colors"
                      onClick={clearMessages}
                    >
                      🗑️ 清空对话
                    </button>
                  </div>
                </div>

                <div
                  className="flex-1 overflow-y-auto px-4 py-4"
                  ref={messageScrollRef}
                  onScroll={() => {
                    userScrolledUp.current = !isNearBottom()
                  }}
                  onClick={handleLinkClick}
                >
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-[#86909c]">
                      <div className="text-5xl mb-3">⚙️</div>
                      <div className="text-sm">
                        我是 OpenCraft 智能助手
                        <br />
                        在下方输入需求，我会帮你调用微应用
                      </div>
                    </div>
                  )}
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-2.5 mb-4 ${msg.role === 'user' ? 'ml-auto flex-row-reverse max-w-[85%]' : 'max-w-[85%]'}`}>
                      <div
                        className={`w-[34px] h-[34px] rounded-full flex items-center justify-center text-base flex-shrink-0 ${
                          msg.role === 'user' ? 'bg-[#165dff] text-white' : 'bg-[#f2f3f5]'
                        }`}
                      >
                        {msg.role === 'user' ? '👤' : '🤖'}
                      </div>
                      <div>
                        <div
                          className={`px-3.5 py-2.5 rounded-xl text-sm leading-relaxed break-words ${
                            msg.role === 'user'
                              ? 'bg-[#165dff] text-white rounded-br-md'
                              : 'bg-[#f2f3f5] text-[#1a1a1a] rounded-bl-md max-h-[520px] overflow-y-auto scrollbar-thin'
                          }`}
                          dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }}
                        />
                        <div className="text-[11px] text-[#86909c] mt-1 text-right">{formatTime(msg.timestamp)}</div>
                      </div>
                    </div>
                  ))}


                  {isThinking && (
                    <div className="flex gap-2.5 mb-4 max-w-[85%]">
                      <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-base bg-[#f2f3f5] flex-shrink-0">🤖</div>
                      <div>
                        <div className="px-3.5 py-2.5 rounded-xl text-sm leading-relaxed break-words bg-[#f2f3f5] text-[#1a1a1a] rounded-bl-md">
                          <span className="inline-flex gap-1 items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#86909c] animate-bounce" />
                            <span className="w-1.5 h-1.5 rounded-full bg-[#86909c] animate-bounce [animation-delay:0.1s]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-[#86909c] animate-bounce [animation-delay:0.2s]" />
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick tags */}
                <div className="flex gap-1.5 px-4 py-2 flex-wrap border-t border-[#f2f3f5] flex-shrink-0">
                  {globalQuickTags().map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2.5 py-1 rounded bg-[#f2f3f5] text-[#4e5969] cursor-pointer border border-[#e5e6eb] hover:border-[#165dff] hover:text-[#165dff] hover:bg-[#e8f3ff] transition-colors"
                      onClick={() => sendQuick(tag)}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Creation confirmation card */}
                {pendingCreation && (
                  <div className="border border-[#165dff] rounded-lg mx-4 my-3 shadow-lg" style={{ boxShadow: '0 4px 12px rgba(22,93,255,0.1)' }}>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e6eb] bg-[#e8f3ff] rounded-t-lg">
                      <span className="text-sm font-semibold text-[#165dff]">🛠️ 确认创建微应用</span>
                      <span className="text-lg text-[#86909c] cursor-pointer w-6 h-6 flex items-center justify-center rounded hover:bg-[#f2f3f5] hover:text-[#1a1a1a]" onClick={cancelCreateApp}>
                        ×
                      </span>
                    </div>
                    {/* Tabs */}
                    <div className="flex border-b border-[#e5e6eb]">
                      {[
                        { key: 'basic', label: '基本信息' },
                        { key: 'code', label: '代码预览' },
                        { key: 'render', label: '渲染预览' },
                      ].map((tab) => (
                        <button
                          key={tab.key}
                          className={`flex-1 py-2 text-[13px] font-medium transition-colors ${
                            previewTab === tab.key
                              ? 'text-[#165dff] bg-white border-b-2 border-[#165dff]'
                              : 'text-[#86909c] hover:text-[#4e5969] hover:bg-[#f7f8fa]'
                          }`}
                          onClick={() => setPreviewTab(tab.key as any)}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <div className="px-4 py-3">
                      {previewTab === 'basic' && (
                        <>
                          <div className="flex mb-2.5 text-[13px] leading-relaxed">
                            <div className="w-[70px] text-[#86909c] flex-shrink-0">应用名称</div>
                            <input
                              className="flex-1 px-2.5 py-1.5 border border-[#e5e6eb] rounded-md text-[13px] outline-none focus:border-[#165dff]"
                              value={String(pendingCreation.name || '')}
                              onChange={(e) => store.setPendingCreation({ ...pendingCreation, name: e.target.value })}
                            />
                          </div>
                          <div className="flex mb-2.5 text-[13px] leading-relaxed">
                            <div className="w-[70px] text-[#86909c] flex-shrink-0">应用描述</div>
                            <input
                              className="flex-1 px-2.5 py-1.5 border border-[#e5e6eb] rounded-md text-[13px] outline-none focus:border-[#165dff]"
                              value={String(pendingCreation.description || '')}
                              onChange={(e) => store.setPendingCreation({ ...pendingCreation, description: e.target.value })}
                            />
                          </div>
                          <div className="flex mb-2.5 text-[13px] leading-relaxed">
                            <div className="w-[70px] text-[#86909c] flex-shrink-0">包含接口</div>
                            <div className="flex-1">
                              {Array.isArray(pendingCreation.interfaces) &&
                                (pendingCreation.interfaces as string[]).map((apiId: string) => (
                                  <span key={apiId} className="inline-block bg-[#e8f3ff] text-[#165dff] px-2 py-0.5 rounded text-xs mr-1.5 mb-1">
                                    {apiMap()[apiId]?.name || apiId}
                                  </span>
                                ))}
                            </div>
                          </div>
                          {pendingCreation.code && (
                            <div className="flex mb-2.5 text-[13px] leading-relaxed">
                              <div className="w-[70px] text-[#86909c] flex-shrink-0">执行代码</div>
                              <div className="flex-1">
                                <span className="inline-block bg-[#e8ffea] text-[#00b42a] px-2 py-0.5 rounded text-xs mr-1.5 mb-1">
                                  已生成可执行代码
                                </span>
                              </div>
                            </div>
                          )}
                          {pendingCreation.workflow && Array.isArray((pendingCreation.workflow as any).steps) && ((pendingCreation.workflow as any).steps as any[]).length > 0 && (
                            <div className="flex mb-2.5 text-[13px] leading-relaxed">
                              <div className="w-[70px] text-[#86909c] flex-shrink-0">用户步骤</div>
                              <div className="flex-1 flex flex-col gap-1.5">
                                {((pendingCreation.workflow as any).steps as any[]).map((step: any) => (
                                  <div key={step.index} className="flex items-start gap-2 px-2 py-1.5 bg-[#f7f8fa] border border-[#e5e6eb] rounded-md text-[13px]">
                                    <span className="w-5 h-5 flex items-center justify-center bg-[#86909c] text-white rounded-full text-[11px] font-semibold flex-shrink-0 mt-0.5">
                                      {step.index}
                                    </span>
                                    <span className="flex-1">{String(step.description || '')}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {pendingCreation.flow && (pendingCreation.flow as any).steps && Array.isArray((pendingCreation.flow as any).steps) ? (
                            <div className="flex mb-2.5 text-[13px] leading-relaxed">
                              <div className="w-[70px] text-[#86909c] flex-shrink-0">
                                调用流程 <span className="text-[#86909c] text-xs font-normal">（可删除步骤）</span>
                              </div>
                              <div className="flex-1 flex flex-col gap-1.5">
                                {((pendingCreation.flow as any).steps as any[]).map((step, idx) => (
                                  <div key={idx} className="flex items-center gap-2 px-2 py-1.5 bg-[#f7f8fa] border border-[#e5e6eb] rounded-md text-[13px]">
                                    <span className="w-5 h-5 flex items-center justify-center bg-[#165dff] text-white rounded-full text-[11px] font-semibold flex-shrink-0">
                                      {idx + 1}
                                    </span>
                                    <span className="flex-1">{step.label || step.apiId}</span>
                                    <span
                                      className="w-5 h-5 flex items-center justify-center text-[#86909c] cursor-pointer rounded hover:bg-[#ffece8] hover:text-[#f53f3f] text-base leading-none"
                                      onClick={() => removeDraftStep(idx)}
                                      title="删除此步骤"
                                    >
                                      ×
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="flex mb-2.5 text-[13px] leading-relaxed">
                              <div className="w-[70px] text-[#86909c] flex-shrink-0">调用流程</div>
                              <div className="flex-1 text-[#86909c]">暂无步骤，可从右侧接口列表添加</div>
                            </div>
                          )}
                        </>
                      )}
                      {previewTab === 'code' && (
                        <div className="mt-1">
                          {pendingCreation.code ? (
                            <div className="code-block relative">
                              <pre className="text-xs font-mono bg-[#f7f8fa] border border-[#e5e6eb] rounded-md p-3 overflow-x-auto max-h-[300px] overflow-y-auto">
                                {String(pendingCreation.code || '')}
                              </pre>
                            </div>
                          ) : (
                            <div className="text-sm text-[#86909c] text-center py-6">暂无代码，将使用 FlowNode 动态解释执行</div>
                          )}
                        </div>
                      )}
                      {previewTab === 'render' && (
                        <div className="mt-1">
                          {pendingCreation.render_config ? (
                            <div className="code-block relative">
                              <pre className="text-xs font-mono bg-[#f7f8fa] border border-[#e5e6eb] rounded-md p-3 overflow-x-auto max-h-[300px] overflow-y-auto">
                                {JSON.stringify(pendingCreation.render_config, null, 2)}
                              </pre>
                            </div>
                          ) : (
                            <div className="text-sm text-[#86909c] text-center py-6">暂无渲染配置，将使用默认 JSON 展示</div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end gap-2 px-4 py-2.5 border-t border-[#e5e6eb]">
                      <button
                        className="px-3 py-1.5 rounded-md text-[13px] bg-[#f2f3f5] text-[#1a1a1a] border border-[#e5e6eb] hover:bg-[#e5e6eb] transition-colors"
                        onClick={cancelCreateApp}
                      >
                        取消
                      </button>
                      <button
                        className="px-3 py-1.5 rounded-md text-[13px] bg-[#165dff] text-white hover:bg-[#114ec2] transition-colors"
                        onClick={confirmCreateApp}
                      >
                        ✓ 确认创建
                      </button>
                    </div>
                  </div>
                )}

                {/* Input */}
                <div className="px-4 py-3 border-t border-[#e5e6eb] flex gap-2 flex-shrink-0">
                  <textarea
                    autoFocus
                    className="chat-input flex-1 px-3.5 py-2.5 border border-[#e5e6eb] rounded-lg text-sm outline-none resize-none min-h-[44px] max-h-[120px] leading-relaxed focus:border-[#165dff]"
                    value={inputText}
                    onChange={(e) => store.setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage()
                      }
                    }}
                    placeholder={store.chatMode === 'build' ? '描述您想要的微应用功能...' : '描述您的需求，例如：查询变压器状态...'}
                    rows={1}
                    disabled={isThinking}
                  />
                  <button
                    className="px-3.5 py-2 rounded-md text-sm bg-[#165dff] text-white hover:bg-[#114ec2] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    onClick={sendMessage}
                    disabled={isThinking || !inputText.trim()}
                  >
                    发送
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ==================== Dedicated Mode ==================== */}
          {selectedMicroApp && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Execution Info Card */}
              <div className="bg-white rounded-lg p-4 mb-4 border border-[#e5e6eb]" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center justify-between text-sm font-semibold mb-3">
                  <span className="flex items-center gap-2">
                    执行信息
                    {selectedMicroApp.app_type === 'scheduled' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-[#fff7e8] text-[#ff7d00] border border-[#ff7d00]/20">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        定时任务
                      </span>
                    )}
                  </span>
                  <button
                    className="px-3 py-1 rounded-md text-xs bg-[#165dff] text-white hover:bg-[#114ec2] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    onClick={() => executeMicroApp(selectedMicroApp.id, userInputValues)}
                    disabled={store.executingApp === selectedMicroApp.id}
                  >
                    {store.executingApp === selectedMicroApp.id ? (
                      <span className="inline-flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" />
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:0.1s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:0.2s]" />
                      </span>
                    ) : (
                      '▶ 执行微应用'
                    )}
                  </button>
                </div>
                <div className={`flex mb-2.5 text-[13px] leading-relaxed ${selectedMicroApp.app_type === 'scheduled' ? 'bg-[#fff7e8] rounded-md px-3 py-2 -mx-1' : ''}`}>
                  <div className="w-[70px] text-[#86909c] flex-shrink-0">{selectedMicroApp.app_type === 'scheduled' ? '执行频率' : '触发条件'}</div>
                  <div className={`flex-1 ${selectedMicroApp.app_type === 'scheduled' ? 'text-[#ff7d00] font-medium' : 'text-[#1a1a1a]'}`}>{selectedMicroApp.trigger || '—'}</div>
                </div>
                <div className="flex mb-2.5 text-[13px] leading-relaxed">
                  <div className="w-[70px] text-[#86909c] flex-shrink-0">输入参数</div>
                  <div className="flex-1 text-[#1a1a1a]">{selectedMicroApp.input || '—'}</div>
                </div>
                {selectedMicroApp.interfaces?.includes('grid-amap-device-query-by-name') && (
                  <div className="flex mb-2.5 text-[13px] leading-relaxed items-center gap-2">
                    <div className="w-[70px] text-[#86909c] flex-shrink-0">变电站名称</div>
                    <input
                      type="text"
                      className="flex-1 text-[13px] border border-[#e5e6eb] rounded px-2 py-1 outline-none focus:border-[#165dff] transition-colors"
                      placeholder="请输入变电站名称（如：江表变）"
                      value={(userInputValues.psrName as string) || ''}
                      onChange={(e) => setUserInputValues({ ...userInputValues, psrName: e.target.value })}
                    />
                  </div>
                )}
                <div className="flex mb-2.5 text-[13px] leading-relaxed">
                  <div className="w-[70px] text-[#86909c] flex-shrink-0">输出结果</div>
                  <div className="flex-1 text-[#1a1a1a]">{selectedMicroApp.output || '—'}</div>
                </div>
                <div className="flex mb-2.5 text-[13px] leading-relaxed">
                  <div className="w-[70px] text-[#86909c] flex-shrink-0">绑定接口</div>
                  <div className="flex-1">
                    {selectedMicroApp.interfaces.map((apiId) => (
                      <span key={apiId} className="inline-block bg-[#e8f3ff] text-[#165dff] px-2 py-0.5 rounded text-xs mr-1.5 mb-1">
                        {apiMap()[apiId]?.name || apiId}
                      </span>
                    ))}
                  </div>
                </div>
                {selectedMicroApp.skills && selectedMicroApp.skills.length > 0 && (
                  <div className="flex text-[13px] leading-relaxed">
                    <div className="w-[70px] text-[#86909c] flex-shrink-0">关联 Skill</div>
                    <div className="flex-1">
                      {selectedMicroApp.skills.map((sk) => (
                        <span key={sk} className="inline-block bg-[#f5e8ff] text-[#722ed1] px-2 py-0.5 rounded text-xs mr-1.5 mb-1">
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Execution History — only for scheduled micro-apps */}
              {selectedMicroApp.app_type === 'scheduled' && (
                <div className="bg-white rounded-lg p-4 mb-4 border border-[#e5e6eb]" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                  <div
                    className="flex items-center justify-between text-sm font-semibold mb-2 cursor-pointer select-none"
                    onClick={() => setShowHistory(!showHistory)}
                  >
                    <span className="flex items-center gap-1.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff7d00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      执行历史
                    </span>
                    <span className="text-xs text-[#86909c]">{showHistory ? '收起' : '展开'}{executionHistory.length > 0 ? `（${executionHistory.length}）` : ''}</span>
                  </div>
                  {showHistory && (
                    <div className="space-y-2">
                      {executionHistory.length === 0 ? (
                        <div className="text-xs text-[#86909c] py-2">暂无执行记录</div>
                      ) : (
                        executionHistory.map((h, idx) => (
                          <div key={idx} className="text-[13px] bg-[#f8f9fa] rounded px-3 py-2 text-[#1a1a1a]">
                            {h.summary}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Flow Chart */}
              <div className="bg-white rounded-lg p-4 mb-4 border border-[#e5e6eb]" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div className="text-sm font-semibold mb-3">接口调用逻辑</div>
                <div className="bg-[#f8f9fa] rounded-md p-4">
                  <FlowChart flow={selectedMicroApp.flow} apis={apiMap()} />
                </div>
              </div>

              {/* Browser Simulator — strictly bound to web-browser-sim micro-app only */}
              {selectedMicroApp.id === 'web-browser-sim' && (
                <div className="mb-4">
                  <BrowserSimulator initialUrl={browserUrl} height={480} />
                </div>
              )}

              {/* Dedicated Chat Header */}
              <div className="bg-white rounded-lg px-4 py-3.5 mb-3 border border-[#e5e6eb] border-l-4 border-l-[#00b42a] flex items-center justify-between flex-shrink-0" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">⚙️</span>
                  <div>
                    <div className="text-sm font-semibold text-[#1a1a1a]">{selectedMicroApp.name} 专属助手</div>
                    <div className="text-xs text-[#86909c]">
                      {store.chatMode === 'build' ? '当前正在构建微应用，可描述需求进行调整' : '当前已进入该微应用，可询问数据或输入"执行"开始运行'}
                    </div>
                  </div>
                </div>
                <div>
                  <button
                    className="text-xs text-[#86909c] px-2 py-1 rounded cursor-pointer hover:text-[#f53f3f] hover:bg-[#fff2f0] border border-transparent hover:border-[#ffccc7] transition-colors"
                    onClick={clearMessages}
                  >
                    🗑️ 清空对话
                  </button>
                </div>
              </div>

              {/* Dedicated Chat */}
              <div className="bg-white rounded-lg border border-[#e5e6eb] flex flex-col flex-1 min-h-0">
                <div
                  className="flex-1 overflow-y-auto px-4 py-4"
                  ref={messageScrollRef}
                  onScroll={() => {
                    userScrolledUp.current = !isNearBottom()
                  }}
                  onClick={handleLinkClick}
                >
                  {dedicatedMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-[#86909c]">
                      <div className="text-5xl mb-3">⚙️</div>
                      <div className="text-sm">
                        {selectedMicroApp.name} 专属助手
                        <br />
                        在下方输入需求，我会围绕此微应用为您解答
                      </div>
                    </div>
                  )}
                  {dedicatedMessages.map((msg) => (
                    <div key={msg.id} className={`flex gap-2.5 mb-4 ${msg.role === 'user' ? 'ml-auto flex-row-reverse max-w-[85%]' : 'max-w-[85%]'}`}>
                      <div
                        className={`w-[34px] h-[34px] rounded-full flex items-center justify-center text-base flex-shrink-0 ${
                          msg.role === 'user' ? 'bg-[#165dff] text-white' : 'bg-[#f2f3f5]'
                        }`}
                      >
                        {msg.role === 'user' ? '👤' : '🤖'}
                      </div>
                      <div>
                        <div
                          className={`px-3.5 py-2.5 rounded-xl text-sm leading-relaxed break-words ${
                            msg.role === 'user'
                              ? 'bg-[#165dff] text-white rounded-br-md'
                              : 'bg-[#f2f3f5] text-[#1a1a1a] rounded-bl-md max-h-[520px] overflow-y-auto scrollbar-thin'
                          }`}
                          dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }}
                        />
                        <div className="text-[11px] text-[#86909c] mt-1 text-right">{formatTime(msg.timestamp)}</div>
                      </div>
                    </div>
                  ))}
                  {isThinking && (
                    <div className="flex gap-2.5 mb-4 max-w-[85%]">
                      <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-base bg-[#f2f3f5] flex-shrink-0">🤖</div>
                      <div>
                        <div className="px-3.5 py-2.5 rounded-xl text-sm leading-relaxed break-words bg-[#f2f3f5] text-[#1a1a1a] rounded-bl-md">
                          <span className="inline-flex gap-1 items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#86909c] animate-bounce" />
                            <span className="w-1.5 h-1.5 rounded-full bg-[#86909c] animate-bounce [animation-delay:0.1s]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-[#86909c] animate-bounce [animation-delay:0.2s]" />
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                {/* Quick tags */}
                <div className="flex gap-1.5 px-4 py-2 flex-wrap border-t border-[#f2f3f5] flex-shrink-0">
                  {dedicatedQuickTags().map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2.5 py-1 rounded bg-[#f2f3f5] text-[#4e5969] cursor-pointer border border-[#e5e6eb] hover:border-[#165dff] hover:text-[#165dff] hover:bg-[#e8f3ff] transition-colors"
                      onClick={() => sendQuick(tag)}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Input */}
                <div className="px-4 py-3 border-t border-[#e5e6eb] flex gap-2 flex-shrink-0">
                  <textarea
                    autoFocus
                    className="chat-input flex-1 px-3.5 py-2.5 border border-[#e5e6eb] rounded-lg text-sm outline-none resize-none min-h-[44px] max-h-[120px] leading-relaxed focus:border-[#165dff]"
                    value={inputText}
                    onChange={(e) => store.setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage()
                      }
                    }}
                    placeholder={`与 ${selectedMicroApp.name} 对话，或输入"执行"开始运行...`}
                    rows={2}
                    disabled={isThinking}
                  />
                  <button
                    className="px-3.5 py-2 rounded-md text-sm bg-[#165dff] text-white hover:bg-[#114ec2] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    onClick={sendMessage}
                    disabled={isThinking || !inputText.trim()}
                  >
                    发送
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <Modal
        title="网页浏览器模拟器"
        open={showBrowserModal}
        onCancel={() => store.setShowBrowserModal(false)}
        footer={null}
        width={1100}
        style={{ top: 20 }}
        bodyStyle={{ padding: 0 }}
        destroyOnClose
      >
        <div className="p-4">
          <BrowserSimulator initialUrl={browserUrl} height={640} />
        </div>
      </Modal>
    </>
  )
}

import { create } from 'zustand'
import type { MicroApp, ApiEndpoint, ChatMessage, SkillMeta, DataSample } from '@/types'

interface ToastState {
  // 当前页面要展示的提示信息
  msg: string
  // 提示信息类型，例如 success / error / info
  type: string
}

interface AppState {
  // 数据列表
  microApps: MicroApp[]
  myMicroApps: MicroApp[]
  apis: ApiEndpoint[]
  skills: SkillMeta[]
  samples: DataSample[]
  currentDomain: string

  // 当前选择项
  selectedMicroApp: MicroApp | null
  selectedApi: ApiEndpoint | null
  selectedScene: string

  // 搜索 / 过滤
  apiSearch: string
  filteredApis: ApiEndpoint[]

  // 聊天相关状态
  messages: ChatMessage[]
  dedicatedMessages: ChatMessage[]
  buildMessages: ChatMessage[]
  inputText: string
  isThinking: boolean
  chatMode: 'global' | 'in-app' | 'build'

  // 页面 UI 状态
  rightPanelView: 'digital_twin' | 'other'
  rightPanelCollapsed: boolean
  sidebarCollapsed: boolean
  showJsonEditor: boolean
  jsonInput: string
  pendingCreation: Record<string, unknown> | null
  editingAppId: string | null
  editingAppName: string
  executingApp: string
  isOnline: boolean
  toast: ToastState

  // 加载状态
  loadingMicroApps: boolean
  loadingMyApps: boolean
  loadingApis: boolean
  skillsLoading: boolean
  skillDetailLoading: boolean

  // 技能详情
  skillDetail: { name: string; body?: string } | null

  // 应用创建器
  showAppCreator: boolean
  appCreatorDraft: Record<string, unknown> | null
  askedCreation: Record<string, unknown> | null

  // 浏览器模拟器
  showBrowserSimulator: boolean
  browserUrl: string
  showBrowserModal: boolean

  // 当前账号
  currentAccount: string

  // 状态更新方法
  setMicroApps: (apps: MicroApp[]) => void
  setMyMicroApps: (apps: MicroApp[]) => void
  setApis: (apis: ApiEndpoint[]) => void
  setSkills: (skills: SkillMeta[]) => void
  setSamples: (samples: DataSample[]) => void
  setCurrentDomain: (domain: string) => void

  setSelectedMicroApp: (app: MicroApp | null) => void
  setSelectedApi: (api: ApiEndpoint | null) => void
  setSelectedScene: (scene: string) => void

  setApiSearch: (search: string) => void
  setFilteredApis: (apis: ApiEndpoint[]) => void

  setMessages: (msgs: ChatMessage[]) => void
  addMessage: (msg: ChatMessage) => void
  setDedicatedMessages: (msgs: ChatMessage[]) => void
  addDedicatedMessage: (msg: ChatMessage) => void
  setBuildMessages: (msgs: ChatMessage[]) => void
  addBuildMessage: (msg: ChatMessage) => void
  setInputText: (text: string) => void
  setIsThinking: (v: boolean) => void
  setChatMode: (mode: 'global' | 'in-app' | 'build') => void

  setRightPanelView: (view: 'digital_twin' | 'other') => void
  setRightPanelCollapsed: (v: boolean) => void
  setSidebarCollapsed: (v: boolean) => void
  setShowJsonEditor: (v: boolean) => void
  setJsonInput: (text: string) => void
  setPendingCreation: (draft: Record<string, unknown> | null) => void
  setEditingAppId: (id: string | null) => void
  setEditingAppName: (name: string) => void
  setExecutingApp: (id: string) => void
  setIsOnline: (v: boolean) => void
  showToast: (msg: string, type?: string) => void
  hideToast: () => void

  setLoadingMicroApps: (v: boolean) => void
  setLoadingMyApps: (v: boolean) => void
  setLoadingApis: (v: boolean) => void
  setSkillsLoading: (v: boolean) => void
  setSkillDetailLoading: (v: boolean) => void
  setSkillDetail: (detail: { name: string; body?: string } | null) => void
  setShowAppCreator: (v: boolean) => void
  setAppCreatorDraft: (draft: Record<string, unknown> | null) => void
  setAskedCreation: (draft: Record<string, unknown> | null) => void
  setShowBrowserSimulator: (v: boolean) => void
  setBrowserUrl: (url: string) => void
  setShowBrowserModal: (v: boolean) => void
  setCurrentAccount: (account: string) => void
}

// 全局提示自动消失计时器引用
let toastTimer: ReturnType<typeof setTimeout> | null = null

// 全局应用状态管理 store，使用 zustand 实现轻量状态容器
export const useStore = create<AppState>((set) => ({
  // 应用和接口数据
  microApps: [], // 全部可用微应用列表
  myMicroApps: [], // 当前用户或当前项目拥有的微应用
  apis: [], // API 列表数据
  skills: [], // 技能元信息列表
  samples: [], // 示例数据集合
  currentDomain: '', // 当前使用的域名或环境标识

  // 当前选中项，用于页面侧边栏、详情面板等
  selectedMicroApp: null,
  selectedApi: null,
  selectedScene: '',

  // 搜索与过滤状态
  apiSearch: '', // API 搜索输入内容
  filteredApis: [], // 搜索后筛选出的 API 列表

  // 聊天相关状态
  messages: [], // 全局聊天消息
  dedicatedMessages: [], // 面向指定场景的专用聊天消息
  buildMessages: [], // 构建流程中的消息
  inputText: '', // 聊天输入框内容
  isThinking: false, // 是否正在等待 AI 或后台响应
  chatMode: 'global', // 聊天模式：全局、应用内或构建模式

  // 页面 UI 状态
  rightPanelView: 'digital_twin', // 右侧面板当前展示视图
  rightPanelCollapsed: false, // 右侧面板是否折叠
  sidebarCollapsed: true, // 左侧侧边栏是否折叠
  showJsonEditor: false, // 是否显示 JSON 编辑器
  jsonInput: '', // JSON 编辑器输入内容
  pendingCreation: null, // 待确认创建的临时数据
  editingAppId: null, // 当前正在编辑的应用 ID
  editingAppName: '', // 当前正在编辑的应用名称
  executingApp: '', // 当前正在执行的应用 ID
  isOnline: true, // 网络连接状态
  toast: { msg: '', type: '' }, // 全局提示信息

  // 加载状态，控制页面 loading 动画
  loadingMicroApps: false,
  loadingMyApps: false,
  loadingApis: false,
  skillsLoading: false,
  skillDetailLoading: false,
  skillDetail: null, // 技能详情对象

  // 应用创建器相关 UI 和草稿状态
  showAppCreator: false,
  appCreatorDraft: null,
  askedCreation: null,

  // 浏览器模拟器相关状态
  showBrowserSimulator: false,
  browserUrl: 'https://www.sgcc.com.cn',
  showBrowserModal: false,

  // 当前账号
  currentAccount: 'P00001100',

  // 状态更新方法
  setMicroApps: (apps) => set({ microApps: apps }),
  setMyMicroApps: (apps) => set({ myMicroApps: apps }),
  setApis: (apis) => set({ apis }),
  setSkills: (skills) => set({ skills }),
  setSamples: (samples) => set({ samples }),
  setCurrentDomain: (domain) => set({ currentDomain: domain }),

  // 选择项更新方法
  setSelectedMicroApp: (app) => set({ selectedMicroApp: app }),
  setSelectedApi: (api) => set({ selectedApi: api }),
  setSelectedScene: (scene) => set({ selectedScene: scene }),

  // 搜索与过滤方法
  setApiSearch: (search) => set({ apiSearch: search }),
  setFilteredApis: (apis) => set({ filteredApis: apis }),

  // 聊天消息管理
  setMessages: (msgs) => set({ messages: msgs }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setDedicatedMessages: (msgs) => set({ dedicatedMessages: msgs }),
  addDedicatedMessage: (msg) => set((s) => ({ dedicatedMessages: [...s.dedicatedMessages, msg] })),
  setBuildMessages: (msgs) => set({ buildMessages: msgs }),
  addBuildMessage: (msg) => set((s) => ({ buildMessages: [...s.buildMessages, msg] })),
  setInputText: (text) => set({ inputText: text }),
  setIsThinking: (v) => set({ isThinking: v }),
  setChatMode: (mode) => set({ chatMode: mode }),

  // UI 控制方法
  setRightPanelView: (view) => set({ rightPanelView: view }),
  setRightPanelCollapsed: (v) => set({ rightPanelCollapsed: v }),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setShowJsonEditor: (v) => set({ showJsonEditor: v }),
  setJsonInput: (text) => set({ jsonInput: text }),
  setPendingCreation: (draft) => set({ pendingCreation: draft }),
  setEditingAppId: (id) => set({ editingAppId: id }),
  setEditingAppName: (name) => set({ editingAppName: name }),
  setExecutingApp: (id) => set({ executingApp: id }),
  setIsOnline: (v) => set({ isOnline: v }),
  showToast: (msg, type = '') => {
    // 展示提示信息，并在 3 秒后自动清除
    set({ toast: { msg, type } })
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => set({ toast: { msg: '', type: '' } }), 3000)
  },
  hideToast: () => set({ toast: { msg: '', type: '' } }),

  // 加载状态控制方法
  setLoadingMicroApps: (v) => set({ loadingMicroApps: v }),
  setLoadingMyApps: (v) => set({ loadingMyApps: v }),
  setLoadingApis: (v) => set({ loadingApis: v }),
  setSkillsLoading: (v) => set({ skillsLoading: v }),
  setSkillDetailLoading: (v) => set({ skillDetailLoading: v }),
  setSkillDetail: (detail) => set({ skillDetail: detail }),

  // 创建器与浏览器模拟器状态更新
  setShowAppCreator: (v) => set({ showAppCreator: v }),
  setAppCreatorDraft: (draft) => set({ appCreatorDraft: draft }),
  setAskedCreation: (draft) => set({ askedCreation: draft }),
  setShowBrowserSimulator: (v) => set({ showBrowserSimulator: v }),
  setBrowserUrl: (url) => set({ browserUrl: url }),
  setShowBrowserModal: (v) => set({ showBrowserModal: v }),
  setCurrentAccount: (account) => set({ currentAccount: account }),
}))

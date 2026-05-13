import { create } from 'zustand'
import type { MicroApp, ApiEndpoint, ChatMessage, SkillMeta, DataSample } from '@/types'

interface ToastState {
  msg: string
  type: string
}

interface AppState {
  // Data
  microApps: MicroApp[]
  myMicroApps: MicroApp[]
  apis: ApiEndpoint[]
  skills: SkillMeta[]
  samples: DataSample[]
  currentDomain: string

  // Selection
  selectedMicroApp: MicroApp | null
  selectedApi: ApiEndpoint | null
  selectedScene: string

  // Search / Filter
  apiSearch: string
  filteredApis: ApiEndpoint[]

  // Chat
  messages: ChatMessage[]
  dedicatedMessages: ChatMessage[]
  buildMessages: ChatMessage[]
  inputText: string
  isThinking: boolean
  chatMode: 'global' | 'in-app' | 'build'

  // UI State
  rightPanelView: 'digital_twin' | 'other'
  rightPanelCollapsed: boolean
  showJsonEditor: boolean
  jsonInput: string
  pendingCreation: Record<string, unknown> | null
  editingAppId: string | null
  editingAppName: string
  executingApp: string
  isOnline: boolean
  toast: ToastState

  // Loading
  loadingMicroApps: boolean
  loadingMyApps: boolean
  loadingApis: boolean
  skillsLoading: boolean
  skillDetailLoading: boolean

  // Skill detail
  skillDetail: { name: string; body?: string } | null

  // App Creator
  showAppCreator: boolean
  appCreatorDraft: Record<string, unknown> | null
  askedCreation: Record<string, unknown> | null

  // Browser Simulator
  showBrowserSimulator: boolean
  browserUrl: string

  // Actions
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
}

let toastTimer: ReturnType<typeof setTimeout> | null = null

export const useStore = create<AppState>((set) => ({
  microApps: [],
  myMicroApps: [],
  apis: [],
  skills: [],
  samples: [],
  currentDomain: '',

  selectedMicroApp: null,
  selectedApi: null,
  selectedScene: '',

  apiSearch: '',
  filteredApis: [],

  messages: [],
  dedicatedMessages: [],
  buildMessages: [],
  inputText: '',
  isThinking: false,
  chatMode: 'global',

  rightPanelView: 'digital_twin',
  rightPanelCollapsed: false,
  showJsonEditor: false,
  jsonInput: '',
  pendingCreation: null,
  editingAppId: null,
  editingAppName: '',
  executingApp: '',
  isOnline: true,
  toast: { msg: '', type: '' },

  loadingMicroApps: false,
  loadingMyApps: false,
  loadingApis: false,
  skillsLoading: false,
  skillDetailLoading: false,
  skillDetail: null,

  showAppCreator: false,
  appCreatorDraft: null,
  askedCreation: null,
  showBrowserSimulator: false,
  browserUrl: 'https://www.sgcc.com.cn',

  setMicroApps: (apps) => set({ microApps: apps }),
  setMyMicroApps: (apps) => set({ myMicroApps: apps }),
  setApis: (apis) => set({ apis }),
  setSkills: (skills) => set({ skills }),
  setSamples: (samples) => set({ samples }),
  setCurrentDomain: (domain) => set({ currentDomain: domain }),

  setSelectedMicroApp: (app) => set({ selectedMicroApp: app }),
  setSelectedApi: (api) => set({ selectedApi: api }),
  setSelectedScene: (scene) => set({ selectedScene: scene }),

  setApiSearch: (search) => set({ apiSearch: search }),
  setFilteredApis: (apis) => set({ filteredApis: apis }),

  setMessages: (msgs) => set({ messages: msgs }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setDedicatedMessages: (msgs) => set({ dedicatedMessages: msgs }),
  addDedicatedMessage: (msg) => set((s) => ({ dedicatedMessages: [...s.dedicatedMessages, msg] })),
  setBuildMessages: (msgs) => set({ buildMessages: msgs }),
  addBuildMessage: (msg) => set((s) => ({ buildMessages: [...s.buildMessages, msg] })),
  setInputText: (text) => set({ inputText: text }),
  setIsThinking: (v) => set({ isThinking: v }),
  setChatMode: (mode) => set({ chatMode: mode }),

  setRightPanelView: (view) => set({ rightPanelView: view }),
  setRightPanelCollapsed: (v) => set({ rightPanelCollapsed: v }),
  setShowJsonEditor: (v) => set({ showJsonEditor: v }),
  setJsonInput: (text) => set({ jsonInput: text }),
  setPendingCreation: (draft) => set({ pendingCreation: draft }),
  setEditingAppId: (id) => set({ editingAppId: id }),
  setEditingAppName: (name) => set({ editingAppName: name }),
  setExecutingApp: (id) => set({ executingApp: id }),
  setIsOnline: (v) => set({ isOnline: v }),
  showToast: (msg, type = '') => {
    set({ toast: { msg, type } })
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => set({ toast: { msg: '', type: '' } }), 3000)
  },
  hideToast: () => set({ toast: { msg: '', type: '' } }),

  setLoadingMicroApps: (v) => set({ loadingMicroApps: v }),
  setLoadingMyApps: (v) => set({ loadingMyApps: v }),
  setLoadingApis: (v) => set({ loadingApis: v }),
  setSkillsLoading: (v) => set({ skillsLoading: v }),
  setSkillDetailLoading: (v) => set({ skillDetailLoading: v }),
  setSkillDetail: (detail) => set({ skillDetail: detail }),
  setShowAppCreator: (v) => set({ showAppCreator: v }),
  setAppCreatorDraft: (draft) => set({ appCreatorDraft: draft }),
  setAskedCreation: (draft) => set({ askedCreation: draft }),
  setShowBrowserSimulator: (v) => set({ showBrowserSimulator: v }),
  setBrowserUrl: (url) => set({ browserUrl: url }),
}))

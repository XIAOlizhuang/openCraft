import { useEffect } from 'react'
import { useStore } from '@/store/useStore'
import AppList from '@/components/Sidebar/AppList'
import ChatWindow from '@/components/Chat/ChatWindow'
import ApiList from '@/components/ApiCatalog/ApiList'
import Toast from '@/components/Common/Toast'
import { API_PREFIX } from '@/services/api'

export default function Layout() {
  const { setIsOnline, sidebarCollapsed, setCurrentAccount } = useStore()

  useEffect(() => {
    const online = () => setIsOnline(true)
    const offline = () => setIsOnline(false)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    setIsOnline(navigator.onLine)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [setIsOnline])

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const res = await fetch(`${API_PREFIX}/api/data/getUserInfo`)
        const data = await res.json()
        if (data.name) {
          setCurrentAccount(data.name)
        }
      } catch (e) {
        console.error('获取用户信息失败:', e)
      }
    }
    fetchUserInfo()
  }, [setCurrentAccount])

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6f7] text-[#1a1a1a]">
      <Toast />
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-[280px]'} bg-white border-r border-[#e5e6eb] flex flex-col flex-shrink-0 transition-all duration-300`}>
        <AppList />
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <ChatWindow />
      </main>

      {/* Right Panel */}
      <aside className="w-[280px] bg-white border-l border-[#e5e6eb] flex flex-col flex-shrink-0">
        <ApiList />
      </aside>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Clock, Calendar } from 'lucide-react'

export default function TimerPanel() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
      <div className="flex items-center gap-2 mb-1">
        <Clock size={14} className="text-primary-500" />
        <span className="text-xl font-semibold text-slate-800 tabular-nums tracking-tight">
          {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Calendar size={11} />
        <span>{now.getFullYear()}年{now.getMonth() + 1}月{now.getDate()}日</span>
      </div>
    </div>
  )
}

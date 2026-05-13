import { useStore } from '@/store/useStore'

export default function Toast() {
  const { toast } = useStore()
  const visible = !!toast.msg

  const bgClass =
    toast.type === 'error'
      ? 'bg-[#f53f3f]'
      : toast.type === 'success'
      ? 'bg-[#00b42a]'
      : 'bg-[#1a1a1a]'

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-lg text-white text-[13px] z-[300] pointer-events-none shadow-lg transition-opacity duration-300 ${bgClass} ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {toast.msg}
    </div>
  )
}

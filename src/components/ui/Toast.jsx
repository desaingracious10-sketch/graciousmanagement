import { useEffect, useState } from 'react'

const TONE_STYLES = {
  success: {
    frame: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    bar: 'bg-emerald-500',
    icon: '✅',
  },
  error: {
    frame: 'border-rose-200 bg-rose-50 text-rose-900',
    bar: 'bg-rose-500',
    icon: '❌',
  },
  warning: {
    frame: 'border-amber-200 bg-amber-50 text-amber-900',
    bar: 'bg-amber-500',
    icon: '⚠️',
  },
  info: {
    frame: 'border-sky-200 bg-sky-50 text-sky-900',
    bar: 'bg-sky-500',
    icon: 'ℹ️',
  },
}

export default function ToastViewport({ toasts, onDismiss }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastCard({ toast, onDismiss }) {
  const duration = toast.duration || 3000
  const [visible, setVisible] = useState(true)
  const tone = TONE_STYLES[toast.tone] || TONE_STYLES.info

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setVisible(false)
      window.setTimeout(() => onDismiss(toast.id), 180)
    }, duration)

    return () => window.clearTimeout(timeoutId)
  }, [duration, onDismiss, toast.id])

  return (
    <div
      className={`pointer-events-auto overflow-hidden rounded-2xl border shadow-[0_22px_48px_rgba(15,23,42,0.18)] transition ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      } ${tone.frame}`}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="pt-0.5 text-base">{tone.icon}</div>
        <div className="min-w-0 flex-1">
          {toast.title ? <div className="text-sm font-semibold">{toast.title}</div> : null}
          <div className="text-sm">{toast.message}</div>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-white/60 hover:text-slate-700"
        >
          Tutup
        </button>
      </div>
      <div className="h-1 w-full bg-white/50">
        <div className={`h-full ${tone.bar} animate-[toast-progress_linear_forwards]`} style={{ animationDuration: `${duration}ms` }} />
      </div>
    </div>
  )
}

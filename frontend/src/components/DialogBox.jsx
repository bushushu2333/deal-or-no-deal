import { useEffect, useRef, useState } from 'react'

function DialogBox({ name = '主持人 · 金姐', text, loading, children }) {
  const [shown, setShown] = useState('')
  const [done, setDone] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    setShown('')
    setDone(false)
    if (!text) return
    let i = 0
    timerRef.current = setInterval(() => {
      i += 1
      setShown(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(timerRef.current)
        setDone(true)
      }
    }, 32)
    return () => clearInterval(timerRef.current)
  }, [text])

  const skip = () => {
    if (!done && text) {
      clearInterval(timerRef.current)
      setShown(text)
      setDone(true)
    }
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-20 px-3 pb-3 md:px-8 md:pb-5">
      <div className="max-w-4xl mx-auto relative">
        <div className="dialog-nameplate absolute -top-4 left-5 px-4 py-1 rounded-full text-sm md:text-base font-bold text-amber-950 z-10">
          {name}
        </div>
        <div
          className="dialog-box rounded-2xl px-5 pt-6 pb-4 md:px-7 md:pt-7 md:pb-5 min-h-[110px] cursor-pointer"
          onClick={skip}
        >
          <p className={`text-base md:text-xl leading-relaxed text-amber-50 ${!done ? 'type-cursor' : ''}`}>
            {loading ? '……' : shown}
          </p>
          {done && children && (
            <div className="mt-4 flex flex-wrap gap-3 justify-end fade-in">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DialogBox

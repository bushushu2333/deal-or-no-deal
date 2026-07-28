import { useState } from 'react'

const SRC = {
  normal: '/assets/host_normal.png',
  excited: '/assets/host_excited.png',
  thinking: '/assets/host_thinking.png',
}

function Host({ expression = 'normal' }) {
  const [failed, setFailed] = useState({})
  const src = SRC[expression] && !failed[expression] ? SRC[expression] : SRC.normal

  if (failed.normal) return null // 立绘还没生成好时整个隐藏，不影响游戏

  return (
    <div className="host-standee fixed right-0 md:right-4 bottom-0 z-0 pointer-events-none h-[45vh] md:h-[80vh]">
      <img
        key={src}
        src={src}
        alt="主持人"
        className="block h-full object-contain object-bottom"
        onError={() => setFailed((f) => ({ ...f, [expression]: true }))}
      />
    </div>
  )
}

export default Host

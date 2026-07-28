// 程序化合成的刺激 BGM — WebAudio，无需外部音频文件
// 低音贝斯连复 + 心跳底鼓 + 噪声踩镲 + 紧张感持续音垫；报价阶段自动加猛

let ctx = null
let master = null
let seqTimer = null
let step = 0
let intensity = 0 // 0=常态 1=报价悬念
let droneStarted = false

const BPM = 126
const STEP = 60 / BPM / 2 // 八分音符
const BASE_VOL = 0.16

// A 小调贝斯连复: A1 A1 C2 A1 E2 E2 G2 A2
const BASSLINE = [55, 55, 65.41, 55, 82.41, 82.41, 98, 110]

function ensureCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    master = ctx.createGain()
    master.gain.value = BASE_VOL
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
}

function kick(t, vol = 1) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.frequency.setValueAtTime(150, t)
  o.frequency.exponentialRampToValueAtTime(38, t + 0.12)
  g.gain.setValueAtTime(0.9 * vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.28)
  o.connect(g); g.connect(master)
  o.start(t); o.stop(t + 0.3)
}

function hat(t, vol = 0.22) {
  const len = 0.05
  const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  const src = ctx.createBufferSource()
  src.buffer = buf
  const f = ctx.createBiquadFilter()
  f.type = 'highpass'; f.frequency.value = 7500
  const g = ctx.createGain(); g.gain.value = vol
  src.connect(f); f.connect(g); g.connect(master)
  src.start(t)
}

function bass(t, freq, vol = 0.45) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  const f = ctx.createBiquadFilter()
  o.type = 'sawtooth'; o.frequency.value = freq
  f.type = 'lowpass'; f.frequency.value = 320; f.Q.value = 5
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + STEP * 0.95)
  o.connect(f); f.connect(g); g.connect(master)
  o.start(t); o.stop(t + STEP)
}

// 紧张感持续音垫（只启动一次）：失谐锯齿波 + 慢 LFO 扫滤波
function startDrone() {
  if (droneStarted) return
  droneStarted = true
  const g = ctx.createGain(); g.gain.value = 0.045
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'; f.frequency.value = 800
  ;[110, 164.81, 220].forEach((fr, i) => {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'; o.frequency.value = fr
    o.detune.value = (i - 1) * 7
    o.connect(f); o.start()
  })
  const lfo = ctx.createOscillator()
  const lg = ctx.createGain()
  lfo.frequency.value = 0.13; lg.gain.value = 300
  lfo.connect(lg); lg.connect(f.frequency); lfo.start()
  f.connect(g); g.connect(master)
}

function scheduleStep(s, t) {
  const b = s % 8
  if (b === 0 || b === 4) kick(t, 1)                       // 主鼓点：心跳驱动
  if (b === 6 && intensity > 0) kick(t, 0.55)              // 悬念期加鬼音
  if (b % 2 === 1) hat(t, intensity > 0 ? 0.34 : 0.2)      // 反拍踩镲
  if (intensity > 0 && b % 2 === 0) hat(t, 0.13)           // 悬念期16分密镲
  bass(t, BASSLINE[b], intensity > 0 ? 0.58 : 0.42)
}

export function startBGM() {
  ensureCtx()
  if (seqTimer) return
  startDrone()
  let nextT = ctx.currentTime + 0.1
  seqTimer = setInterval(() => {
    while (nextT < ctx.currentTime + 0.25) {
      scheduleStep(step, nextT)
      nextT += STEP
      step++
    }
  }, 100)
}

export function stopBGM() {
  clearInterval(seqTimer)
  seqTimer = null
}

export function setIntensity(v) {
  intensity = v
}

// 报价揭晓的戏剧性 sting：定音鼓 + 铜管和弦刺
export function sting() {
  if (!ctx || !master) return
  const t = ctx.currentTime
  kick(t, 1.5); kick(t + 0.18, 1.1)
  ;[220, 277.18, 329.63].forEach((fr, i) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sawtooth'; o.frequency.value = fr
    g.gain.setValueAtTime(0.001, t)
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.03 + i * 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.3)
    o.connect(g); g.connect(master)
    o.start(t); o.stop(t + 1.4)
  })
}

// 开箱揭晓的小音效：木质叩击 + 高频亮片
export function tickReveal() {
  if (!ctx || !master) return
  const t = ctx.currentTime
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'triangle'
  o.frequency.setValueAtTime(880, t)
  o.frequency.exponentialRampToValueAtTime(220, t + 0.1)
  g.gain.setValueAtTime(0.5, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
  o.connect(g); g.connect(master)
  o.start(t); o.stop(t + 0.25)
}

export function setMuted(m) {
  if (master) master.gain.value = m ? 0 : BASE_VOL
}

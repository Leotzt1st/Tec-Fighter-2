// Original, procedural chiptune score and sound design; no external audio assets.
export class AudioManager {
  constructor(settings) {
    this.settings = settings
    this.context = null
    this.scene = 'silent'
    this.timer = null
    this.beat = 0
    this.nextBeat = 0
    this.sources = new Set()
    this.musicSources = new Set()
    this.unsubscribe = settings.subscribe(() => this.applyVolumes())
  }
  async unlock() {
    try {
      if (!this.context) {
        const Context = globalThis.AudioContext || globalThis.webkitAudioContext
        if (!Context) return false
        this.context = new Context()
        this.master = this.context.createGain()
        this.music = this.context.createGain()
        this.sfx = this.context.createGain()
        this.music.connect(this.master)
        this.sfx.connect(this.master)
        // Keep transients bounded when several impacts occur simultaneously.
        this.limiter = this.context.createDynamicsCompressor()
        this.limiter.threshold.value = -10
        this.limiter.ratio.value = 8
        this.master.connect(this.limiter)
        this.limiter.connect(this.context.destination)
        this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate)
        const data = this.noise.getChannelData(0)
        for (let index = 0; index < data.length; index++) data[index] = Math.random() * 2 - 1
        this.applyVolumes()
      }
      if (this.context.state === 'suspended') await this.context.resume()
      this.startMusic()
      return this.context.state === 'running'
    } catch { return false }
  }
  applyVolumes() {
    if (!this.context) return
    const values = this.settings.values
    const at = this.context.currentTime
    this.master.gain.setTargetAtTime(values.muted ? 0 : values.masterVolume, at, 0.02)
    this.music.gain.setTargetAtTime(values.musicVolume, at, 0.02)
    this.sfx.gain.setTargetAtTime(values.sfxVolume, at, 0.02)
  }
  voice({ frequency = 220, endFrequency, start = this.context.currentTime, duration = 0.15, volume = 0.12, wave = 'triangle', channel = this.sfx, noise = false, cutoff = 3000 }) {
    if (!this.context || this.context.state !== 'running') return
    const source = noise ? this.context.createBufferSource() : this.context.createOscillator()
    if (noise) source.buffer = this.noise
    else {
      source.type = wave
      source.frequency.setValueAtTime(frequency, start)
      if (endFrequency) source.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration)
    }
    const envelope = this.context.createGain()
    const filter = this.context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = cutoff
    envelope.gain.setValueAtTime(0, start)
    envelope.gain.linearRampToValueAtTime(volume, start + Math.min(0.006, duration / 4))
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    source.connect(filter)
    filter.connect(envelope)
    envelope.connect(channel)
    this.sources.add(source)
    if (channel === this.music) this.musicSources.add(source)
    source.onended = () => {
      source.disconnect(); filter.disconnect(); envelope.disconnect()
      this.sources.delete(source); this.musicSources.delete(source)
    }
    source.start(start)
    source.stop(start + duration + 0.02)
  }
  setScene(scene) {
    const next = ['menu', 'battle'].includes(scene) ? scene : 'silent'
    if (this.scene === next) return
    this.stopMusic()
    this.scene = next
    this.beat = 0
    this.nextBeat = this.context?.currentTime || 0
    this.startMusic()
  }
  stopMusic() {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null }
    for (const source of this.musicSources) { try { source.stop() } catch { /* Already finished. */ } }
    this.musicSources.clear()
  }
  startMusic() {
    if (!this.context || this.scene === 'silent' || this.timer !== null) return
    this.nextBeat = this.context.currentTime + 0.04
    this.scheduleMusic()
    this.timer = setInterval(() => this.scheduleMusic(), 100)
  }
  scheduleMusic() {
    if (!this.context || this.context.state !== 'running' || this.scene === 'silent') return
    const now = this.context.currentTime
    if (this.nextBeat < now - 0.1) this.nextBeat = now + 0.04
    const battle = this.scene === 'battle'
    const step = battle ? 0.125 : 0.205
    const melody = battle ? [69, 0, 72, 76, 0, 74, 72, 0, 67, 0, 71, 74, 0, 72, 71, 67] : [69, 0, 76, 0, 72, 0, 79, 76, 67, 0, 74, 0, 71, 0, 76, 74]
    const midi = number => 440 * 2 ** ((number - 69) / 12)
    while (this.nextBeat < now + 0.25) {
      const index = this.beat % melody.length
      const note = melody[index]
      if (!this.settings.values.muted && this.settings.values.musicVolume > 0) {
        if (note) this.voice({ frequency: midi(note), start: this.nextBeat, duration: step * 1.5, volume: 0.055, wave: battle ? 'square' : 'triangle', cutoff: 1400, channel: this.music })
        if (this.beat % 4 === 0) this.voice({ frequency: midi(index < 8 ? 45 : 43), start: this.nextBeat, duration: step * 3.5, volume: 0.14, channel: this.music, cutoff: 500 })
        if (battle && this.beat % 4 === 0) this.voice({ frequency: 110, endFrequency: 35, start: this.nextBeat, duration: 0.12, volume: 0.2, wave: 'sine', channel: this.music })
        if (battle && this.beat % 4 === 2) this.voice({ start: this.nextBeat, duration: 0.065, volume: 0.04, noise: true, cutoff: 5000, channel: this.music })
      }
      this.nextBeat += step
      this.beat++
    }
  }
  play(type, characterIndex = 0) {
    if (!this.context || this.context.state !== 'running' || this.settings.values.muted) return
    const at = this.context.currentTime
    const tone = (frequency, endFrequency, duration, volume, wave = 'triangle', delay = 0) => this.voice({ frequency, endFrequency, duration, volume, wave, start: at + delay })
    const noise = (duration, volume, cutoff = 2500) => this.voice({ noise: true, duration, volume, cutoff, start: at })
    switch (type) {
      case 'nav': tone(480, 620, 0.045, 0.06); break
      case 'confirm': tone(440, 880, 0.1, 0.12); tone(660, 990, 0.15, 0.08, 'triangle', 0.08); break
      case 'light': noise(0.075, 0.1, 2800); tone(180, 65, 0.09, 0.16); break
      case 'heavy': noise(0.14, 0.17, 1800); tone(150, 38, 0.22, 0.26, 'sine'); break
      case 'hit': noise(0.09, 0.15, 2400); tone(120, 45, 0.12, 0.18, 'sine'); break
      case 'block': tone(580, 200, 0.09, 0.11, 'square'); noise(0.05, 0.045, 6000); break
      case 'parry': tone(980, 1700, 0.18, 0.15); tone(1470, 2100, 0.2, 0.08, 'sine'); break
      case 'special': {
        const base = 100 + (Number(characterIndex) || 0) * 24
        tone(base, base * 5, 0.22, 0.19, 'sawtooth')
        tone(base * 3, 45, 0.5, 0.23, 'triangle', 0.18)
        noise(0.4, 0.14, 4500)
        break
      }
      case 'ko': tone(130, 28, 0.65, 0.3, 'sawtooth'); noise(0.5, 0.18, 1400); break
      case 'victory': [440, 554.37, 659.25, 880].forEach((frequency, index) => tone(frequency, frequency, 0.3, 0.12, 'triangle', index * 0.12)); break
    }
  }
  destroy() {
    this.stopMusic()
    this.unsubscribe()
    for (const source of this.sources) { try { source.stop() } catch { /* Already finished. */ } }
    this.sources.clear()
    if (this.context && this.context.state !== 'closed') void this.context.close()
    this.context = null
  }
}

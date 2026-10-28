// User-provided music files; combat and navigation effects remain synthesized.
export const MUSIC_TRACKS = Object.freeze({
  menu: './assets/audio/MenuTF.mp3',
  battle: './assets/audio/Storymode.mp3',
  infinite: './assets/audio/TecFightersInfinito.mp3'
})
export class AudioManager {
  constructor(settings) {
    this.settings = settings
    this.context = null
    this.scene = 'silent'
    this.tracks = new Map()
    this.musicElement = null
    this.musicError = null
    this.destroyed = false
    this.sources = new Set()
    this.unsubscribe = settings.subscribe(() => this.applyVolumes())
  }
  async unlock() {
    try {
      if (this.destroyed) return false
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
    source.onended = () => {
      source.disconnect(); filter.disconnect(); envelope.disconnect()
      this.sources.delete(source)
    }
    source.start(start)
    source.stop(start + duration + 0.02)
  }
  setScene(scene) {
    const next = Object.hasOwn(MUSIC_TRACKS, scene) ? scene : 'silent'
    if (this.scene !== next) this.stopMusic()
    this.scene = next
    this.startMusic()
  }
  stopMusic() {
    // Pausing preserves the playhead so resuming never restarts a fight's music.
    for (const { element } of this.tracks.values()) element.pause()
  }
  startMusic() {
    if (this.destroyed || !this.context || this.context.state !== 'running' || this.scene === 'silent') return
    let track = this.tracks.get(this.scene)
    if (!track) {
      const element = new Audio(MUSIC_TRACKS[this.scene])
      element.loop = true
      element.preload = 'metadata'
      const source = this.context.createMediaElementSource(element)
      source.connect(this.music)
      element.addEventListener('error', () => {
        this.musicError = `Não foi possível carregar a música: ${element.getAttribute('src')}`
      })
      track = { element, source, pending: false }
      this.tracks.set(this.scene, track)
    }
    this.musicElement = track.element
    if (!track.element.paused || track.pending) return
    this.musicError = null
    track.pending = true
    // Browsers require a user gesture. Later gestures retry blocked playback.
    let playbackError
    Promise.resolve(track.element.play()).catch(error => {
      playbackError = error
      if (!['AbortError', 'NotAllowedError'].includes(error.name)) this.musicError = error.message
    }).finally(() => {
      track.pending = false
      // If a scene changed while play() was pending, keep this track paused.
      if (this.destroyed || this.tracks.get(this.scene) !== track) track.element.pause()
      else if (track.element.paused && (!playbackError || playbackError.name === 'AbortError')) this.startMusic()
    })
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
      case 'promotion': [523.25, 659.25, 783.99, 1046.5, 1568].forEach((frequency, index) => tone(frequency, frequency * 1.1, .45, .13, 'triangle', index * .12)); break
      case 'victory': [440, 554.37, 659.25, 880].forEach((frequency, index) => tone(frequency, frequency, 0.3, 0.12, 'triangle', index * 0.12)); break
    }
  }
  destroy() {
    this.destroyed = true
    this.stopMusic()
    for (const { element, source } of this.tracks.values()) {
      source.disconnect()
      element.removeAttribute('src')
      element.load()
    }
    this.tracks.clear()
    this.musicElement = null
    this.unsubscribe()
    for (const source of this.sources) { try { source.stop() } catch { /* Already finished. */ } }
    this.sources.clear()
    if (this.context && this.context.state !== 'closed') void this.context.close()
    this.context = null
  }
}

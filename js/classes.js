// classes.js - suporte a múltiplas animações, auto-detect frames, espelhamento e debug com F3

// 🔧 variável global de debug (liga/desliga com F3)
window.DEBUG_MODE = true
window.addEventListener('keydown', (e) => {
  if (e.key === 'F3') {
    window.DEBUG_MODE = !window.DEBUG_MODE
    console.log(`🧩 Debug mode: ${window.DEBUG_MODE ? 'ON' : 'OFF'}`)
  }
})

class Sprite {
  constructor({
    position = { x: 0, y: 0 },
    imageSrc = '',
    scale = 1,
    framesMax = 1,
    offset = { x: 0, y: 0 },
    lado = 'direita'
  }) {
    this.position = position
    this.width = 50
    this.height = 150
    this.scale = scale
    this.offset = offset || { x: 0, y: 0 }
    this.lado = lado

    this.image = new Image()
    this.imageSrc = imageSrc || ''
    this.imageLoaded = false

    this.framesMax = framesMax || 1
    this.framesCurrent = 0
    this.framesElapsed = 0
    this.framesHold = 6

    this.isBackground = typeof this.imageSrc === 'string' && this.imageSrc.includes('fundo_rua')

    if (this.imageSrc) {
      this.image.onload = () => {
        this.imageLoaded = true
        if (!this.framesMax || this.framesMax === 'auto') {
          const est = Math.round(this.image.width / (this.image.height || 1))
          this.framesMax = est >= 1 ? est : 1
        }
      }
      this.image.onerror = () => console.warn('Erro ao carregar imagem:', this.imageSrc)
      this.image.src = this.imageSrc
    }
  }

  desenho() {
    if (this.isBackground) {
      if (!this.imageLoaded) return
      c.drawImage(this.image, 0, 0, canvas.width, canvas.height)
      return
    }

    if (!this.imageLoaded) return

    const frameWidth = this.image.width / Math.max(1, this.framesMax)
    c.save()

    if (this.lado === 'esquerda') {
      c.scale(-1, 1)
      c.drawImage(
        this.image,
        this.framesCurrent * frameWidth,
        0,
        frameWidth,
        this.image.height,
        -this.position.x - frameWidth * this.scale + (this.offset.x || 0),
        this.position.y - (this.offset.y || 0),
        frameWidth * this.scale,
        this.image.height * this.scale
      )
    } else {
      c.drawImage(
        this.image,
        this.framesCurrent * frameWidth,
        0,
        frameWidth,
        this.image.height,
        this.position.x - (this.offset.x || 0),
        this.position.y - (this.offset.y || 0),
        frameWidth * this.scale,
        this.image.height * this.scale
      )
    }

    c.restore()
  }

  animateFrames() {
    if (!this.imageLoaded) return
    if (!this.framesMax || this.framesMax <= 1) return
    this.framesElapsed++
    if (this.framesElapsed % this.framesHold === 0) {
      if (this.framesCurrent < this.framesMax - 1) this.framesCurrent++
      else this.framesCurrent = 0
    }
  }

  update() {
    this.desenho()
    this.animateFrames()
  }
}

class Fighter extends Sprite {
  constructor({
    position = { x: 0, y: 0 },
    velocity = { x: 0, y: 0 },
    color = 'red',
    imageSrc = '',
    scale = 1,
    framesMax = 1,
    offset = { x: 0, y: 0 },
    sprites = {},
    lado = 'direita'
  }) {
    super({ position, imageSrc, scale, framesMax, offset, lado })

    this.velocity = velocity
    this.color = color
    this.isAttacking = false
    this.health = 100

    // deslocamento das hitboxes (empurradas bem mais para a direita)
    const deslocamentoX = -220 // aumentado de 340 para 580

    this.attackbox = {
      position: { x: this.position.x, y: this.position.y },
      offset: { x: deslocamentoX, y: 40 }, // movida muito mais para a direita
      width: 120,
      height: 50
    }

    this.bodyBox = {
      position: { x: this.position.x + deslocamentoX , y: this.position.y },
      width: 100,
      height: 150
    }

    this.sprites = sprites || {}
    this.currentAnimation = null

    for (const key in this.sprites) {
      const s = this.sprites[key]
      if (s && s.imageSrc) {
        s.image = new Image()
        s.image.onload = () => {
          if (!s.framesMax || s.framesMax === 'auto') {
            const est = Math.round(s.image.width / (s.image.height || 1))
            s.framesMax = est >= 1 ? est : 1
          }
        }
        s.image.onerror = () => console.warn('Erro ao carregar sprite:', s.imageSrc)
        s.image.src = s.imageSrc
      }
    }

    if (this.sprites.idle && this.sprites.idle.imageSrc) {
      this.setAnimation('idle')
    } else if (imageSrc) {
      this.currentAnimation = 'base'
    }
  }

  setAnimation(name) {
    if (this.currentAnimation === name) return
    const s = this.sprites[name]
    if (!s) {
      console.warn('Animação não encontrada:', name)
      return
    }

    if (s.image && s.image.complete) {
      this.image = s.image
      this.imageSrc = s.imageSrc
      this.imageLoaded = true
    } else {
      this.image = new Image()
      this.image.onload = () => { this.imageLoaded = true }
      this.image.onerror = () => console.warn('Erro ao carregar imagem de animação:', s.imageSrc)
      this.image.src = s.imageSrc
    }

    this.framesMax = s.framesMax || 1
    this.framesHold = typeof s.framesHold === 'number' ? s.framesHold : 6
    this.framesCurrent = 0
    this.framesElapsed = 0
    this.currentAnimation = name
  }

  update(enemy) {
    // virar automaticamente pro inimigo
    if (enemy && this.position.x > enemy.position.x) {
      this.lado = 'esquerda'
    } else if (enemy && this.position.x < enemy.position.x) {
      this.lado = 'direita'
    }

    this.desenho()
    this.animateFrames()

    // ajusta posição das hitboxes
    const offsetX = this.lado === 'esquerda' ? -this.attackbox.offset.x : this.attackbox.offset.x

    this.attackbox.position.x = this.position.x + offsetX
    this.attackbox.position.y = this.position.y + (this.attackbox.offset.y || 0)

    this.bodyBox.position.x = this.position.x + (this.lado === 'esquerda' ? -25 : 25)
    this.bodyBox.position.y = this.position.y

    // desenha hitboxes (debug)
    if (window.DEBUG_MODE) {
      // ataque (vermelho)
      c.fillStyle = this.isAttacking ? 'rgba(255, 0, 0, 0.4)' : 'rgba(255, 0, 0, 0.15)'
      c.fillRect(
        this.attackbox.position.x,
        this.attackbox.position.y,
        this.attackbox.width,
        this.attackbox.height
      )

      // corpo (azul)
      c.fillStyle = 'rgba(0, 100, 255, 0.25)'
      c.fillRect(
        this.bodyBox.position.x,
        this.bodyBox.position.y,
        this.bodyBox.width,
        this.bodyBox.height
      )
    }

    // gravidade e movimento
    this.position.x += this.velocity.x
    this.position.y += this.velocity.y

    const groundOffset = (typeof window.GROUND_OFFSET === 'number') ? window.GROUND_OFFSET : 40
    if (this.position.y + this.height + (this.velocity.y || 0) >= canvas.height - groundOffset) {
      this.velocity.y = 0
    } else {
      this.velocity.y += gravity
    }
  }

  attack() {
    this.isAttacking = true
    if (this.sprites.attack) this.setAnimation('attack')
    setTimeout(() => {
      this.isAttacking = false
      if (this.velocity.x !== 0 && this.sprites.run) this.setAnimation('run')
      else if (this.sprites.idle) this.setAnimation('idle')
    }, 300)
  }
}

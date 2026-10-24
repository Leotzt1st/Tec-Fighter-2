// =================== CONFIG DO CANVAS ===================
const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')

canvas.width = 1920
canvas.height = 1080
c.fillRect(0, 0, canvas.width, canvas.height)

const gravity = 0.7
// distância (em px) entre a base do canvas e a "superfície do chão".
// Aumente esse valor para "engrossar" a hitbox do chão (os lutadores pousam mais alto).
// Ex.: window.GROUND_OFFSET = 80
window.GROUND_OFFSET = window.GROUND_OFFSET || 900
let player, enemy, background

// =================== FUNÇÕES DE SUPORTE ===================
function loadImagePromise(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(src)
    img.onerror = () => reject(src)
    img.src = src
  })
}

async function findBackgroundSource() {
  const candidates = [
    './img/fundo_rua.png',
    './fundo_rua.png',
    './img/fundo_rua.jpg',
    './fundo_rua.webp'
  ]
  for (const s of candidates) {
    try {
      await loadImagePromise(s)
      console.log('Fundo encontrado em:', s)
      return s
    } catch (e) {}
  }
  console.warn('Nenhum fundo encontrado — usando fallback.')
  return null
}

// =================== SISTEMA DE PERSONAGENS ===================
// nomes suportados: eduardo, vinicius, leonardo, rodolfo, caio, thales, dantas, guilherme
function criarPersonagem(nome, posicao, lado = "direita") {
  const basePath = `./img/sprites/${nome.toLowerCase()}`
  return new Fighter({
    position: posicao,
    velocity: { x: 0, y: 0 },
    imageSrc: `${basePath}Parado.png`,
    framesMax: 1,
    scale: 1.8,
    offset: { x: 0, y: 0 },
    sprites: {
      idle: {
        imageSrc: `${basePath}Parado.png`,
        framesMax: 1,
        framesHold: 25
      },
      run: {
        imageSrc: `${basePath}Andando.png`,
        framesMax: 4,
        framesHold: 8
      },
      attack: {
        imageSrc: `${basePath}Atacando.png`,
        framesMax: 3,
        framesHold: 50
      }
    },
    lado
  })
}

// =================== SISTEMA DE ANIMAÇÃO ===================
function animate() {
  window.requestAnimationFrame(animate)
  c.fillStyle = 'black'
  c.fillRect(0, 0, canvas.width, canvas.height)

  if (background) background.update()
  else {
    c.fillStyle = '#0b1220'
    c.fillRect(0, 0, canvas.width, canvas.height)
  }

  if (player) player.update()
  if (enemy) enemy.update()

  if (!player || !enemy) return

  player.velocity.x = 0
  enemy.velocity.x = 0

  // === PLAYER 1 ===
  if (keys.a.pressed && player.lastKey === 'a') {
    player.velocity.x = -7
    player.setAnimation('run')
  } else if (keys.d.pressed && player.lastKey === 'd') {
    player.velocity.x = 7
    player.setAnimation('run')
  } else {
    player.setAnimation('idle')
  }

  // === PLAYER 2 ===
  if (keys.ArrowLeft.pressed && enemy.lastKey === 'ArrowLeft') {
    enemy.velocity.x = -7
    enemy.setAnimation('run')
  } else if (keys.ArrowRight.pressed && enemy.lastKey === 'ArrowRight') {
    enemy.velocity.x = 7
    enemy.setAnimation('run')
  } else {
    enemy.setAnimation('idle')
  }

  // === COLISÕES ===
  // Só aplica dano se o jogo NÃO tiver acabado
  if (!window.gameOver && rectangularCollision({ rectangle1: player, rectangle2: enemy }) && player.isAttacking) {
    player.isAttacking = false
    enemy.health -= 5
    document.querySelector('#enemyHealth').style.width = enemy.health + '%'
  }

  if (!window.gameOver && rectangularCollision({ rectangle1: player, rectangle2: enemy }) && enemy.isAttacking) {
    enemy.isAttacking = false
    player.health -= 10
    document.querySelector('#playerHealth').style.width = player.health + '%'
  }

  // === CONDIÇÃO DE VITÓRIA ===
  if (enemy.health <= 0 || player.health <= 0) {
    determineWinner({ player, enemy, timerID })
  }
}

// =================== CONTROLE DE TECLAS ===================
const keys = {
  a: { pressed: false },
  d: { pressed: false },
  w: { pressed: false },
  ArrowRight: { pressed: false },
  ArrowLeft: { pressed: false },
  ArrowUp: { pressed: false }
}

window.addEventListener('keydown', (event) => {
  if (!player || !enemy) return

  switch (event.key) {
    case 'd': keys.d.pressed = true; player.lastKey = 'd'; break
    case 'a': keys.a.pressed = true; player.lastKey = 'a'; break
    case 'w': player.velocity.y = -16.85; break
    case ' ': player.attack(); break
    case 'ArrowRight': keys.ArrowRight.pressed = true; enemy.lastKey = 'ArrowRight'; break
    case 'ArrowLeft': keys.ArrowLeft.pressed = true; enemy.lastKey = 'ArrowLeft'; break
    case 'ArrowUp': enemy.velocity.y = -16.85; break
    case 'ArrowDown': enemy.attack(); break
  }
})

window.addEventListener('keyup', (event) => {
  switch (event.key) {
    case 'd': keys.d.pressed = false; break
    case 'a': keys.a.pressed = false; break
    case 'ArrowRight': keys.ArrowRight.pressed = false; break
    case 'ArrowLeft': keys.ArrowLeft.pressed = false; break
  }
})

// =================== INICIAR O JOGO ===================
window.startGame = async function () {
  if (window.__gameStarted) return
  window.__gameStarted = true

  // garantir que o estado de fim de jogo seja reiniciado
  window.gameOver = false

  const menu = document.getElementById('mainMenu')
  if (menu) menu.style.display = 'none'

  const sel = window.characterSelection || {}
  const nomeP1 = (sel.nameP1 || 'leonardo').toLowerCase()
  const nomeP2 = (sel.nameP2 || 'caio').toLowerCase()

  const bgSrc = await findBackgroundSource()
  background = bgSrc
    ? new Sprite({ position: { x: 0, y: 0 }, imageSrc: bgSrc })
    : {
        drawFallback: function () {
          c.fillStyle = '#0b1220'
          c.fillRect(0, 0, canvas.width, canvas.height)
          c.fillStyle = '#fff'
          c.font = 'bold 24px Arial'
          c.fillText('TEC FIGHTERS', 400, 280)
        },
        update: function () { this.drawFallback() }
      }

  // Player 1 começa bem mais à esquerda olhando para esquerda
  player = criarPersonagem(nomeP1, { x: canvas.width * 0.1, y: 0 }, "esquerda")
  // Player 2 começa um pouco mais à esquerda (ajustado) olhando para direita
  enemy = criarPersonagem(nomeP2, { x: canvas.width * 0.50, y: 0 }, "direita")

  if (typeof decreaseTimer === 'function') decreaseTimer()
  animate()
}

import { ACTION_LABELS, keyLabel, PAD_ACTION_LABELS } from './settings.js'

const $ = id => document.getElementById(id)
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const modalScreens = new Set(['pause', 'result', 'controls', 'settings', 'credits', 'terms', 'error', 'intermission', 'campaignResult', 'records'])
const terms = [
  ['1. Aceitação dos Termos', 'Ao jogar Tec Fighters, você concorda com estes termos de uso.'],
  ['2. Uso do Jogo', 'Este jogo é fornecido para entretenimento pessoal. É proibido usar o jogo para fins comerciais sem autorização.'],
  ['3. Propriedade Intelectual', 'Todos os direitos de Tec Fighters pertencem aos seus criadores. É proibida a reprodução não autorizada.'],
  ['4. Conduta do Jogador', 'Os jogadores devem manter um comportamento respeitoso e seguir as regras estabelecidas.'],
  ['5. Modificações', 'Estes termos podem ser modificados a qualquer momento. Continuando a usar o jogo, você aceita as mudanças.'],
  ['6. Limitação de Responsabilidade', 'O jogo é fornecido "como está" sem garantias de qualquer tipo.']
]

/** DOM presentation only. Combat and timers are owned by the game, never by the UI. */
export class UI {
  constructor({ characters, settings, onAction }) {
    this.characters = characters
    this.settings = settings
    this.onAction = onAction
    this.screen = 'menu'
    this.baseScreen = 'menu'
    this.modalBack = 'menu'
    this.selected = [characters[0].id, characters[6]?.id || characters[1].id]
    this.confirmed = [false, false]
    this.activePlayer = 0
    this.mode = 'versus'
    this.difficulty = 'normal'
    this.binding = null
    this.lastCombat = null
    this.toastTimer = null
    this.dom = {
      hud: $('gameHUD'), overlay: $('panelOverlay'), panel: $('panel'), body: $('panelBody'),
      announcement: $('announcement'), timer: $('timer'), round: $('roundLabel'), score: $('roundScore'),
      players: [1, 2].map(n => ({ name: $(`p${n}Name`), health: $(`p${n}Health`), healthTrack: $(`p${n}HealthTrack`), energy: $(`p${n}Energy`), energyTrack: $(`p${n}EnergyTrack`), energyLabel: $(`p${n}EnergyLabel`), special: $(`p${n}SpecialName`), combo: $(`p${n}Combo`) }))
    }
    this.handleClick = this.handleClick.bind(this)
    this.handleKey = this.handleKey.bind(this)
    this.handleSetting = this.handleSetting.bind(this)
    document.addEventListener('click', this.handleClick)
    document.addEventListener('keydown', this.handleKey, true)
    document.addEventListener('input', this.handleSetting)
    this.unsubscribe = settings.subscribe(() => this.syncSettings())
    this.renderSelection()
    this.show('menu')
  }

  dispatch(action, payload) { this.onAction?.(action, payload) }

  show(screen) {
    clearTimeout(this.promotionTimer)
    this.cancelBinding()
    this.cancelPadBinding()
    this.screen = screen
    if (!modalScreens.has(screen)) this.baseScreen = screen
    document.body.dataset.screen = screen
    document.querySelectorAll('.screen[data-screen]').forEach(element => { element.hidden = element.dataset.screen !== this.baseScreen })
    this.dom.hud.hidden = this.baseScreen !== 'game'
    this.dom.overlay.hidden = !modalScreens.has(screen)
    if (screen === 'select') this.renderSelection()
    if (modalScreens.has(screen)) this.renderPanel(screen)
    if (screen !== 'game') requestAnimationFrame(() => {
      const container = modalScreens.has(screen) ? this.dom.panel : document.querySelector(`.screen[data-screen="${screen}"]`)
      container?.querySelector('button:not(:disabled), a[href]')?.focus({ preventScroll: true })
    })
  }

  openModal(screen) {
    if (!modalScreens.has(this.screen) || this.screen === 'pause') this.modalBack = this.screen === 'pause' ? 'pause' : this.baseScreen
    this.show(screen)
  }

  closeModal() {
    if (this.screen === 'records' && this.recordResultHTML) {
      const html = this.recordResultHTML; this.show(this.recordBack); this.dom.body.innerHTML = html; this.recordResultHTML = null; return
    }
    if (this.screen === 'pause') { this.dispatch('resume'); return }
    if (['result', 'intermission', 'campaignResult'].includes(this.screen)) return
    this.show(this.modalBack)
  }

  handleClick(event) {
    const padButton = event.target.closest('[data-pad-bind-player]')
    if (padButton) {
      this.cancelPadBinding()
      this.padBinding = { player: Number(padButton.dataset.padBindPlayer), action: padButton.dataset.padBindAction, button: padButton }
      padButton.classList.add('listening'); padButton.textContent = 'BOTÃO…'
      $('padBindingNotice').textContent = 'Pressione um botão do controle atribuído a este jogador. Esc cancela.'
      this.dispatch('capture-pad', { player: this.padBinding.player, action: this.padBinding.action })
      return
    }
    const bindingButton = event.target.closest('[data-bind-player]')
    if (bindingButton) {
      this.cancelBinding()
      this.binding = { player: Number(bindingButton.dataset.bindPlayer), action: bindingButton.dataset.bindAction, button: bindingButton }
      bindingButton.classList.add('listening')
      bindingButton.textContent = 'TECLA…'
      $('bindingNotice').textContent = 'Pressione a nova tecla. Esc cancela.'
      return
    }
    const characterButton = event.target.closest('[data-character]')
    if (characterButton && this.screen === 'select') {
      this.selected[this.activePlayer] = characterButton.dataset.character
      this.confirmed[this.activePlayer] = false
      this.renderSelection()
      this.dispatch('navigate')
      return
    }
    const button = event.target.closest('[data-action]')
    if (!button || button.disabled) return
    event.preventDefault()
    const action = button.dataset.action
    this.dispatch('navigate')
    if (['settings', 'controls', 'credits', 'terms'].includes(action)) { this.openModal(action); return }
    if (action === 'play') { this.show('modes'); return }
    if (action === 'choose-mode') {
      const difficulty = $('difficulty').value
      this.setMode(button.dataset.mode, difficulty)
      this.dispatch('choose-mode', { mode: this.mode, difficulty })
      return
    }
    if (action === 'close') { this.closeModal(); return }
    if (action === 'confirm') {
      const index = Number(button.dataset.player)
      this.confirmed[index] = true
      this.activePlayer = this.mode === 'versus' && !this.confirmed[1 - index] ? 1 - index : index
      this.renderSelection()
      return
    }
    if (action === 'edit-player') {
      this.activePlayer = Number(button.dataset.player)
      this.confirmed[this.activePlayer] = false
      this.renderSelection()
      return
    }
    if (action === 'reset-pad-bindings') { this.settings.resetPadBindings(); this.renderPanel('settings'); return }
    if (action === 'reset-bindings') { this.settings.resetBindings(); this.renderPanel('settings'); return }
    if (action === 'reset-settings') { this.settings.reset(); this.renderPanel('settings'); this.toast('Configurações padrão restauradas.'); return }
    if (action === 'windowed') {
      if (document.fullscreenElement) this.dispatch('fullscreen')
      else this.toast('O jogo já está no modo janela.')
      return
    }
    if (action === 'select') {
      this.confirmed = [false, false]
      this.activePlayer = 0
    }
    if (action === 'start') {
      if (this.confirmed[0] && (this.mode !== 'versus' || this.confirmed[1])) this.dispatch('start', { ids: [...this.selected], mode: this.mode, difficulty: this.difficulty })
      return
    }
    this.dispatch(action)
  }

  handleSetting(event) {
    const assignment = event.target.closest('[data-pad-slot]')
    if (assignment) { this.settings.setPadPlayer(Number(assignment.dataset.padSlot), Number(assignment.value)); return }
    const input = event.target.closest('[data-setting]')
    if (!input) return
    const key = input.dataset.setting
    const value = input.type === 'checkbox' ? input.checked : input.type === 'range' || key === 'renderScale' ? Number(input.value) : input.value
    this.settings.set(key, value)
  }

  handleKey(event) {
    if (this.padBinding && event.code === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); this.cancelPadBinding(); return }
    if (this.binding) {
      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.repeat) return
      if (event.code === 'Escape') { this.cancelBinding(); return }
      const { player, action } = this.binding
      const result = this.settings.bind(player, action, event.code)
      this.cancelBinding()
      $('bindingNotice').textContent = result.ok ? 'Comando atualizado. Preferências salvas automaticamente.' : result.error
      return
    }
    if (event.code === 'Escape' && modalScreens.has(this.screen) && !['pause', 'result', 'intermission', 'campaignResult'].includes(this.screen)) {
      event.preventDefault(); event.stopImmediatePropagation(); this.closeModal(); return
    }
    if (this.screen === 'game') return
    const scope = modalScreens.has(this.screen) ? this.dom.panel : document.querySelector(`.screen[data-screen="${this.screen}"]`)
    if (!scope) return
    if (event.code === 'Tab' && modalScreens.has(this.screen)) {
      const focusables = [...scope.querySelectorAll('button:not(:disabled),input,select,a[href]')].filter(el => el.getClientRects().length)
      if (!focusables.length) return
      if (event.shiftKey && document.activeElement === focusables[0]) { event.preventDefault(); focusables.at(-1).focus() }
      else if (!event.shiftKey && document.activeElement === focusables.at(-1)) { event.preventDefault(); focusables[0].focus() }
    }
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) return
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return
    const currentCard = event.target.closest('[data-character]')
    let buttons = [...scope.querySelectorAll(currentCard ? '[data-character]' : 'button:not(:disabled),a[href]')].filter(el => el.getClientRects().length)
    if (!buttons.length) return
    event.preventDefault()
    const step = event.code === 'ArrowUp' ? currentCard ? -4 : -1 : event.code === 'ArrowDown' ? currentCard ? 4 : 1 : event.code === 'ArrowLeft' ? -1 : 1
    const index = buttons.indexOf(document.activeElement)
    buttons[(index + step + buttons.length) % buttons.length]?.focus()
  }

  setMode(mode = 'versus', difficulty = 'normal') {
    this.mode = ['versus', 'single', 'arcade', 'infinite'].includes(mode) ? mode : 'versus'
    this.difficulty = difficulty
    this.confirmed = [false, false]
    this.activePlayer = 0
    this.renderSelection()
  }

  renderSelection() {
    const activeElement = document.activeElement
    const focusCharacter = activeElement?.dataset.character
    for (let index = 0; index < 2; index++) {
      const character = this.characters.find(c => c.id === this.selected[index])
      const root = $(`selectionP${index + 1}`)
      root.classList.toggle('active', this.activePlayer === index)
      if (index === 1 && this.mode !== 'versus') {
        root.innerHTML = `<div class="player-slot-heading"><span>MÁQUINA / IA</span></div><div class="cpu-emblem">CPU</div><h3>${this.mode === 'arcade' ? 'TODO O ELENCO' : this.mode === 'infinite' ? 'SEM LIMITES' : 'RIVAL AUTOMÁTICO'}</h3><p class="fighter-description">${this.mode === 'infinite' ? 'Vida e energia preservadas entre adversários. Sem recuperação.' : this.mode === 'arcade' ? 'Adversários únicos. Vida e especial reiniciados entre confrontos.' : 'Um adversário diferente do seu personagem será escolhido automaticamente.'}</p><p class="special-name">IA: ${{ easy: 'FÁCIL', normal: 'NORMAL', hard: 'DIFÍCIL' }[this.difficulty]}</p>`
        continue
      }
      root.innerHTML = `<div class="player-slot-heading"><span>PLAYER ${index + 1} / ${this.confirmed[index] ? 'PRONTO' : 'ESCOLHENDO'}</span><button data-action="edit-player" data-player="${index}" aria-label="Editar jogador ${index + 1}">EDITAR</button></div>
        <img class="selection-portrait" src="${escapeHTML(character.portrait)}" alt="${escapeHTML(character.name)}">
        <h3>${escapeHTML(character.name).toUpperCase()}</h3><p class="fighter-description">${escapeHTML(character.description)}</p>
        <div class="fighter-stats"><span>VIDA <b>${character.stats.health}</b></span><span>VELOCIDADE <b>${character.stats.speed}</b></span><span>DANO <b>${Math.round(character.stats.damage * 100)}%</b></span><span>ALCANCE <b>${Math.round(character.stats.reach * 100)}%</b></span></div>
        <div class="special-name">✦ ${escapeHTML(character.special.name)}</div><button class="confirm-button ${this.confirmed[index] ? 'confirmed' : ''}" data-action="confirm" data-player="${index}" ${this.confirmed[index] ? 'disabled' : ''}>${this.confirmed[index] ? '✓ CONFIRMADO' : `CONFIRMAR PLAYER ${index + 1}`}</button>`
    }
    $('roster').innerHTML = this.characters.map(character => `<button class="character-card ${this.selected[0] === character.id ? 'selected-p1' : ''} ${this.mode === 'versus' && this.selected[1] === character.id ? 'selected-p2' : ''}" data-character="${escapeHTML(character.id)}" aria-label="Selecionar ${escapeHTML(character.name)} para jogador ${this.activePlayer + 1}" aria-pressed="${this.selected[this.activePlayer] === character.id}">${this.selected[0] === character.id ? '<b class="selection-badge">P1</b>' : ''}${this.mode === 'versus' && this.selected[1] === character.id ? '<b class="selection-badge p2">P2</b>' : ''}<img src="${escapeHTML(character.portrait)}" alt=""><span>${escapeHTML(character.name).toUpperCase()}</span></button>`).join('')
    const bothReady = this.confirmed[0] && (this.mode !== 'versus' || this.confirmed[1])
    $('startFight').disabled = !bothReady
    $('selectionInstruction').textContent = bothReady ? (this.mode === 'versus' ? 'Os dois lutadores estão prontos. Que comece a rivalidade.' : 'Seu lutador está pronto. A máquina aguarda na arena.') : `Jogador ${this.activePlayer + 1}, escolha e confirme seu personagem.`
    $('selectionStatus').innerHTML = this.mode !== 'versus' ? `${this.mode.toUpperCase()} · ${this.confirmed[0] ? 'LUTADOR PRONTO ✓' : 'ESCOLHA SEU LUTADOR'}` : `P1 ${this.confirmed[0] ? 'PRONTO ✓' : 'ESCOLHENDO'} <i>→</i> P2 ${this.confirmed[1] ? 'PRONTO ✓' : 'ESCOLHENDO'}`
    if (focusCharacter) $('roster').querySelector(`[data-character="${focusCharacter}"]`)?.focus({ preventScroll: true })
  }

  renderPanel(screen) {
    const body = this.dom.body
    this.dom.panel.querySelector('[data-action="close"]').hidden = ['result', 'intermission', 'campaignResult'].includes(screen)
    if (screen === 'pause') body.innerHTML = `<p class="eyebrow">DÊ UM RESPIRO.</p><h2 id="panelTitle">COMBATE <em>PAUSADO.</em></h2><p>Seu próximo movimento merece um segundo.</p><div class="panel-stack"><button class="primary-button" data-action="resume">CONTINUAR <span>→</span></button><button class="secondary-button" data-action="settings">CONFIGURAÇÕES</button><button class="secondary-button" data-action="controls">CONTROLES</button><button class="secondary-button" data-action="select">SELEÇÃO DE PERSONAGENS</button><button class="secondary-button" data-action="menu">VOLTAR AO MENU</button></div><div class="panel-footer"><small>ESC ou P para continuar · A partida também pausa ao perder o foco.</small></div>`
    if (screen === 'result') {
      const combat = this.lastCombat
      const winner = combat?.winner
      const name = winner === null || winner === undefined ? 'EMPATE' : combat.fighters[winner].char.name.toUpperCase()
      body.innerHTML = `<span class="result-badge">${winner === null ? 'DRAW / EMPATE' : 'VICTORY!'}</span><h2 id="panelTitle" class="result-title">${escapeHTML(name)}</h2><p>${winner === null ? 'Uma rivalidade à altura. O próximo round decide.' : `Jogador ${winner + 1} venceu a partida. A rua já tem um nome.`}</p><p class="result-score">${combat?.wins?.[0] ?? 0} — ${combat?.wins?.[1] ?? 0}</p><div class="panel-stack"><button class="primary-button" data-action="rematch">REVANCHE <span>↻</span></button><button class="secondary-button" data-action="select">ESCOLHER PERSONAGENS</button><button class="secondary-button" data-action="menu">VOLTAR AO MENU</button></div>`
    }
    if (screen === 'controls') {
      body.innerHTML = `<h2 id="panelTitle">CADA TECLA.<br><em>UM MOVIMENTO.</em></h2><p>Dois jogadores no mesmo teclado. Cada comando tem sua própria tecla.</p><div class="controls-columns">${this.settings.values.bindings.map((bindings, index) => `<div><h3>PLAYER ${index + 1}</h3>${Object.entries(ACTION_LABELS).map(([action, label]) => `<div class="control-row"><span>${label}</span><kbd>${escapeHTML(keyLabel(bindings[action]))}</kbd></div>`).join('')}</div>`).join('')}</div><p class="control-tip">COMBO: leve → leve → pesado. Cancele a recuperação de um acerto com outro golpe. Com a energia cheia, finalize com seu especial. No ar, ataques pesados lançam o rival.</p><p class="control-tip">Defenda no momento do impacto para aparar e abrir um contra-ataque. Esquive para escapar da pressão. ESC ou P pausa a partida.</p><p class="control-tip">CONTROLES FÍSICOS: conecte até dois gamepads. Direcional/analógico move · A pula · X leve · Y pesado · B esquiva · LB defende · RB especial.</p><div class="panel-footer"><button class="secondary-button" data-action="settings">REMAPEAR CONTROLES</button><button class="secondary-button" data-action="close">VOLTAR</button></div>`
    }
    if (screen === 'settings') this.renderSettings()
    if (screen === 'credits') body.innerHTML = `<h2 id="panelTitle">FEITO PELA<br><em>NOSSA GALERA.</em></h2><p>TEC-FIGHTERS 2 preserva os personagens, os sprites e o cenário do jogo original.</p><div class="credits-grid"><div><strong>DESENVOLVIMENTO ORIGINAL</strong><p>Equipe Tec Fighters</p></div><div><strong>DESIGN ORIGINAL</strong><p>Design Team</p></div><div><strong>PROGRAMAÇÃO ORIGINAL</strong><p>Development Team</p></div><div><strong>ELENCO ORIGINAL</strong><p>Leo · Vini · Rodolfo · Eduardo<br>Gui · Dantas · Caio · Thales</p></div></div><p>Músicas fornecidas pelo usuário: MenuTF, Storymode e TecFightersInfinito. Efeitos sonoros sintetizados em tempo real. Vitória e derrota possuem spritesheets próprias em pixel art SVG para cada personagem. As demais poses adicionais usam animação procedural sobre a arte original; o catálogo permite integrar novas spritesheets.</p><div class="panel-footer"><small>© 2024 Tec Fighters. Todos os direitos reservados.</small><button class="secondary-button" data-action="close">VOLTAR</button></div>`
    if (screen === 'terms') body.innerHTML = `<h2 id="panelTitle">TERMOS <em>DE USO.</em></h2><div class="terms-copy">${terms.map(([title, text]) => `<p><strong>${title}</strong><br>${text}</p>`).join('')}</div><div class="panel-footer"><button class="secondary-button" data-action="close">VOLTAR</button></div>`
    this.dom.panel.scrollTop = 0
  }

  renderSettings() {
    const values = this.settings.values
    const slider = (key, label) => `<label class="setting-row">${label}<span><input aria-label="${label}" type="range" min="0" max="1" step="0.05" data-setting="${key}" value="${values[key]}"><output class="setting-value" data-output="${key}">${Math.round(values[key] * 100)}%</output></span></label>`
    const checkbox = (key, label) => `<label class="setting-row">${label}<input type="checkbox" data-setting="${key}" ${values[key] ? 'checked' : ''}></label>`
    this.dom.body.innerHTML = `<h2 id="panelTitle">DO SEU <em>JEITO.</em></h2><p>As preferências são salvas automaticamente neste navegador.</p>
      <div class="setting-group"><h3>ÁUDIO</h3>${slider('masterVolume', 'Volume geral')}${slider('musicVolume', 'Música')}${slider('sfxVolume', 'Efeitos sonoros')}${checkbox('muted', 'Silenciar tudo')}</div>
      <div class="setting-group"><h3>VÍDEO & EFEITOS</h3><label class="setting-row">Escala de renderização<select data-setting="renderScale" aria-label="Escala de renderização">${[0.5, 0.75, 1, 1.5].map(scale => `<option value="${scale}" ${values.renderScale === scale ? 'selected' : ''}>${scale * 100}%${scale === 1 ? ' · padrão' : ''}</option>`).join('')}</select></label><label class="setting-row">Qualidade dos efeitos<select data-setting="effectsQuality" aria-label="Qualidade dos efeitos"><option value="high" ${values.effectsQuality === 'high' ? 'selected' : ''}>Alta</option><option value="low" ${values.effectsQuality === 'low' ? 'selected' : ''}>Baixa</option></select></label>${checkbox('particles', 'Partículas')}${checkbox('shake', 'Tremor de câmera')}${checkbox('showFPS', 'Exibir FPS')}${checkbox('extraEffects', 'Efeitos visuais adicionais')}<div class="panel-footer"><button class="secondary-button" data-action="fullscreen">TELA CHEIA</button><button class="secondary-button" data-action="windowed">MODO JANELA</button></div></div>
      <div class="setting-group"><h3>CONTROLES</h3><small>Clique na tecla para alterar. Cada tecla só pode ter um comando.</small><div class="bindings">${values.bindings.map((bindings, player) => `<div><h3>PLAYER ${player + 1}</h3>${Object.entries(ACTION_LABELS).map(([action, label]) => `<div class="binding-row"><span>${label}</span><button class="key-button" data-bind-player="${player}" data-bind-action="${action}" aria-label="Alterar ${label} do jogador ${player + 1}">${escapeHTML(keyLabel(bindings[action]))}</button></div>`).join('')}</div>`).join('')}</div><p id="bindingNotice" class="binding-notice" role="status"></p><button class="secondary-button" data-action="reset-bindings">RESTAURAR CONTROLES</button></div>
      <div class="setting-group"><h3>CONTROLES FÍSICOS</h3><div id="padDevices"></div><div class="bindings">${(values.padBindings || []).map((bindings, player) => `<div><h3>PLAYER ${player + 1}</h3>${Object.entries(PAD_ACTION_LABELS).map(([action, label]) => `<div class="binding-row"><span>${label}</span><button class="key-button" data-pad-bind-player="${player}" data-pad-bind-action="${action}" aria-label="Alterar botão ${label} do jogador ${player + 1}">BOTÃO ${bindings[action]}</button></div>`).join('')}</div>`).join('')}</div><p id="padBindingNotice" class="binding-notice" role="status"></p><button class="secondary-button" data-action="reset-pad-bindings">RESTAURAR BOTÕES DO CONTROLE</button></div>
      <div class="panel-footer"><button class="secondary-button" data-action="reset-settings">RESTAURAR TUDO</button><button class="primary-button" data-action="close">PRONTO <span>✓</span></button></div>`
    this.renderPadDevices()
  }

  syncSettings() {
    const values = this.settings.values
    $('fps').hidden = !values.showFPS
    if (this.screen !== 'settings') return
    this.renderPadDevices()
    this.dom.body.querySelectorAll('[data-pad-bind-player]').forEach(button => { if (this.padBinding?.button !== button) button.textContent = `BOTÃO ${values.padBindings?.[Number(button.dataset.padBindPlayer)]?.[button.dataset.padBindAction] ?? '—'}` })
    this.dom.body.querySelectorAll('[data-setting]').forEach(input => {
      const value = values[input.dataset.setting]
      if (input.type === 'checkbox') input.checked = value
      else input.value = String(value)
    })
    this.dom.body.querySelectorAll('[data-output]').forEach(output => { output.textContent = `${Math.round(values[output.dataset.output] * 100)}%` })
    this.dom.body.querySelectorAll('[data-bind-player]').forEach(button => {
      if (this.binding?.button === button) return
      button.textContent = keyLabel(values.bindings[Number(button.dataset.bindPlayer)][button.dataset.bindAction])
    })
  }

  cancelBinding() {
    if (!this.binding) return
    const { player, action, button } = this.binding
    button.textContent = keyLabel(this.settings.values.bindings[player][action])
    button.classList.remove('listening')
    this.binding = null
  }

  update(combat, session) {
    this.lastCombat = combat
    this.updateCampaign(session, combat)
    combat.fighters.forEach((fighter, index) => {
      const elements = this.dom.players[index]
      const health = Math.max(0, Math.min(100, fighter.health / fighter.maxHealth * 100))
      const energy = Math.max(0, Math.min(100, fighter.energy))
      elements.name.textContent = fighter.char.name.toUpperCase()
      elements.health.style.transform = `scaleX(${health / 100})`
      elements.healthTrack.setAttribute('aria-valuenow', String(Math.round(health)))
      elements.energy.style.transform = `scaleX(${energy / 100})`
      elements.energyTrack.setAttribute('aria-valuenow', String(Math.round(energy)))
      elements.energyTrack.classList.toggle('ready', energy >= 100)
      elements.energyLabel.textContent = energy >= 100 ? 'ESPECIAL PRONTO ✦' : `${Math.floor(energy)}%`
      elements.special.textContent = fighter.char.special.name.toUpperCase()
      const count = fighter.combo?.count || 0
      elements.combo.hidden = count < 2
      if (count >= 2) {
        elements.combo.querySelector('strong').textContent = count
        elements.combo.querySelector('small').textContent = `${Math.round(fighter.combo.damage || 0)} DANO`
      }
    })
    this.dom.timer.textContent = String(Math.max(0, Math.ceil(combat.timeLeft))).padStart(2, '0')
    this.dom.round.textContent = `ROUND ${combat.round}`
    const score = `${[0, 1].map(index => `${'●'.repeat(Math.min(combat.roundsToWin || 2, combat.wins[index]))}${'○'.repeat(Math.max(0, (combat.roundsToWin || 2) - combat.wins[index]))}`).join(' <i>VS</i> ')}`
    if (this.dom.score.innerHTML !== score) this.dom.score.innerHTML = score
    let announcement = ''
    if (combat.phase === 'intro') announcement = `ROUND ${combat.round}<small>PREPARE-SE.</small>`
    if (combat.phase === 'fight' && combat.timeLeft > 59.3) announcement = 'FIGHT!'
    if (combat.phase === 'roundOver') announcement = `${combat.roundWinner !== null && combat.phaseTime > .7 ? 'VICTORY!' : combat.fighters.some(fighter => fighter.health <= 0) ? 'K.O.' : 'TEMPO!'}<small>${combat.roundWinner === null ? 'EMPATE' : `${escapeHTML(combat.fighters[combat.roundWinner]?.char.name || '')} VENCEU O ROUND`}</small>`
    if (combat.phase === 'matchOver' && this.screen !== 'result') announcement = 'VICTORY!'
    if (this.dom.announcement.innerHTML !== announcement) this.dom.announcement.innerHTML = announcement
  }

  result(combat, session, recordResult) {
    this.lastCombat = combat
    if (session && ['arcade', 'infinite'].includes(session.mode)) this.showCampaignResult(session.summary ? session.summary() : session, recordResult)
    else this.show('result')
  }
  characterName(value) {
    const id = typeof value === 'object' ? value?.id : value
    return this.characters.find(character => character.id === id)?.name || String(id || '')
  }

  updateCampaign(session, combat) {
    const root = $('campaignHUD')
    if (!root) return
    const summary = session?.summary ? session.summary() : session
    if ($('modeHUDLabel')) $('modeHUDLabel').textContent = ({ versus: 'LOCAL VERSUS', single: 'SINGLE PLAYER', arcade: 'ARCADE MODE', infinite: 'INFINITE MODE' })[summary?.mode] || 'LOCAL VERSUS'
    root.hidden = !summary || summary.mode === 'versus'
    if (root.hidden) return
    const rank = summary.rank
    const text = summary.mode === 'arcade'
      ? `<b>ARCADE MODE — LUTA ${summary.battle}/${summary.total}</b><span>${escapeHTML(combat.fighters[0].char.name)} VS ${escapeHTML(combat.fighters[1].char.name)} · ${summary.remaining ?? Math.max(0, summary.total - summary.battle)} restantes</span>`
      : summary.mode === 'infinite'
        ? `<img src="${escapeHTML(rank?.badge || './assets/badges/bronze.svg')}" alt=""><div><b>INFINITE · ${summary.wins} VITÓRIAS · ${escapeHTML(rank?.name || 'BRONZE')}</b><span>${summary.untilNext === null || rank?.id === 'legend' ? 'CLASSIFICAÇÃO MÁXIMA' : `${summary.untilNext} vitórias para ${escapeHTML(summary.nextRank?.name || 'a próxima classificação')}`} · ${Math.round(summary.score || 0).toLocaleString('pt-BR')} PTS</span></div>`
        : `<b>SINGLE PLAYER</b><span>${escapeHTML(combat.fighters[0].char.name)} VS CPU ${escapeHTML(combat.fighters[1].char.name)}</span>`
    if (root.innerHTML !== text) root.innerHTML = text
  }

  showIntermission(summary, promotion) {
    this.show('intermission')
    const rank = promotion || summary.rank
    const promoted = !!promotion
    this.dom.body.innerHTML = `<div class="campaign-result ${promoted ? 'promotion' : ''}">${rank && summary.mode === 'infinite' ? `<img class="rank-badge" src="${escapeHTML(rank.badge)}" alt="Emblema ${escapeHTML(rank.name)}">` : '<span class="result-badge">VICTORY!</span>'}<p class="eyebrow">${promoted ? 'CLASSIFICAÇÃO AUMENTADA!' : 'ADVERSÁRIO DERROTADO'}</p><h2 id="panelTitle">${promoted ? escapeHTML(rank.name) : `${summary.wins} ${summary.wins === 1 ? 'VITÓRIA' : 'VITÓRIAS'}`}</h2><p>${promoted ? `${summary.wins} VITÓRIAS!` : summary.mode === 'arcade' ? `${summary.total - summary.wins} adversários até conquistar a arena.` : 'Sua vida e energia continuam exatamente de onde pararam.'}</p><p class="campaign-score">${Math.round(summary.score || 0).toLocaleString('pt-BR')} PONTOS</p><div class="panel-stack"><button class="primary-button" id="nextBattle" data-action="next-battle">PRÓXIMO ADVERSÁRIO <span>→</span></button><button class="secondary-button" data-action="menu">VOLTAR AO MENU</button></div></div>`
    if (promoted) {
      const button = $('nextBattle')
      button.disabled = true
      clearTimeout(this.promotionTimer)
      this.promotionTimer = setTimeout(() => { if (button.isConnected) { button.disabled = false; button.focus({ preventScroll: true }) } }, 1800)
    }
    this.dom.panel.scrollTop = 0
  }

  showCampaignResult(summary, recordResult) {
    this.show('campaignResult')
    const infinite = summary.mode === 'infinite'
    const rank = summary.rank
    const best = recordResult?.best
    this.dom.body.innerHTML = `<div class="campaign-result">${infinite && rank ? `<img class="rank-badge" src="${escapeHTML(rank.badge)}" alt="Emblema ${escapeHTML(rank.name)}">` : '<span class="result-badge">ARCADE MODE</span>'}<p class="eyebrow">${recordResult?.newRecord ? 'NOVO RECORDE PESSOAL!' : 'TEC-FIGHTERS 2'}</p><h2 id="panelTitle">${infinite ? 'GAME OVER' : summary.complete ? 'ARCADE <em>COMPLETED!</em>' : 'FIM DA CAMPANHA'}</h2><p>VOCÊ DERROTOU ${summary.wins} ${summary.wins === 1 ? 'ADVERSÁRIO' : 'ADVERSÁRIOS'}!</p>${infinite ? `<p class="rank-name">CLASSIFICAÇÃO: ${escapeHTML(rank?.name)}</p>` : ''}<p class="campaign-score">PONTUAÇÃO FINAL: <b>${Math.round(summary.score || 0).toLocaleString('pt-BR')}</b></p><div class="campaign-stats"><span>PERSONAGEM <b>${escapeHTML(this.characterName(summary.character))}</b></span><span>MAIOR COMBO <b>${summary.maxCombo || 0} HITS</b></span><span>TEMPO TOTAL <b>${this.duration(summary.elapsed)}</b></span>${infinite ? `<span>RECORDE PESSOAL <b>${best?.wins ?? summary.wins} VITÓRIAS</b></span>` : `<span>ADVERSÁRIOS <b>${summary.wins}/${summary.total}</b></span>`}</div><div class="panel-stack"><button class="primary-button" data-action="rematch">${infinite ? 'TENTAR NOVAMENTE' : 'JOGAR NOVAMENTE'} <span>→</span></button>${infinite ? '<button class="secondary-button" data-action="records">VER RECORDES LOCAIS</button>' : ''}<button class="secondary-button" data-action="menu">VOLTAR AO MENU</button></div></div>`
    this.dom.panel.scrollTop = 0
  }

  duration(seconds) {
    const total = Math.max(0, Math.floor(seconds || 0))
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
  }

  showRecords(data) {
    this.modalBack = ['campaignResult', 'result'].includes(this.screen) ? this.screen : this.baseScreen
    this.recordBack = this.modalBack
    this.recordResultHTML = ['campaignResult', 'result'].includes(this.screen) ? this.dom.body.innerHTML : null
    this.show('records')
    const history = data?.history || []
    const best = data?.best
    const date = value => {
      const parsed = new Date(value)
      return Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString('pt-BR') : '—'
    }
    this.dom.body.innerHTML = `<p class="eyebrow">INFINITE MODE / NESTE NAVEGADOR</p><h2 id="panelTitle">SEUS <em>RECORDES.</em></h2>${history.length && best ? `<div class="record-best"><b>${best.wins} VITÓRIAS</b><span>${Math.round(best.score || 0).toLocaleString('pt-BR')} PONTOS · ${escapeHTML(best.rank?.name || best.rank || '')}</span></div>` : '<p>Nenhuma tentativa concluída. Entre no Infinito e deixe sua marca.</p>'}<div class="records-list">${history.map((entry, index) => `<article><span class="record-index">${String(index + 1).padStart(2, '0')}</span><div><strong>${entry.wins} VITÓRIAS · ${escapeHTML(entry.rank?.name || entry.rank || '')}</strong><span>${escapeHTML(this.characterName(entry.character))} · ${date(entry.date)}</span></div><b>${Math.round(entry.score || 0).toLocaleString('pt-BR')}<small> PTS</small></b></article>`).join('')}</div><div class="panel-footer"><button class="primary-button" data-action="close">VOLTAR <span>←</span></button></div>`
  }

  navigatePad(action, player = 0) {
    if (this.screen === 'game') return
    if (action === 'back') {
      if (this.padBinding) { this.cancelPadBinding(); return }
      if (modalScreens.has(this.screen)) this.closeModal()
      else if (this.screen === 'select') this.show('modes')
      else if (this.screen === 'modes') this.dispatch('menu')
      return
    }
    const scope = modalScreens.has(this.screen) ? this.dom.panel : document.querySelector(`.screen[data-screen="${this.screen}"]`)
    if (!scope) return
    if (action === 'confirm') {
      const focused = document.activeElement
      if (!scope.contains(focused)) { scope.querySelector('button:not(:disabled),select,input')?.focus(); return }
      if (focused.tagName === 'SELECT') return
      if (focused.type === 'checkbox') { focused.checked = !focused.checked; focused.dispatchEvent(new Event('input', { bubbles: true })); return }
      focused.click()
      return
    }
    const current = document.activeElement
    if (['left', 'right'].includes(action) && current?.tagName === 'SELECT') {
      current.selectedIndex = Math.max(0, Math.min(current.options.length - 1, current.selectedIndex + (action === 'left' ? -1 : 1)))
      current.dispatchEvent(new Event('input', { bubbles: true })); current.dispatchEvent(new Event('change', { bubbles: true })); return
    }
    if (['left', 'right'].includes(action) && current?.type === 'range') {
      action === 'left' ? current.stepDown() : current.stepUp()
      current.dispatchEvent(new Event('input', { bubbles: true })); return
    }
    const nodes = [...scope.querySelectorAll('button:not(:disabled),select,input,a[href]')].filter(node => node.getClientRects().length)
    const index = nodes.indexOf(current)
    const direction = ['left', 'up'].includes(action) ? -1 : 1
    nodes[(index + direction + nodes.length) % nodes.length]?.focus({ preventScroll: false })
    this.dispatch('navigate')
  }

  setDevices(devices) {
    this.devices = devices || []
    if (this.screen === 'settings' && $('padDevices')) this.renderPadDevices()
  }

  renderPadDevices() {
    const root = $('padDevices')
    if (!root) return
    root.innerHTML = this.devices?.length ? this.devices.map(device => `<label class="setting-row"><span class="device-name">${escapeHTML(device.id)}<small>${device.mapping === 'standard' ? 'MAPEAMENTO PADRÃO' : 'MAPEAMENTO PERSONALIZÁVEL'}</small></span><select data-pad-slot="${device.slot}" aria-label="Jogador do controle ${device.slot + 1}"><option value="0" ${device.player === 0 ? 'selected' : ''}>PLAYER 1</option><option value="1" ${device.player === 1 ? 'selected' : ''}>PLAYER 2</option></select></label>`).join('') : '<p class="control-tip">Nenhum controle detectado. Conecte e pressione um botão. O navegador reconhece controles Xbox, PlayStation e dispositivos compatíveis com a Gamepad API.</p>'
  }

  padBindingResult(result) {
    if (!this.padBinding) return
    const { button } = this.padBinding
    button.classList.remove('listening')
    this.padBinding = null
    this.syncSettings()
    if ($('padBindingNotice')) $('padBindingNotice').textContent = result?.ok ? 'Botão atualizado. Preferências salvas.' : result?.error || 'Não foi possível alterar o botão.'
  }

  cancelPadBinding() {
    if (!this.padBinding) return
    this.padBinding.button.classList.remove('listening')
    this.padBinding = null
    this.dispatch('cancel-pad-capture')
    this.syncSettings()
  }

  setFPS(fps) { $('fps').textContent = `${Math.round(fps)} FPS`; $('fps').hidden = !this.settings.values.showFPS }
  toast(message) { clearTimeout(this.toastTimer); $('toast').textContent = message; $('toast').hidden = false; this.toastTimer = setTimeout(() => { $('toast').hidden = true }, 3200) }
  error(message) { this.show('error'); this.dom.body.innerHTML = `<h2 id="panelTitle">ALGO <em>FALHOU.</em></h2><p class="error-message">${escapeHTML(message)}</p><div class="panel-footer"><button class="secondary-button" data-action="menu">VOLTAR AO MENU</button></div>` }
  destroy() { document.removeEventListener('click', this.handleClick); document.removeEventListener('keydown', this.handleKey, true); document.removeEventListener('input', this.handleSetting); this.unsubscribe?.(); clearTimeout(this.toastTimer); clearTimeout(this.promotionTimer) }
}

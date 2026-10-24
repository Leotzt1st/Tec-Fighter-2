# TEC-FIGHTERS 2

Jogo de luta 2D para **um ou dois jogadores**, em HTML5 Canvas, CSS e JavaScript
modular. Preserva Leo, Vini, Rodolfo, Eduardo, Gui, Dantas, Caio e Thales, os retratos,
o cenário e os sprites originais. Sem biblioteca de jogo, cadastro ou servidor externo.

## Executar

Requer Python 3 para servir arquivos estáticos. Na pasta do projeto:

```sh
python3 -m http.server 8080
```

Abra `http://localhost:8080` no navegador. Também é possível usar `npm start`.
Sirva por HTTP: abrir `index.html` via `file://` bloqueia módulos em alguns navegadores.
Não há dependências de produção, compilação ou instalação de pacotes.

## Controles padrão

| Ação | Jogador 1 | Jogador 2 |
| --- | --- | --- |
| Movimento | A / D | ← / → |
| Pulo | W | ↑ |
| Leve | Espaço | ↓ |
| Pesado | F | Num 1 |
| Especial | G | Num 2 |
| Defesa | S | Num 0 |
| Esquiva | Q | Num 3 |

**P / Esc** pausa; **F10** alterna tela cheia. Todas as teclas de combate podem ser
remapeadas nas configurações, inclusive para teclados sem numérico. A interface
aponta conflitos e impede combinações duplicadas/reservadas. Se o teclado não
registrar várias teclas simultâneas (ghosting), altere o mapeamento ou use gamepads.

Controles físicos compatíveis com o mapeamento padrão da Gamepad API: direcional
ou analógico move; A/Cruz pula, X/Quadrado ataca leve, Y/Triângulo pesado, B/Círculo esquiva;
LB/L1 defende, RB/R1 executa o especial; Start/Options pausa. Até dois controles conectados são mapeados
por ordem de conexão, com atribuição de jogador configurável. Conecte e pressione um botão para o navegador reconhecê-los.

## Modos de jogo (v2.1)

Em **JOGAR**, escolha um modo e a dificuldade (Fácil, Normal ou Difícil), depois
selecione seu personagem. Nos modos solo, a máquina escolhe um rival diferente.

- **VERSUS:** dois jogadores locais, melhor de três rounds, como na versão anterior.
- **SINGLE PLAYER:** jogador 1 contra a IA, melhor de três. Revanche sorteia um novo rival.
- **ARCADE:** sete confrontos (calculados como elenco menos seu personagem), um round
  por rival, sem repetições. A dificuldade aumenta; vida e energia reiniciam entre
  confrontos. Uma derrota encerra a campanha. A conclusão mostra tempo ativo,
  pontuação, personagem e total derrotado.
- **INFINITE:** um round por rival, sem fim predefinido. **Vida e energia restantes
  passam exatamente ao confronto seguinte**, sem restauração. Empates por tempo
  repetem o confronto preservando os valores dos dois lutadores. O saco de rivais
  contém os outros sete personagens e só é renovado após todos aparecerem.

A IA observa distância e ações visíveis, aproxima/recua, usa ataques, combos,
defesa, esquiva, contra-ataques e especiais pelos mesmos comandos e regras dos
humanos. Reação inicial: Fácil 320 ms, Normal 180 ms, Difícil 90 ms, com margem
aleatória e erros. A progressão aumenta estratégias até o limite do Difícil;
não altera atributos, dano, vida ou energia. O teclado/gamepad do jogador 2 não
controla a máquina nos modos solo.

### Classificação e recordes do Infinito

| Vitórias consecutivas da tentativa | Classificação |
| --- | --- |
| 0–4 | Bronze |
| 5–9 | Prata |
| 10–19 | Ouro |
| 20–29 | Diamante |
| 30+ | Lenda TEC-FIGHTERS |

Cinco emblemas SVG próprios aparecem na HUD, promoção e resultados. Promoções
reservam 1,8 s para animação e som antes de habilitar a próxima luta. A classificação
depende apenas de vitórias da tentativa atual. Pontos combinam dano, tamanho de
combos, especiais acertados, vitórias, tempo restante e vida final; não compram
vida nem influenciam o rank.

O resultado mostra maior combo, tempo, pontuação, rank e novo recorde. **RECORDES
LOCAIS**, na seleção de modos ou no Game Over, compara as 20 melhores tentativas,
ordenadas por sequência e pontuação, com personagem e data. Maior sequência,
classificação e pontuação são preservadas no `localStorage`, mesmo que o recorde
de pontos venha de outra tentativa. Os dados são locais a este navegador, sem
ranking online, sincronização de contas ou proteção contra edição pelo usuário.

### Controles físicos e menus

A Gamepad API atende dispositivos Xbox, PlayStation, USB e Bluetooth **quando
reconhecidos pelo navegador**. O jogo detecta conexão/desconexão e pausa ao perder
um controle durante a luta. Botões segurados ao reconectar ou confirmar menus não
se convertem em ataques acidentais. Direcional/analógico navega, A confirma e B volta.

Em CONFIGURAÇÕES → CONTROLES FÍSICOS, atribua cada controle ao jogador 1 ou 2 e
remapeie os botões (incluindo pausa). Assim é possível usar teclado no P1 e um único
gamepad no P2, ou dois gamepads. A configuração é persistente; conflitos no mesmo
controle são recusados. Dispositivos sem mapeamento padrão podem exigir ajuste
manual; não há garantia para drivers que o navegador não expõe.

## Combate

- Melhor de três rounds, 60 segundos cada. Empates repetem o round sem pontuação.
- Leves rápidos, pesados com alcance maior, ataques aéreos, defesa e esquiva com
  recarga. Uma defesa nos primeiros 100 ms desvia o golpe e abre um contra-ataque.
- Antecipação, frames ativos e recuperação separados: um golpe simples só acerta
  uma vez; a sequência especial de Eduardo possui três janelas intencionais.
- Buffer de 200 ms; leves conectados cancelam em leve/pesado/especial. Pesados
  aéreos permitem voltar ao leve, e pesados conectados podem finalizar no especial.
- Dano diminui a cada acerto; seis impactos seguidos acionam escape com breve
  invulnerabilidade. Recuo, hitstop e atordoamento têm duração limitada.
- Energia independente (0–100), ganha ao acertar/receber/defender golpes. Especial
  exige e consome 100. Cada personagem tem atributos próximos e um especial próprio:

| Personagem | Especial | Comportamento |
| --- | --- | --- |
| Leo | Rastro elétrico | Avanço rápido |
| Vini | Ascensão violeta | Golpe ascendente e lançamento |
| Rodolfo | Onda sísmica | Impacto de médio alcance |
| Eduardo | Sequência esmeralda | Rajada de até três impactos |
| Gui | Passo fantasma | Avanço evasivo |
| Dantas | Corte de energia | Maior alcance frontal |
| Caio | Ciclone rubro | Giro com levantamento |
| Thales | Martelo solar | Antecipação longa e impacto forte |

Os especiais usam hitboxes de alcance frontal, **não projéteis independentes**.
Os valores de balanceamento estão em `js/characters.js`, `js/combos.js` e
`js/specials.js`; são uma base ajustável, não uma alegação de balanceamento competitivo.

## Animações e apresentação

Vitória e derrota agora utilizam 16 spritesheets SVG próprias, com seis frames
por animação e gestos distintos para cada personagem. As folhas mantêm roupas,
cabelos, cores e objetos do elenco, em novos desenhos de pixel art vetorial.
A queda termina no chão e mantém o último frame; a câmera destaca o vencedor e
as opções aparecem após 2,6 segundos, sem repetir a queda na transição.

Máquina de estados: repouso, caminhada, salto, queda, pouso, leve, pesado, defesa,
dano, esquiva, especial, nocaute, vitória e derrota. Respiração, antecipação e
reações usam transformações ancoradas nos pés. O frame de contato acompanha a
janela ativa do golpe. Os oito especiais possuem efeitos/movimentos distintos,
partículas, rastros, breve escurecimento e aproximação de câmera limitada.

**Arte:** salto, pouso, defesa, dano, esquiva e ataques adicionais continuam com
derivações procedurais dos sprites originais. Vitória e derrota possuem arte própria. O contrato está em
[`assets/characters/README.md`](assets/characters/README.md). Para substituir uma
pose, registre sua spritesheet em `SPRITE_OVERRIDES` em `js/animations.js`;
não é necessário reescrever o combate. Música e efeitos são composições/síntese
originais em Web Audio, sem arquivos externos. Áudio inicia após interação do usuário.

## Configurações e tela

Volumes geral/música/efeitos, silenciar, escala de renderização, qualidade de
partículas, partículas, tremor, efeitos adicionais, FPS e remapeamento são salvos
no `localStorage` e aplicados na sessão. Restaurar preferências e teclas tem efeito
imediato. Se o armazenamento estiver bloqueado, as opções funcionam até fechar a aba.

Canvas acompanha a janela com proporção preservada e arena lógica de 1280×720;
faixas em proporções diferentes preservam os lutadores e as hitboxes. Telas estreitas
permitem navegar pelos menus, mas a luta requer teclado ou gamepad: não há controles
de toque. A Fullscreen API depende do navegador e de interação do usuário.

Pausar congela cronômetro, combate e efeitos. Perder foco limpa teclas e pausa.
Revanche recria apenas o estado da partida, sem recarregar a página nem duplicar
listeners/loops. Uma única atualização de combate de 60 Hz independe da frequência
do monitor; limite de passos impede espirais após travamentos longos.

## Organização

- `js/main.js`: inicialização e integração.
- `js/game.js`: ciclo de vida, pausa e loop com passo fixo.
- `js/combat.js`, `player.js`, `collision.js`, `combos.js`, `specials.js`: simulação.
- `js/characters.js`: elenco, atributos, caminhos e especiais.
- `js/ai.js`, `modes.js`, `records.js`: decisões da CPU, campanhas, rank e histórico.
- `js/animations.js`, `assets.js`, `renderer.js`, `camera.js`: arte e apresentação.
- `js/input.js`, `audio.js`, `settings.js`, `ui.js`: controles, áudio, preferências e telas.
- `css/`: estilos responsivos; `img/` e `seleçãoPersonagem/`: arte original.
- `tests/`: regressões da simulação, preferências, recursos e navegador.

Os antigos scripts globais `index.js`, `js/classes.js` e `js/utilidades.js` foram
substituídos pelos módulos acima para remover inicializações concorrentes,
eventos duplicados e lógica dependente de frames. Menus, créditos, termos e a
seleção dos dois jogadores continuam disponíveis.

## Testes

Requer Node.js 20+ para os testes sem dependências:

```sh
npm test
```

O teste de navegador requer Playwright disponível no ambiente e Chromium:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run test:browser
```

O teste também aceita Chromium do sistema em `/usr/bin/chromium`; veja a seleção
do executável no arquivo. Ele sobe seu próprio servidor estático temporário.
Nenhum pacote é necessário para jogar. O relatório de validação está em
[`VALIDATION.md`](VALIDATION.md), com limites e resultados efetivamente executados.

## Créditos e termos

Personagens, imagens e jogo original: Equipe Tec Fighters; design: Design Team;
programação: Development Team. Mantidos os créditos e termos originais na interface.
As melhorias de código e síntese sonora fazem parte desta versão do projeto.

# Validação da versão TEC-FIGHTERS 2

Executada no ambiente de desenvolvimento com Node.js 24.19.0 e Chromium
154.0.8037.57 (Playwright, navegador real em modo headless).

## Resultado

- `npm test`: **57 testes aprovados**, nenhum ignorado ou reprovado.
- `npm run test:browser`: **21 fluxos aprovados** (12 regressões e 9 dos novos modos).
- `node --check` nos módulos JavaScript: aprovado.
- `git diff --check`: aprovado.

## Cobertura da simulação

Os testes verificam oito identidades/especiais distintos; janelas ativas e um
acerto por golpe; dano nos dois sentidos; alcance e separação vertical; energia
independente e consumo; execução/recuperação de todos os especiais; defesa,
aparo e contra-ataque; esquiva e recarga; buffer durante hitstop; combos naturais
de cinco golpes; leve → leve → pesado → especial para todo o elenco; redução
de dano/escape no sexto impacto; chão, limites, separação e direção; KO, rounds,
empates, timeout, revanche e passo fixo independente da renderização.

Animações: poses finitas para todos os estados; frame de contato sincronizado;
substituição por spritesheets próprias; câmera sem zoom nas bordas. Recursos:
retratos e tamanho/número de células das folhas originais, incluindo Dantas com
quatro frames de ataque. A imagem de cenário original possui extensão `.png` e
conteúdo JPEG; o navegador a decodifica corretamente e o original foi preservado.

Controles/preferências: comandos simultâneos, tecla repetida sem golpe duplicado,
limpeza no blur/ocultação/pausa, campos de UI sem captura de comandos, dead zone e
mapeamento de dois gamepads simulados, Start pausa/retoma, desconexão e remoção de
listeners. Persistência, volumes limitados, JSON corrompido, conflitos/reservas e
armazenamento indisponível também são exercitados.

## Fluxos executados no Chromium

1. Carregar menu e recursos originais.
2. Entrar/sair da tela cheia por clique real.
3. Atacar com Espaço: um dano por golpe e ganho de energia nos dois jogadores.
4. Mover os dois jogadores, pular simultaneamente e aterrissar no chão correto.
5. Defender com Num 0 e bloquear um ataque leve do teclado.
6. Rejeitar especial sem energia; consumir a barra completa e acertar com G.
7. Pausar o cronômetro, retomar e limpar teclas ao perder foco.
8. Finalizar partida por KO em melhor de três e reiniciar por revanche.
9. Selecionar Dantas/Vini independentemente e iniciar com os personagens corretos.
10. Alterar resolução de renderização, detectar conflito, remapear e persistir após reload.
11. Verificar largura dos menus/seleção em viewport móvel 390×844, além do desktop 1440×900.
12. Verificar ausência de exceções JavaScript e falhas HTTP de recursos durante os fluxos.

O teste posiciona os lutadores e prepara vida/energia/placar em alguns cenários
para atingir a condição testada rapidamente; golpes, defesa, seleção, pausa e
revanche continuam passando pelos comandos reais. Não equivale a uma campanha
inteira de partidas humanas sem preparação.

## Novos modos v2.1

Testes unitários adicionais exercitam a IA em confrontos reais contra um jogador
passivo nas três dificuldades, tempos de reação e ausência de alteração de
atributos; campanhas Arcade completas; dois ciclos de adversários no Infinito;
classificações nas marcas exatas, pontuação e persistência/limite do histórico.
O ciclo de vida integrado comprova que o Infinito não regenera vida/energia,
inclusive em empate por tempo, que o Arcade reinicia os recursos e que uma
promoção não pode ser ignorada antes de 1,8 s. Vitória/derrota param no último frame,
sem reiniciar a queda no resultado. Os testes anteriores de combate continuam ativos.

Os nove novos fluxos Chromium verificam:

1. Single Player com CPU que se movimenta e ignora comandos humanos do jogador 2.
2. Combate bloqueado durante encerramento e resultados após a apresentação de 2,6 s.
3. Arcade completo com sete adversários distintos, excluindo o personagem escolhido.
4. Recuperação de 35% da vida máxima e transferência de 81 de energia após vitória no Infinito.
5. Promoções para Prata, Ouro, Diamante e Lenda com os emblemas correspondentes.
6. Game Over e histórico (personagem, combo, pontos, vitórias e rank) após reload.
7. Navegação de menus por gamepad, teclado P1 + gamepad P2 e pausa na desconexão.
8. Remapeamento de botão pela UI seguido do golpe solicitado durante combate.
9. Ausência de exceções JavaScript e recursos ausentes nesses fluxos.

Os cenários de progresso de campanha usam resultados preparados para acelerar
sete adversários e atingir 30 vitórias. A primeira sequência de encerramento é
cronometrada em tempo real; não se afirma que 30 partidas humanas foram jogadas.
O reconhecimento de controles nos testes utiliza `navigator.getGamepads` simulado,
sem validar drivers, transmissão Bluetooth ou hardware físico.

## Limites conhecidos

- Vitória e derrota utilizam **16 spritesheets SVG próprias**, com seis frames
  cada e reprodução finita. As demais poses adicionais continuam com derivações
  procedurais; o contrato está em `assets/characters/README.md`.
- Testado no Chromium; Safari/Firefox e dispositivos físicos ainda precisam de
  teste manual. Gamepads foram validados pela API simulada, sem controle físico.
- A responsividade dos menus foi validada; não há comandos de luta por toque.
- Balanceamento precisa de partidas humanas. Não se promete 60 FPS em todo
  computador: o loop é de passo fixo e os efeitos/resolução são configuráveis.
- Sem dependências externas para jogar; Web Audio produz música e efeitos após
  uma interação do usuário. Playwright/Chromium são requisitos somente de teste.
- Alterações locais: nenhum push ao GitHub ou publicação foi realizado.

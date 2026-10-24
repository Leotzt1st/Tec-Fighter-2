# Arte e contrato das animações

A arte original permanece em `img/sprites/`: células de **450 × 550**, pés na base,
transparência e orientação para a esquerda. Idle, caminhada e ataques preservam
as folhas originais. Dantas possui quatro frames de ataque; os demais, três.

## Novas spritesheets de encerramento

Cada pasta de personagem contém duas folhas SVG próprias com **seis células**:

- `victory.svg`: saudação do Leo, espada e escudo erguidos do Vini, apontar do
  Rodolfo, cruzar de armas do Eduardo, bola erguida do Gui, controle do Dantas,
  flexão do Caio e reverência do Thales.
- `defeat.svg`: queda progressiva e pose final no chão, com direção, braços,
  dobra dos joelhos e equipamento ajustados por personagem.

São desenhos novos de pixel art vetorial, uma interpretação consistente das
roupas, cabelos, cores e objetos dos personagens originais. Não são imagens
originais rotacionadas em tempo de execução nem dependem de serviço externo.
A transparência é nativa do SVG. As células mantêm proporções e origem nos pés.
As animações terminam e seguram o último frame; `ko` e `defeat` compartilham o
mesmo recurso carregado em cache para evitar download/decodificação duplicados.

A fonte dos desenhos é [`scripts/build-end-sprites.mjs`](../../scripts/build-end-sprites.mjs).
Para regenerar exatamente as folhas distribuídas, execute na raiz:

```sh
node scripts/build-end-sprites.mjs
```

Os SVGs já estão incluídos. A execução do jogo não requer gerar ou compilar arte.
`ENDING_DURATION` em `js/animations.js` documenta a apresentação mínima de 2,4 s;
o combate reserva 2,6 s antes de mostrar resultados.

## Outros estados e substituição de arte

Salto, queda, pouso, defesa, dano, esquiva, pesado e especial continuam usando
as poses originais com derivações procedurais. Cada especial mantém movimento e
efeito próprios. O frame do ataque acompanha a janela ativa da hitbox.

Para substituir qualquer estado, registre uma entrada em `SPRITE_OVERRIDES`
em `js/animations.js` (as folhas de encerramento já estão registradas):

```js
leo: {
  victory: { src: './assets/characters/leo/victory.svg', frames: 6, fps: 3, loop: false },
  special: { src: './assets/characters/leo/special.png', frames: 8, fps: 14, loop: false }
}
```

Use células de 450×550, origem nos pés, orientação para a esquerda e transparência.
O loader pré-carrega as substituições; o renderizador seleciona o recurso pelo
estado sem alterar as regras do combate. Arquivos PNG ou SVG são aceitos.

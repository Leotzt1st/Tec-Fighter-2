# Contrato das animações

A arte original fica em `img/sprites/`: células de **450 × 550**, alinhadas pelos pés,
com transparência e olhando para a esquerda. São preservadas as roupas, cores e
proporções dos oito personagens. Dantas possui quatro frames de ataque; os demais,
três. Não é necessário duplicar as imagens em outra pasta.

`js/animations.js` documenta todas as poses. Idle, caminhada e ataque usam as folhas
originais. Salto, queda, aterrissagem, defesa, dano, esquiva, pesado, especial,
nocaute e vitória são **poses derivadas / placeholders procedurais**, não novos
frames desenhados. Cada especial tem movimento e efeito próprios no combate e no
renderizador. O ataque seleciona antecipação/contato/recuperação conforme a hitbox.

Para integrar arte definitiva sem alterar o combate, adicione uma entrada em
`SPRITE_OVERRIDES` em `js/animations.js`, por exemplo:

```js
leo: {
  victory: { src: './assets/characters/leo/victory.png', frames: 6, fps: 10 },
  special: { src: './assets/characters/leo/special.png', frames: 8, fps: 14 }
}
```

Use as mesmas células, origem nos pés e orientação; preserve alpha PNG.
`Assets.load` pré-carrega as substituições, e o renderizador as utiliza por estado.
Nenhum serviço externo ou ferramenta de geração de imagens é necessário para jogar.

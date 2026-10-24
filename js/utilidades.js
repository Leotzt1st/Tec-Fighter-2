function rectangularCollision({rectangle1, rectangle2}){ //função que verifica se dois retângulos estão colidindo
    return(
        rectangle1.attackbox.position.x + rectangle1.attackbox.width >=rectangle2.position.x && 
        rectangle1.attackbox.position.x <= rectangle2.position.x + rectangle2.width &&
        rectangle1.attackbox.position.y + rectangle1.attackbox.height >= rectangle2.position.y &&
        rectangle1.attackbox.position.y <= rectangle2.position.y + rectangle2.height
    )
}

function determineWinner({player, enemy, timerID}){
    // marca jogo finalizado para impedir dano adicional
    window.gameOver = true
    clearTimeout(timerID) //cancela o timer
    document.querySelector('#displayText').style.display = 'flex' //exibe o texto de vitória
    if (player.health === enemy.health){ 
        document.querySelector('#displayText').innerHTML = 'Empate'
    }  else if (player.health > enemy.health){
        document.querySelector('#displayText').innerHTML = 'Jogador 1 Venceu'
    } else if (enemy.health > player.health){
        document.querySelector('#displayText').innerHTML = 'Jogador 2 Venceu'
    } 
}

let timer = 60
let timerID
function decreaseTimer(){
    if(timer > 0){
        timerID = setTimeout(decreaseTimer, 1000)
        timer--
        document.querySelector('#timer').innerHTML = timer
    }

    if (timer === 0){
        document.querySelector('#displayText').style.display = 'flex'
        determineWinner({player, enemy, timerID})
    } 
}

// ===== Seleção de Personagem JS =====
window.characterSelection = {
    selectedP1: null,
    selectedP2: null,
    p1Confirmed: false,
    p2Confirmed: false,
    nameP1: '',
    nameP2: '',
    imgP1: '',
    imgP2: ''
};

function setupCharacterSelection() {
    const overlay = document.getElementById('characterSelect');
    if (!overlay) return;

    const chars = overlay.querySelectorAll('.char');
    const imgP1 = document.getElementById('imgP1');
    const imgP2 = document.getElementById('imgP2');
    const nameP1 = document.getElementById('nameP1');
    const nameP2 = document.getElementById('nameP2');
    const confirmP1 = document.getElementById('confirmP1');
    const confirmP2 = document.getElementById('confirmP2');
    const instruction = document.getElementById('instruction');
    const footer = document.getElementById('footer');
    const startGameBtn = document.getElementById('startGameBtn');

    let selectedP1 = null;
    let selectedP2 = null;
    let p1Confirmed = false;
    let p2Confirmed = false;

    // Mapeamento de personagem para imagem correta (usando pasta seleçãoPersonagem)
    const personagemImgs = {
        'Leo': './seleçãoPersonagem/Leo.png',
        'Vini': './seleçãoPersonagem/Vini.png',
        'Rodolfo': './seleçãoPersonagem/Rodolfo.png',
        'Eduardo': './seleçãoPersonagem/Edu.png',
        'Gui': './seleçãoPersonagem/Gui.png',
        'Dantas': './seleçãoPersonagem/Dantas.png',
        'Caio': './seleçãoPersonagem/Caio.png',
        'Thales': './seleçãoPersonagem/Thales.png'
    };

    chars.forEach(char => {
        char.addEventListener('click', () => {
            const imgTag = char.querySelector('img');
            // O alt do <img> é o nome do personagem
            const imgAlt = imgTag.alt;
            // Usa o caminho correto da pasta seleçãoPersonagem
            const imgSrc = personagemImgs[imgAlt] || imgTag.src;

            if (!p1Confirmed && !p2Confirmed) {
                // PLAYER 1 escolhendo
                if (selectedP1) selectedP1.classList.remove('selected-1p');
                char.classList.add('selected-1p');
                imgP1.src = imgSrc;
                imgP1.alt = imgAlt;
                nameP1.textContent = imgAlt;
                selectedP1 = char;
                confirmP1.disabled = false;
                instruction.textContent = "Clique em Confirmar o PLAYER 1";
            } 
            else if (p1Confirmed && !p2Confirmed) {
                // PLAYER 2 escolhendo
                if (selectedP2) selectedP2.classList.remove('selected-2p');
                char.classList.add('selected-2p');
                imgP2.src = imgSrc;
                imgP2.alt = imgAlt;
                nameP2.textContent = imgAlt;
                selectedP2 = char;
                confirmP2.disabled = false;
                instruction.textContent = "Clique em Confirmar o PLAYER 2";
            }
        });
    });

    confirmP1.addEventListener('click', () => {
        if (selectedP1) {
            p1Confirmed = true;
            selectedP1.classList.add('confirmed');
            confirmP1.disabled = true;
            instruction.textContent = "PLAYER 1 confirmado! Agora escolha o personagem do PLAYER 2.";
        }
    });

    confirmP2.addEventListener('click', () => {
        if (selectedP2 && p1Confirmed) {
            p2Confirmed = true;
            selectedP2.classList.add('confirmed');
            confirmP2.disabled = true;
            instruction.textContent = "Ambos confirmaram! Lutadores prontos!";
            footer.textContent = `🔥 ${nameP1.textContent.toUpperCase()} VS ${nameP2.textContent.toUpperCase()} 🔥`;
            startGameBtn.disabled = false;

            // Salva seleção global para uso no jogo
            window.characterSelection = {
                selectedP1,
                selectedP2,
                p1Confirmed,
                p2Confirmed,
                nameP1: nameP1.textContent,
                nameP2: nameP2.textContent,
                imgP1: imgP1.src,
                imgP2: imgP2.src
            };
        }
    });

    // Botão INICIAR JOGO só funciona após ambos confirmarem
    startGameBtn.addEventListener('click', () => {
        if (p1Confirmed && p2Confirmed) {
            overlay.style.display = 'none';
            if (window.startGame) window.startGame();
        }
    });
}

// Chame a seleção de personagem antes de iniciar o jogo
window.showCharacterSelection = function() {
    const overlay = document.getElementById('characterSelect');
    if (overlay) {
        overlay.style.display = 'flex';
        setupCharacterSelection();
    }
};

// Modifique o menu para chamar seleção de personagem ao invés de startGame direto
window.startGame = function() {
    if (window.__gameStarted) return;
    window.__gameStarted = true;
    // reset gameOver ao iniciar uma nova partida
    window.gameOver = false;
    const menu = document.getElementById('mainMenu');
    if (menu) menu.style.display = 'none';
    if (typeof decreaseTimer === 'function') decreaseTimer();
    if (typeof animate === 'function') animate();
};
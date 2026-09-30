import { Match3Game, UIStateUpdate } from './game';
import { sound } from './audio/sound';

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('game-canvas');
  if (!container) return;

  // DOM Elements
  const uiLevelBadge = document.getElementById('ui-level-badge')!;
  const uiLevelName = document.getElementById('ui-level-name')!;
  const uiMoves = document.getElementById('ui-moves')!;
  const uiScore = document.getElementById('ui-score')!;
  const uiGoals = document.getElementById('ui-goals')!;

  const btnSound = document.getElementById('btn-sound')!;
  const volumeSlider = document.getElementById('volume-slider') as HTMLInputElement;
  const volumeVal = document.getElementById('volume-val')!;

  const btnSkin = document.getElementById('btn-skin')!;
  const btnRestart = document.getElementById('btn-restart')!;
  const btnPrev = document.getElementById('btn-prev-level')!;
  const btnNext = document.getElementById('btn-next-level')!;
  const btnLevels = document.getElementById('btn-levels')!;

  // Modals
  const modalWin = document.getElementById('modal-win')!;
  const modalWinScore = document.getElementById('modal-win-score')!;
  const btnModalReplay = document.getElementById('btn-modal-replay')!;
  const btnModalNext = document.getElementById('btn-modal-next')!;

  const modalLose = document.getElementById('modal-lose')!;
  const modalLoseScore = document.getElementById('modal-lose-score')!;
  const btnModalLoseRetry = document.getElementById('btn-modal-lose-retry')!;

  const modalLevelSelect = document.getElementById('modal-level-select')!;
  const levelSelectGrid = document.getElementById('level-select-grid')!;
  const btnCloseLevelSelect = document.getElementById('btn-close-level-select')!;

  // UI Update Handler
  const handleUIUpdate = (ui: UIStateUpdate) => {
    uiLevelBadge.textContent = `Nivel ${ui.level}`;
    uiLevelName.textContent = `${ui.title} ▾`;
    uiMoves.textContent = ui.movesLeft.toString();
    uiScore.textContent = ui.score.toLocaleString();

    // Moves urgency color
    if (ui.movesLeft <= 3) {
      uiMoves.style.color = '#ef4444';
    } else {
      uiMoves.style.color = 'var(--accent-gold)';
    }

    // Render Goals
    uiGoals.innerHTML = '';
    for (const g of ui.goals) {
      const chip = document.createElement('div');
      chip.className = `goal-chip ${g.completed ? 'completed' : ''}`;
      chip.innerHTML = `
        <span>${g.description}: <strong>${g.current}/${g.target}</strong></span>
        <span class="check-icon">✓</span>
      `;
      uiGoals.appendChild(chip);
    }

    // Volume & Sound state
    if (ui.isMuted) {
      btnSound.textContent = '🔇';
    } else if (ui.volume > 0.5) {
      btnSound.textContent = '🔊';
    } else if (ui.volume > 0) {
      btnSound.textContent = '🔉';
    } else {
      btnSound.textContent = '🔇';
    }

    const currentPercent = Math.round(ui.volume * 100);
    volumeVal.textContent = `${currentPercent}%`;
    if (document.activeElement !== volumeSlider) {
      volumeSlider.value = currentPercent.toString();
    }

    // Skin state: default emotes show 🎭, click toggles to 💎
    btnSkin.textContent = ui.skinMode === 'emotes' ? '🎭' : '💎';
    btnSkin.title = ui.skinMode === 'emotes' ? 'Apariencia: Emotes (Click para Joyas)' : 'Apariencia: Joyas (Click para Emotes)';

    // Modals
    if (ui.state === 'LevelComplete') {
      modalWinScore.textContent = ui.score.toLocaleString();
      modalWin.classList.add('active');
    } else {
      modalWin.classList.remove('active');
    }

    if (ui.state === 'LevelFailed') {
      modalLoseScore.textContent = ui.score.toLocaleString();
      modalLose.classList.add('active');
    } else {
      modalLose.classList.remove('active');
    }
  };

  // Initialize Game
  const game = new Match3Game(container, handleUIUpdate);

  // User gesture to begin orchestral fantasy BGM
  const onFirstInteraction = () => {
    sound.userGesture();
    window.removeEventListener('pointerdown', onFirstInteraction);
  };
  window.addEventListener('pointerdown', onFirstInteraction);

  // Event Listeners
  btnSound.addEventListener('click', (e) => {
    e.stopPropagation();
    game.toggleMute();
  });

  volumeSlider.addEventListener('input', (e) => {
    e.stopPropagation();
    const val = Number((e.target as HTMLInputElement).value) / 100;
    if (sound.isMuted) {
      sound.setMuted(false);
    }
    game.setVolume(val);
  });

  btnSkin.addEventListener('click', (e) => {
    e.stopPropagation();
    game.toggleSkin();
  });

  btnRestart.addEventListener('click', (e) => {
    e.stopPropagation();
    game.restartLevel();
  });

  btnPrev.addEventListener('click', (e) => {
    e.stopPropagation();
    game.prevLevel();
  });

  btnNext.addEventListener('click', (e) => {
    e.stopPropagation();
    game.nextLevel();
  });

  // Modal actions
  btnModalReplay.addEventListener('click', () => {
    modalWin.classList.remove('active');
    game.restartLevel();
  });
  btnModalNext.addEventListener('click', () => {
    modalWin.classList.remove('active');
    game.nextLevel();
  });
  btnModalLoseRetry.addEventListener('click', () => {
    modalLose.classList.remove('active');
    game.restartLevel();
  });

  // Level selector modal
  const openLevelSelect = () => {
    levelSelectGrid.innerHTML = '';
    const totalButtons = 25; // 20 curated + 5 infinite
    for (let i = 1; i <= totalButtons; i++) {
      const btn = document.createElement('button');
      btn.className = `level-btn ${i === game.currentLevel ? 'active' : ''}`;
      btn.textContent = i.toString();
      btn.addEventListener('click', () => {
        modalLevelSelect.classList.remove('active');
        game.initLevel(i);
      });
      levelSelectGrid.appendChild(btn);
    }
    modalLevelSelect.classList.add('active');
  };

  btnLevels.addEventListener('click', openLevelSelect);
  btnCloseLevelSelect.addEventListener('click', () => {
    modalLevelSelect.classList.remove('active');
  });
});

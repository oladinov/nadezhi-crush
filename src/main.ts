import { Match3Game, UIStateUpdate } from './game';

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('game-canvas');
  if (!container) return;

  // DOM Elements
  const uiLevelBadge = document.getElementById('ui-level-badge')!;
  const uiLevelName = document.getElementById('ui-level-name')!;
  const uiMoves = document.getElementById('ui-moves')!;
  const uiScore = document.getElementById('ui-score')!;
  const uiGoals = document.getElementById('ui-goals')!;
  const uiTutorial = document.getElementById('ui-tutorial')!;
  const uiTutorialText = document.getElementById('ui-tutorial-text')!;
  const uiTutorialClose = document.getElementById('ui-tutorial-close')!;

  const btnSound = document.getElementById('btn-sound')!;
  const btnSkin = document.getElementById('btn-skin')!;
  const btnRestart = document.getElementById('btn-restart')!;
  const btnPrev = document.getElementById('btn-prev-level')!;
  const btnNext = document.getElementById('btn-next-level')!;
  const btnHelp = document.getElementById('btn-help')!;
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

  let currentLevelShown = -1;

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

    // Buttons state
    btnSound.textContent = ui.soundEnabled ? '🔊' : '🔇';
    btnSkin.textContent = ui.skinMode === 'jewels' ? '💎' : '🎭';

    // Show tutorial on level load
    if (currentLevelShown !== ui.level) {
      currentLevelShown = ui.level;
      if (ui.description) {
        uiTutorialText.textContent = ui.description;
        uiTutorial.style.display = 'flex';
      } else {
        uiTutorial.style.display = 'none';
      }
    }

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

  // Event Listeners
  btnSound.addEventListener('click', () => game.toggleSound());
  btnSkin.addEventListener('click', () => game.toggleSkin());
  btnRestart.addEventListener('click', () => game.restartLevel());
  btnPrev.addEventListener('click', () => game.prevLevel());
  btnNext.addEventListener('click', () => game.nextLevel());

  btnHelp.addEventListener('click', () => {
    if (game.core.config.description) {
      uiTutorialText.textContent = game.core.config.description;
      uiTutorial.style.display = 'flex';
    }
  });

  uiTutorialClose.addEventListener('click', () => {
    uiTutorial.style.display = 'none';
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

import { Match3Game, UIStateUpdate } from './game';
import { sound } from './audio/sound';

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('game-canvas');
  if (!container) return;

  // DOM Elements
  const app = document.getElementById('app')!;
  const uiLevelBadge = document.getElementById('ui-level-badge')!;
  const uiLevelName = document.getElementById('ui-level-name')!;
  const uiBiomeName = document.getElementById('ui-biome-name')!;
  const uiMoves = document.getElementById('ui-moves')!;
  const uiScore = document.getElementById('ui-score')!;
  const uiGoals = document.getElementById('ui-goals')!;

  const btnSound = document.getElementById('btn-sound')!;
  const btnMusicToggle = document.getElementById('btn-music-toggle')!;
  const btnMusicNext = document.getElementById('btn-music-next')!;
  const volumeSlider = document.getElementById('volume-slider') as HTMLInputElement;
  const volumeVal = document.getElementById('volume-val')!;

  const btnSkin = document.getElementById('btn-skin')!;
  const btnRestart = document.getElementById('btn-restart')!;
  const btnPrev = document.getElementById('btn-prev-level')!;
  const btnNext = document.getElementById('btn-next-level')!;
  const btnLevels = document.getElementById('btn-levels')!;

  // Toast notification
  const toastBanner = document.getElementById('toast-banner')!;
  const toastIcon = document.getElementById('toast-icon')!;
  const toastText = document.getElementById('toast-text')!;
  let toastTimeout: any = null;
  const showToast = (icon: string, text: string) => {
    if (toastTimeout) clearTimeout(toastTimeout);
    toastIcon.textContent = icon;
    toastText.textContent = text;
    toastBanner.classList.add('active');
    toastTimeout = setTimeout(() => {
      toastBanner.classList.remove('active');
    }, 2800);
  };

  // Modals
  const modalWin = document.getElementById('modal-win')!;
  const modalWinScore = document.getElementById('modal-win-score')!;
  const btnModalReplay = document.getElementById('btn-modal-replay')!;
  const btnModalNext = document.getElementById('btn-modal-next')!;

  const modalLose = document.getElementById('modal-lose')!;
  const modalLoseScore = document.getElementById('modal-lose-score')!;
  const btnModalLoseRetry = document.getElementById('btn-modal-lose-retry')!;

  const modalLevelSelect = document.getElementById('modal-level-select')!;
  const levelSelectContainer = document.getElementById('level-select-container')!;
  const btnCloseLevelSelect = document.getElementById('btn-close-level-select')!;

  const btnHelp = document.getElementById('btn-help')!;
  const modalHelp = document.getElementById('modal-help')!;
  const btnCloseHelp = document.getElementById('btn-close-help')!;

  let lastBiomeImage = '';

  // UI Update Handler
  const handleUIUpdate = (ui: UIStateUpdate) => {
    uiLevelBadge.textContent = `Nivel ${ui.level}`;
    uiLevelName.textContent = `${ui.title} ▾`;
    if (uiBiomeName) {
      uiBiomeName.textContent = `${ui.biome.icon} ${ui.biome.name}`;
    }
    uiMoves.textContent = ui.movesLeft.toString();
    uiScore.textContent = ui.score.toLocaleString();

    // Biome background transition
    if (!app.style.backgroundImage.includes(ui.biome.image)) {
      app.style.backgroundImage = `url("${ui.biome.image}")`;
    }

    if (lastBiomeImage && lastBiomeImage !== ui.biome.image) {
      showToast(ui.biome.icon, `Nueva Región: ${ui.biome.name}`);
    }
    lastBiomeImage = ui.biome.image;

    // Music buttons
    if (btnMusicToggle) {
      if (ui.isBgmMuted) {
        btnMusicToggle.textContent = '🔇';
        btnMusicToggle.classList.add('music-muted');
        btnMusicToggle.title = 'Música silenciada (efectos activos) • Click para activar música';
      } else {
        btnMusicToggle.textContent = '🎵';
        btnMusicToggle.classList.remove('music-muted');
        btnMusicToggle.title = 'Música activa • Click para silenciar solo la música';
      }
    }

    if (btnMusicNext && ui.currentTrack) {
      btnMusicNext.title = `Siguiente Canción (Actual: ${ui.currentTrack.name} • ${ui.currentTrack.artist})`;
    }

    // Moves urgency color
    if (ui.movesLeft <= 3) {
      uiMoves.style.color = '#ef4444';
    } else {
      uiMoves.style.color = 'var(--accent-gold)';
    }

    // Render Goals with thumbnails and emote awareness
    uiGoals.innerHTML = '';
    for (const g of ui.goals) {
      const chip = document.createElement('div');
      chip.className = `goal-chip ${g.completed ? 'completed' : ''}`;
      const iconHtml =
        g.iconType === 'image'
          ? `<img src="${g.icon}" class="goal-chip-thumb" alt="${g.description}" />`
          : `<span class="goal-chip-icon">${g.icon}</span>`;

      chip.innerHTML = `
        ${iconHtml}
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
      const modalWinMoves = document.getElementById('modal-win-moves');
      const modalWinBonusPts = document.getElementById('modal-win-bonus-pts');
      if (modalWinMoves && modalWinBonusPts) {
        modalWinMoves.textContent = ui.movesLeft.toString();
        const bonusTotal = ui.movesLeft * 1000;
        modalWinBonusPts.textContent = `+${bonusTotal.toLocaleString()} pts`;
      }
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

  btnMusicToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const muted = game.toggleBgmMute();
    if (muted) {
      showToast('🔇', 'Música silenciada (efectos de sonido activos)');
    } else {
      showToast('🎵', `Música activada: ${sound.currentTrack.name}`);
    }
  });

  btnMusicNext.addEventListener('click', (e) => {
    e.stopPropagation();
    const track = game.nextMusicTrack();
    showToast('⏭️', `Música: ${track.name} (${track.artist})`);
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

  // Level selector modal with biomes and difficulty grouping
  interface BiomeGroupConfig {
    name: string;
    icon: string;
    difficulty: string;
    diffClass: string;
    levels: number[];
  }

  const BIOME_GROUPS: BiomeGroupConfig[] = [
    {
      name: 'Praderas del Valle',
      icon: '🌿',
      difficulty: 'Fácil',
      diffClass: 'diff-easy',
      levels: [1, 2, 3, 4],
    },
    {
      name: 'Colinas del Atardecer',
      icon: '🌅',
      difficulty: 'Normal',
      diffClass: 'diff-normal',
      levels: [5, 6, 7, 8],
    },
    {
      name: 'Caverna de Cristales',
      icon: '🔮',
      difficulty: 'Desafiante',
      diffClass: 'diff-challenging',
      levels: [9, 10, 11, 12],
    },
    {
      name: 'Bosque de las Luciérnagas',
      icon: '🌲',
      difficulty: 'Difícil',
      diffClass: 'diff-hard',
      levels: [13, 14, 15, 16],
    },
    {
      name: 'Monte del Destino',
      icon: '🌋',
      difficulty: 'Experto',
      diffClass: 'diff-expert',
      levels: [17, 18, 19, 20],
    },
    {
      name: 'Tierras Infinitas',
      icon: '♾️',
      difficulty: 'Procedural',
      diffClass: 'diff-infinite',
      levels: [21, 22, 23, 24, 25],
    },
  ];

  const openLevelSelect = () => {
    levelSelectContainer.innerHTML = '';

    for (const group of BIOME_GROUPS) {
      const card = document.createElement('div');
      card.className = 'biome-group-card';

      const header = document.createElement('div');
      header.className = 'biome-group-header';

      const title = document.createElement('div');
      title.className = 'biome-group-title';
      title.textContent = `${group.icon} ${group.name}`;

      const badge = document.createElement('span');
      badge.className = `biome-group-badge ${group.diffClass}`;
      badge.textContent = group.difficulty;

      header.appendChild(title);
      header.appendChild(badge);
      card.appendChild(header);

      const grid = document.createElement('div');
      grid.className = 'biome-levels-grid';

      for (const lvl of group.levels) {
        const btn = document.createElement('button');
        btn.className = `level-btn ${lvl === game.currentLevel ? 'active' : ''}`;
        btn.textContent = lvl.toString();
        btn.addEventListener('click', () => {
          modalLevelSelect.classList.remove('active');
          game.initLevel(lvl);
        });
        grid.appendChild(btn);
      }

      card.appendChild(grid);
      levelSelectContainer.appendChild(card);
    }

    modalLevelSelect.classList.add('active');

    setTimeout(() => {
      const activeBtn = levelSelectContainer.querySelector('.level-btn.active');
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 50);
  };

  btnLevels.addEventListener('click', openLevelSelect);
  btnCloseLevelSelect.addEventListener('click', () => {
    modalLevelSelect.classList.remove('active');
  });

  btnHelp.addEventListener('click', (e) => {
    e.stopPropagation();
    modalHelp.classList.add('active');
  });
  btnCloseHelp.addEventListener('click', () => {
    modalHelp.classList.remove('active');
  });
});

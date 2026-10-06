import { Match3Game, UIStateUpdate, getLevelBiome } from './game';
import { sound } from './audio/sound';
import {
  saveLevelScore,
  getAllLevelRecords,
  getHallOfFame,
  getPlayerStats,
  getPlayerName,
  setPlayerName,
  SaveScoreResult,
  isHallOfFameEnabled,
} from './core/scores';

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
  const btnLevels = document.getElementById('btn-levels')!;
  const btnLeaderboard = document.getElementById('btn-leaderboard')!;
  const btnSettings = document.getElementById('btn-settings')!;
  const modalSettings = document.getElementById('modal-settings')!;
  const btnCloseSettings = document.getElementById('btn-close-settings')!;
  const btnContinueGame = document.getElementById('btn-continue-game')!;

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
  const modalWinStars = document.getElementById('modal-win-stars');
  const modalWinRecordBadge = document.getElementById('modal-win-record-badge');
  const modalWinCommunity = document.getElementById('modal-win-community');
  const winCommunityTitle = document.getElementById('win-community-title');
  const winCommunityDesc = document.getElementById('win-community-desc');
  const btnModalReplay = document.getElementById('btn-modal-replay')!;
  const btnModalNext = document.getElementById('btn-modal-next')!;

  const modalLose = document.getElementById('modal-lose')!;
  const modalLoseScore = document.getElementById('modal-lose-score')!;
  const btnModalLoseRetry = document.getElementById('btn-modal-lose-retry')!;

  const modalLevelSelect = document.getElementById('modal-level-select')!;
  const levelSelectContainer = document.getElementById('level-select-container')!;
  const btnCloseLevelSelect = document.getElementById('btn-close-level-select')!;

  // Leaderboard modal elements
  const modalLeaderboard = document.getElementById('modal-leaderboard')!;
  const btnCloseLeaderboard = document.getElementById('btn-close-leaderboard')!;
  const btnCloseLeaderboardFooter = document.getElementById('btn-close-leaderboard-footer')!;
  const inputPlayerName = document.getElementById('input-player-name') as HTMLInputElement;
  const btnSavePlayerName = document.getElementById('btn-save-player-name')!;
  const tabBtnHof = document.getElementById('tab-btn-hof')!;
  const tabBtnLevels = document.getElementById('tab-btn-levels')!;
  const tabContentHof = document.getElementById('tab-content-hof')!;
  const tabContentLevels = document.getElementById('tab-content-levels')!;
  const hofListContainer = document.getElementById('hof-list-container')!;
  const levelRecordsContainer = document.getElementById('level-records-container')!;
  const statTotalScore = document.getElementById('stat-total-score')!;
  const statThreeStars = document.getElementById('stat-three-stars')!;
  const statBestScore = document.getElementById('stat-best-score')!;

  const leaderboardModalTitle = document.getElementById('leaderboard-modal-title');
  const leaderboardModalSubtitle = document.getElementById('leaderboard-modal-subtitle');
  const playerProfileBar = document.getElementById('player-profile-bar');
  const leaderboardTabs = document.getElementById('leaderboard-tabs');

  const btnHelp = document.getElementById('btn-help')!;
  const modalHelp = document.getElementById('modal-help')!;
  const btnCloseHelp = document.getElementById('btn-close-help')!;

  let lastBiomeImage = '';
  let levelCompletedProcessed = false;
  let lastCompletedLevel = -1;

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
        btnMusicToggle.textContent = '🔇 Música Silenciada';
        btnMusicToggle.classList.add('music-muted');
        btnMusicToggle.title = 'Música silenciada (efectos activos) • Click para activar música';
      } else {
        btnMusicToggle.textContent = '🎵 Música Activa';
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

    // Render Goals with thumbnails and emote awareness (safe DOM construction)
    uiGoals.replaceChildren();
    for (const g of ui.goals) {
      const chip = document.createElement('div');
      chip.className = `goal-chip ${g.completed ? 'completed' : ''}`;

      if (g.iconType === 'image') {
        const img = document.createElement('img');
        img.src = g.icon;
        img.className = 'goal-chip-thumb';
        img.alt = g.description;
        chip.appendChild(img);
      } else {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'goal-chip-icon';
        iconSpan.textContent = g.icon;
        chip.appendChild(iconSpan);
      }

      const descSpan = document.createElement('span');
      descSpan.textContent = `${g.description}: `;
      const strong = document.createElement('strong');
      strong.textContent = `${g.current}/${g.target}`;
      descSpan.appendChild(strong);
      chip.appendChild(descSpan);

      const checkSpan = document.createElement('span');
      checkSpan.className = 'check-icon';
      checkSpan.textContent = '✓';
      chip.appendChild(checkSpan);

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

    // Skin state: default emotes show 🎭 Emotes, click toggles to 💎 Gemas
    btnSkin.textContent = ui.skinMode === 'emotes' ? '🎭 Emotes' : '💎 Gemas';
    btnSkin.title = ui.skinMode === 'emotes' ? 'Apariencia: Emotes (Click para Joyas)' : 'Apariencia: Joyas (Click para Emotes)';

    // Modals
    const renderWinStarsAndBadges = (res: SaveScoreResult) => {
      if (!modalWinStars) return;
      modalWinStars.replaceChildren();

      for (let i = 1; i <= 3; i++) {
        const starSpan = document.createElement('span');
        starSpan.className = `modal-win-star star-${i} ${i <= res.stars ? 'active' : 'empty'}`;
        starSpan.textContent = i <= res.stars ? '★' : '☆';
        modalWinStars.appendChild(starSpan);
      }

      if (modalWinRecordBadge) {
        if (res.rankInHallOfFame !== null) {
          modalWinRecordBadge.textContent = `👑 ¡Top ${res.rankInHallOfFame} en el Salón de la Fama!`;
          modalWinRecordBadge.style.display = 'inline-block';
        } else if (res.isNewRecord) {
          modalWinRecordBadge.textContent = `🎖️ ¡Nuevo Récord Personal!`;
          modalWinRecordBadge.style.display = 'inline-block';
        } else {
          modalWinRecordBadge.style.display = 'none';
        }
      }
    };

    if (ui.state === 'LevelComplete') {
      modalWinScore.textContent = ui.score.toLocaleString();
      const modalWinMoves = document.getElementById('modal-win-moves');
      const modalWinBonusPts = document.getElementById('modal-win-bonus-pts');
      if (modalWinMoves && modalWinBonusPts) {
        modalWinMoves.textContent = ui.movesLeft.toString();
        const bonusTotal = ui.movesLeft * 1000;
        modalWinBonusPts.textContent = `+${bonusTotal.toLocaleString()} pts`;
      }

      if (!levelCompletedProcessed || lastCompletedLevel !== ui.level) {
        levelCompletedProcessed = true;
        lastCompletedLevel = ui.level;
        const res = saveLevelScore(
          ui.level,
          ui.score,
          ui.targetScore,
          ui.biome.name,
          ui.biome.icon
        );
        renderWinStarsAndBadges(res);

        // Discrete community promo card: only on milestone levels (Level 1, end of biomes, or top ranking)
        if (modalWinCommunity) {
          const isBiomeClimax = ui.level % 4 === 0;
          const isIntroLevel = ui.level === 1;
          const isEpicAchievement = res.rankInHallOfFame !== null && res.rankInHallOfFame <= 5;

          if (isIntroLevel) {
            modalWinCommunity.style.display = 'flex';
            if (winCommunityTitle) winCommunityTitle.textContent = '🎉 ¡Bienvenido a Tierras de Fantasía!';
            if (winCommunityDesc) winCommunityDesc.textContent = '¡Acompaña a Nadezhi en vivo y únete a su comunidad!';
          } else if (isBiomeClimax) {
            modalWinCommunity.style.display = 'flex';
            if (winCommunityTitle) winCommunityTitle.textContent = `🌿 ¡Región superada! (${ui.biome.name})`;
            if (winCommunityDesc) winCommunityDesc.textContent = 'Celebra tu victoria en el stream y servidor de Nadezhi:';
          } else if (isEpicAchievement) {
            modalWinCommunity.style.display = 'flex';
            if (winCommunityTitle) winCommunityTitle.textContent = '👑 ¡Récord Legendario en el Salón de la Fama!';
            if (winCommunityDesc) winCommunityDesc.textContent = '¡Presume tu puntuación con Nadezhi en vivo y Discord!';
          } else {
            modalWinCommunity.style.display = 'none';
          }
        }
      }

      modalWin.classList.add('active');
    } else {
      modalWin.classList.remove('active');
      levelCompletedProcessed = false;
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

  // Trigger layout and resize pass to ensure canvas dimensions are ready on mobile/tablets
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'));
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  });

  // User gesture to begin orchestral fantasy BGM
  const onFirstInteraction = () => {
    sound.userGesture();
    window.removeEventListener('pointerdown', onFirstInteraction);
  };
  window.addEventListener('pointerdown', onFirstInteraction);

  // Settings modal controller
  const closeSettings = () => {
    modalSettings.classList.remove('active');
  };

  btnSettings.addEventListener('click', (e) => {
    e.stopPropagation();
    modalSettings.classList.add('active');
  });

  btnCloseSettings.addEventListener('click', (e) => {
    e.stopPropagation();
    closeSettings();
  });

  btnContinueGame.addEventListener('click', (e) => {
    e.stopPropagation();
    closeSettings();
  });

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
    closeSettings();
    game.restartLevel();
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

  const getBiomeGroups = (): BiomeGroupConfig[] => {
    // Generate Tierras Infinitas levels up to at least 45 or (maxLevel + 5) rounded to nearest 5, capped at 100
    const infiniteMax = Math.min(100, Math.max(45, Math.ceil((game.maxLevel + 5) / 5) * 5));
    const infiniteLevels: number[] = [];
    for (let i = 41; i <= infiniteMax; i++) {
      infiniteLevels.push(i);
    }

    return [
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
        name: 'Erebor',
        icon: '⛏️',
        difficulty: 'Legendario',
        diffClass: 'diff-erebor',
        levels: [21, 22, 23, 24],
      },
      {
        name: 'Númenórë',
        icon: '⚓',
        difficulty: 'Mítico',
        diffClass: 'diff-numenor',
        levels: [25, 26, 27, 28],
      },
      {
        name: 'Pixie Hollow',
        icon: '🧚',
        difficulty: 'Mágico',
        diffClass: 'diff-pixie',
        levels: [29, 30, 31, 32],
      },
      {
        name: 'Nunca Jamás',
        icon: '🏴‍☠️',
        difficulty: 'Heroico',
        diffClass: 'diff-neverland',
        levels: [33, 34, 35, 36],
      },
      {
        name: 'Monte Vesubio',
        icon: '🔮',
        difficulty: 'Arcano',
        diffClass: 'diff-vesubio',
        levels: [37, 38, 39, 40],
      },
      {
        name: 'Tierras Infinitas',
        icon: '♾️',
        difficulty: 'Procedural',
        diffClass: 'diff-infinite',
        levels: infiniteLevels,
      },
    ];
  };

  const openLevelSelect = () => {
    levelSelectContainer.innerHTML = '';
    const records = getAllLevelRecords();

    for (const group of getBiomeGroups()) {
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
        
        const rec = records[lvl];
        if (rec) {
          btn.innerHTML = `${lvl}<span class="level-btn-stars">${'★'.repeat(rec.stars)}</span>`;
        } else {
          btn.textContent = lvl.toString();
        }

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

  // ==========================================
  // HIGH SCORES & LEADERBOARD CONTROLLER
  // ==========================================
  const openLeaderboard = () => {
    const hofEnabled = isHallOfFameEnabled();
    const currentPlayer = getPlayerName();
    if (inputPlayerName) {
      inputPlayerName.value = currentPlayer;
    }

    if (leaderboardModalTitle) {
      leaderboardModalTitle.textContent = hofEnabled
        ? 'Salón de la Fama & Récords'
        : '⭐ Récords & Estrellas por Nivel';
    }
    if (leaderboardModalSubtitle) {
      leaderboardModalSubtitle.textContent = hofEnabled
        ? 'Compite por la gloria eterna en las tierras de Nadezhi'
        : 'Consigue hasta 3 estrellas por nivel superando los objetivos de puntuación.';
    }

    if (playerProfileBar) {
      playerProfileBar.style.display = hofEnabled ? 'flex' : 'none';
    }
    if (leaderboardTabs) {
      leaderboardTabs.style.display = hofEnabled ? 'flex' : 'none';
    }

    if (!hofEnabled) {
      tabContentHof.style.display = 'none';
      tabContentLevels.style.display = 'block';
    } else {
      if (tabBtnHof.classList.contains('active')) {
        tabContentHof.style.display = 'block';
        tabContentLevels.style.display = 'none';
      } else {
        tabContentHof.style.display = 'none';
        tabContentLevels.style.display = 'block';
      }
    }

    // 1. Populate Hall of Fame (only if feature flag is active)
    if (hofEnabled && hofListContainer) {
      hofListContainer.replaceChildren();
      const hof = getHallOfFame();

      hof.forEach((entry, idx) => {
        const rank = idx + 1;
        const card = document.createElement('div');
        const isPlayer = entry.playerName.trim().toLowerCase() === currentPlayer.trim().toLowerCase();
        card.className = `hof-entry-card rank-${rank} ${isPlayer ? 'is-player' : ''}`;

        // Left side
        const left = document.createElement('div');
        left.className = 'hof-left-side';

        const rankBadge = document.createElement('div');
        rankBadge.className = 'hof-rank-badge';
        rankBadge.textContent = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
        left.appendChild(rankBadge);

        const pInfo = document.createElement('div');
        pInfo.className = 'hof-player-info';

        const pName = document.createElement('div');
        pName.className = 'hof-player-name';
        pName.textContent = entry.playerName;
        if (isPlayer) {
          const tag = document.createElement('span');
          tag.className = 'hof-player-tag';
          tag.textContent = 'TÚ';
          pName.appendChild(tag);
        }
        pInfo.appendChild(pName);

        const lvlSub = document.createElement('div');
        lvlSub.className = 'hof-level-sub';
        lvlSub.textContent = `Nivel ${entry.level} • ${entry.biomeIcon} ${entry.biomeName}`;
        pInfo.appendChild(lvlSub);
        left.appendChild(pInfo);
        card.appendChild(left);

        // Right side
        const right = document.createElement('div');
        right.className = 'hof-right-side';

        const scoreVal = document.createElement('div');
        scoreVal.className = 'hof-score-val';
        scoreVal.textContent = entry.score.toLocaleString();
        right.appendChild(scoreVal);

        const metaSub = document.createElement('div');
        metaSub.className = 'hof-meta-sub';

        const starsSpan = document.createElement('span');
        starsSpan.style.color = '#facc15';
        starsSpan.textContent = '★'.repeat(entry.stars) + '☆'.repeat(3 - entry.stars);
        metaSub.appendChild(starsSpan);

        const dateSpan = document.createElement('span');
        dateSpan.textContent = `• ${entry.date}`;
        metaSub.appendChild(dateSpan);
        right.appendChild(metaSub);
        card.appendChild(right);

        hofListContainer.appendChild(card);
      });
    }

    // 2. Populate Level Records
    if (levelRecordsContainer) {
      levelRecordsContainer.replaceChildren();
      const records = getAllLevelRecords();
      const maxLevelsToShow = Math.max(40, game.maxLevel);

      for (let lvl = 1; lvl <= maxLevelsToShow; lvl++) {
        const rec = records[lvl];
        const card = document.createElement('div');
        const biome = getLevelBiome(lvl);

        if (rec) {
          card.className = `level-record-card has-record ${rec.stars === 3 ? 'three-stars' : ''}`;

          const header = document.createElement('div');
          header.className = 'level-record-header';

          const num = document.createElement('span');
          num.className = 'level-record-num';
          num.textContent = `${biome.icon} Nivel ${lvl}`;
          header.appendChild(num);

          const stars = document.createElement('span');
          stars.className = 'level-record-stars';
          stars.style.color = '#facc15';
          stars.textContent = '★'.repeat(rec.stars) + '☆'.repeat(3 - rec.stars);
          header.appendChild(stars);
          card.appendChild(header);

          const score = document.createElement('div');
          score.className = 'level-record-score';
          score.textContent = `${rec.score.toLocaleString()} pts`;
          card.appendChild(score);

          const date = document.createElement('div');
          date.className = 'level-record-date';
          date.textContent = `Completado: ${rec.date}`;
          card.appendChild(date);
        } else {
          card.className = 'level-record-card';

          const header = document.createElement('div');
          header.className = 'level-record-header';

          const num = document.createElement('span');
          num.className = 'level-record-num';
          num.style.color = '#64748b';
          num.textContent = `${biome.icon} Nivel ${lvl}`;
          header.appendChild(num);
          card.appendChild(header);

          const unplayed = document.createElement('div');
          unplayed.className = 'level-record-unplayed';
          unplayed.textContent = lvl <= game.maxLevel ? 'Sin récord registrado' : '🔒 Bloqueado';
          card.appendChild(unplayed);
        }

        levelRecordsContainer.appendChild(card);
      }
    }

    // 3. Populate Footer Stats
    const stats = getPlayerStats();
    if (statTotalScore) statTotalScore.textContent = stats.totalScore.toLocaleString();
    if (statThreeStars) statThreeStars.textContent = `${stats.threeStarCount} ⭐`;
    if (statBestScore) statBestScore.textContent = stats.bestSingleScore > 0 ? stats.bestSingleScore.toLocaleString() : '0';

    modalLeaderboard.classList.add('active');
  };

  btnLeaderboard.addEventListener('click', (e) => {
    e.stopPropagation();
    closeSettings();
    openLeaderboard();
  });
  btnCloseLeaderboard.addEventListener('click', () => {
    modalLeaderboard.classList.remove('active');
  });
  btnCloseLeaderboardFooter.addEventListener('click', () => {
    modalLeaderboard.classList.remove('active');
  });

  tabBtnHof.addEventListener('click', () => {
    tabBtnHof.classList.add('active');
    tabBtnLevels.classList.remove('active');
    tabContentHof.style.display = 'block';
    tabContentLevels.style.display = 'none';
  });

  tabBtnLevels.addEventListener('click', () => {
    tabBtnLevels.classList.add('active');
    tabBtnHof.classList.remove('active');
    tabContentLevels.style.display = 'block';
    tabContentHof.style.display = 'none';
  });

  const savePlayerNameHandler = () => {
    const raw = inputPlayerName.value;
    const saved = setPlayerName(raw);
    inputPlayerName.value = saved;
    showToast('👤', `Nombre de aventurero: ${saved}`);
    openLeaderboard();
  };

  btnSavePlayerName.addEventListener('click', savePlayerNameHandler);
  inputPlayerName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      savePlayerNameHandler();
    }
  });

  btnHelp.addEventListener('click', (e) => {
    e.stopPropagation();
    closeSettings();
    modalHelp.classList.add('active');
  });
  btnCloseHelp.addEventListener('click', () => {
    modalHelp.classList.remove('active');
  });

  // Community Hub opener (scrolls to Nadezhi channels section)
  const openCommunityHub = () => {
    closeSettings();
    modalHelp.classList.add('active');
    setTimeout(() => {
      const commSection = document.querySelector('.help-community-section');
      if (commSection) {
        commSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const btnCommunitySettings = document.getElementById('btn-community-settings');
  const socialDockPill = document.getElementById('social-dock-pill');
  const btnDockAll = document.getElementById('btn-dock-all');

  btnCommunitySettings?.addEventListener('click', (e) => {
    e.stopPropagation();
    openCommunityHub();
  });

  socialDockPill?.addEventListener('click', (e) => {
    e.stopPropagation();
    openCommunityHub();
  });

  btnDockAll?.addEventListener('click', (e) => {
    e.stopPropagation();
    openCommunityHub();
  });

  // ==========================================
  // PWA / ADD TO HOME SCREEN (A2HS) PROMPT
  // ==========================================
  const pwaInstallBanner = document.getElementById('pwa-install-banner');
  const btnPwaInstall = document.getElementById('btn-pwa-install') as HTMLButtonElement | null;
  const btnPwaLater = document.getElementById('btn-pwa-later') as HTMLButtonElement | null;
  const btnPwaDismiss = document.getElementById('btn-pwa-dismiss') as HTMLButtonElement | null;
  const pwaDescText = document.getElementById('pwa-desc-text');
  const pwaIosInstructions = document.getElementById('pwa-ios-instructions');
  const btnHelpInstallPwa = document.getElementById('btn-help-install-pwa');

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;

  const isIPadOS =
    (navigator.platform === 'MacIntel' || navigator.userAgent.includes('Macintosh')) &&
    navigator.maxTouchPoints > 1;

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || isIPadOS;
  let deferredInstallPrompt: any = null;

  const hideInstallBanner = () => {
    if (pwaInstallBanner) {
      pwaInstallBanner.style.display = 'none';
    }
    try {
      localStorage.setItem('nadezhi_pwa_dismissed', 'true');
    } catch {}
  };

  const handleInstallClick = () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          hideInstallBanner();
        }
        deferredInstallPrompt = null;
      });
    } else {
      hideInstallBanner();
    }
  };

  const showInstallBanner = (force = false) => {
    if (isStandalone) return;
    if (!force && localStorage.getItem('nadezhi_pwa_dismissed') === 'true') return;
    if (!pwaInstallBanner) return;

    if (isIOS) {
      if (pwaIosInstructions) pwaIosInstructions.style.display = 'block';
      if (pwaDescText) pwaDescText.style.display = 'none';
      if (btnPwaInstall) {
        btnPwaInstall.textContent = '¡Entendido!';
        btnPwaInstall.onclick = hideInstallBanner;
      }
    } else {
      if (pwaIosInstructions) pwaIosInstructions.style.display = 'none';
      if (pwaDescText) pwaDescText.style.display = 'block';
      if (btnPwaInstall) {
        btnPwaInstall.textContent = '📲 Agregar a pantalla principal';
        btnPwaInstall.onclick = handleInstallClick;
      }
    }

    pwaInstallBanner.style.display = 'block';
  };

  // Android & Chromium desktop install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (!isStandalone) {
      setTimeout(() => {
        showInstallBanner(false);
      }, 3000);
    }
  });

  // Prompt on iOS Safari after 3.5s
  if (isIOS && !isStandalone) {
    setTimeout(() => {
      showInstallBanner(false);
    }, 3500);
  }

  btnPwaInstall?.addEventListener('click', handleInstallClick);
  btnPwaLater?.addEventListener('click', hideInstallBanner);
  btnPwaDismiss?.addEventListener('click', hideInstallBanner);

  btnHelpInstallPwa?.addEventListener('click', () => {
    modalHelp.classList.remove('active');
    showInstallBanner(true);
  });
});

(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const diskSelect = $('disk-count');
  const newGameButton = $('new-game');
  const solveButton = $('solve');
  const speedSlider = $('speed');
  const speedValue = $('speed-value');
  const board = $('board');
  const flightLayer = $('flight-layer');
  const instruction = $('instruction');

  let diskCount = Number(diskSelect.value);
  let state = [];
  let selectedPeg = null;
  let moves = 0;
  let invalidMoves = 0;
  let startedAt = null;
  let timerInterval = null;
  let solving = false;
  let manualMoveMade = false;
  let busy = false;

  const optimalMoves = (n) => (2 ** n) - 1;
  const formatTime = (seconds) =>
    `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  function elapsedSeconds() {
    return startedAt === null ? 0 : Math.floor((Date.now() - startedAt) / 1000);
  }

  function startTimer() {
    if (startedAt !== null) return;
    startedAt = Date.now();
    timerInterval = window.setInterval(() => $('timer').textContent = formatTime(elapsedSeconds()), 250);
  }

  function stopTimer() {
    if (timerInterval !== null) window.clearInterval(timerInterval);
    timerInterval = null;
  }

  function updateStats() {
    $('move-count').textContent = moves;
    $('invalid-count').textContent = invalidMoves;
    $('optimal-count').textContent = optimalMoves(diskCount);
    $('timer').textContent = formatTime(elapsedSeconds());
  }

  function render() {
    state.forEach((peg, pegIndex) => {
      const stack = $(`stack-${pegIndex}`);
      stack.replaceChildren();
      peg.forEach((diskSize) => {
        const disk = document.createElement('div');
        disk.className = `disk disk-${diskSize}${selectedPeg === pegIndex && peg[peg.length - 1] === diskSize ? ' selected' : ''}`;
        disk.style.width = `${30 + diskSize * 8}%`;
        disk.dataset.size = diskSize;
        disk.dataset.peg = pegIndex;
        disk.title = `Disk ${diskSize}`;
        disk.addEventListener('click', () => onDiskClick(pegIndex));
        stack.appendChild(disk);
      });
    });
    document.querySelectorAll('.peg-column').forEach((column) => {
      column.classList.toggle('target', selectedPeg !== null && Number(column.dataset.peg) !== selectedPeg);
    });
  }

  function resetGame() {
    stopTimer();
    diskCount = Number(diskSelect.value);
    state = [Array.from({ length: diskCount }, (_, i) => diskCount - i), [], []];
    selectedPeg = null;
    moves = 0;
    invalidMoves = 0;
    startedAt = null;
    solving = false;
    manualMoveMade = false;
    busy = false;
    flightLayer.replaceChildren();
    $('victory-modal').classList.add('hidden');
    solveButton.disabled = false;
    newGameButton.disabled = false;
    instruction.textContent = 'Select a top disk, then select its destination peg.';
    updateStats();
    render();
  }

  function onDiskClick(pegIndex) {
    if (busy || solving) return;
    if (state[pegIndex].length === 0) return;
    if (selectedPeg === null) {
      selectedPeg = pegIndex;
      render();
      instruction.textContent = `Disk selected on Peg ${pegIndex + 1}. Choose a destination peg.`;
      return;
    }
    if (selectedPeg === pegIndex) {
      selectedPeg = null;
      render();
      instruction.textContent = 'Selection cleared. Choose a top disk.';
      return;
    }
    attemptMove(selectedPeg, pegIndex, true);
  }

  async function onPegClick(event) {
    if (busy || solving || selectedPeg === null) return;
    const column = event.target.closest('.peg-column');
    if (!column) return;
    const to = Number(column.dataset.peg);
    if (to !== selectedPeg) await attemptMove(selectedPeg, to, true);
  }

  async function requestMove(from, to) {
    const response = await fetch('/api/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, from, to })
    });
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    return response.json();
  }

  function getDiskElement(pegIndex) {
    const stack = $(`stack-${pegIndex}`);
    return stack.lastElementChild;
  }

  async function animateDisk(from, to, diskSize) {
    const original = getDiskElement(from);
    if (!original) throw new Error('Could not locate the selected disk.');
    const boardRect = board.getBoundingClientRect();
    const sourceRect = original.getBoundingClientRect();
    const targetStack = $(`stack-${to}`);
    const targetRect = targetStack.getBoundingClientRect();

    const flying = original.cloneNode(true);
    flying.classList.remove('selected');
    flying.classList.add('flying-disk');
    flying.style.width = `${sourceRect.width}px`;
    flying.style.height = `${sourceRect.height}px`;
    flying.style.left = `${sourceRect.left - boardRect.left}px`;
    flying.style.top = `${sourceRect.top - boardRect.top}px`;
    flightLayer.appendChild(flying);

    const startX = sourceRect.left - boardRect.left;
    const startY = sourceRect.top - boardRect.top;
    const targetX = targetRect.left + (targetRect.width - sourceRect.width) / 2 - boardRect.left;
    const diskHeight = sourceRect.height;
    const targetY = boardRect.height - 16 - ((state[to].length + 1) * diskHeight) - boardRect.top + boardRect.top - 8;
    const liftY = Math.max(8, startY - 115);
    const dropY = Math.max(25, targetY);

    const duration = Math.max(100, 900 / Number(speedSlider.value));
    const phase = (fromX, fromY, toX, toY, time) => flying.animate(
      [{ transform: `translate(0px, 0px)` }, { transform: `translate(${toX - fromX}px, ${toY - fromY}px)` }],
      { duration: time, easing: 'linear', fill: 'forwards' }
    ).finished;

    try {
      // Phase 1: vertical lift.
      await flying.animate(
        [{ transform: 'translate(0px, 0px)' }, { transform: `translate(0px, ${liftY - startY}px)` }],
        { duration, easing: 'linear', fill: 'forwards' }
      ).finished;
      // Phase 2: horizontal travel only.
      await flying.animate(
        [{ transform: `translate(0px, ${liftY - startY}px)` },
         { transform: `translate(${targetX - startX}px, ${liftY - startY}px)` }],
        { duration, easing: 'linear', fill: 'forwards' }
      ).finished;
      // Phase 3: vertical drop only.
      await flying.animate(
        [{ transform: `translate(${targetX - startX}px, ${liftY - startY}px)` },
         { transform: `translate(${targetX - startX}px, ${dropY - startY}px)` }],
        { duration, easing: 'linear', fill: 'forwards' }
      ).finished;
    } finally {
      flying.remove();
    }
  }

  async function attemptMove(from, to, isManual = false) {
    if (busy || from === to) return false;
    busy = true;
    selectedPeg = null;
    try {
      let result;
      try {
        result = await requestMove(from, to);
      } catch (error) {
        instruction.textContent = 'Cannot reach the Prolog server. Start it with: swipl hanoi.pl';
        throw error;
      }
      if (!result.valid) {
        invalidMoves++;
        updateStats();
        instruction.textContent = 'Invalid move. A larger disk cannot be placed on a smaller disk.';
        render();
        return false;
      }
      if (isManual) {
        manualMoveMade = true;
        solveButton.disabled = true;
      }
      startTimer();
      const diskSize = state[from][state[from].length - 1];
      await animateDisk(from, to, diskSize);
      state = result.newState;
      moves++;
      updateStats();
      render();
      instruction.textContent = solving ? 'Auto-solving…' : 'Good move! Continue the puzzle.';
      if (state[2].length === diskCount) showVictory();
      return true;
    } catch (error) {
      console.error(error);
      return false;
    } finally {
      busy = false;
    }
  }

  async function autoSolve() {
    if (busy || manualMoveMade || solving) return;
    solving = true;
    solveButton.disabled = true;
    newGameButton.disabled = true;
    diskSelect.disabled = true;
    instruction.textContent = 'Asking SWI-Prolog for the optimal solution…';
    try {
      const response = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disks: diskCount, pegs: 3 })
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data = await response.json();
      for (const move of data.moves) {
        const ok = await attemptMove(move.from, move.to, false);
        if (!ok) throw new Error('The server rejected a move in its own solution.');
      }
    } catch (error) {
      console.error(error);
      instruction.textContent = 'Auto-solve failed. Check that the SWI-Prolog server is running.';
    } finally {
      solving = false;
      newGameButton.disabled = false;
      diskSelect.disabled = false;
      if (state[2].length !== diskCount && !manualMoveMade) solveButton.disabled = false;
    }
  }

  function showVictory() {
    stopTimer();
    const time = formatTime(elapsedSeconds());
    $('final-time').textContent = time;
    $('final-moves').textContent = moves;
    $('final-optimal').textContent = optimalMoves(diskCount);
    $('victory-modal').classList.remove('hidden');
    instruction.textContent = 'Puzzle completed!';
  }

  board.addEventListener('click', onPegClick);
  newGameButton.addEventListener('click', resetGame);
  $('play-again').addEventListener('click', resetGame);
  solveButton.addEventListener('click', autoSolve);
  diskSelect.addEventListener('change', resetGame);
  speedSlider.addEventListener('input', () => speedValue.textContent = `${speedSlider.value}x`);

  resetGame();
})();

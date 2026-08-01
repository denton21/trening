window.Trainer = window.Trainer || {};

(function () {
  const { $, $$, setPressed, showMessage } = Trainer;
  const RULES = Trainer.Roulette3DRules;

  const RED = RULES.RED;
  const WORLD = {
    cellW: 1.18,
    rowH: 0.62,
    gridLeft: -2.18,
    gridTop: 3.5,
    streetX: -3.04,
    dozenX: 2.05,
    wheelX: 4.85,
    wheelZ: 1.05,
    tableMinX: -4.08,
    tableMaxX: 7.03,
    tableMinZ: -6.05,
    tableMaxZ: 5.05
  };

  const VALUE_STYLE = {
    1: { color: 0xf5f0df, rim: 0xb59b54, ink: '#17212b' },
    5: { color: 0xc93d3d, rim: 0x7e2020, ink: '#fff4dd' },
    25: { color: 0x2c9b73, rim: 0x126048, ink: '#f1ffdc' },
    100: { color: 0x2f5ca8, rim: 0x183568, ink: '#eff6ff' }
  };

  const state = {
    initialized: false,
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    raycaster: null,
    pointer: null,
    animationFrame: null,
    resizeObserver: null,
    staticGroup: null,
    chipsGroup: null,
    wheelGroup: null,
    wheelBall: null,
    clickables: [],
    catalog: new Map(),
    result: 17,
    chipValue: 1,
    action: 'place',
    pointerDown: null,
    bets: new Map(),
    chipGeometry: null,
    chipRimGeometry: null,
    chipMaterials: new Map(),
    numberMeshes: new Map()
  };

  const els = {
    stage: $('#roulette3dStage'),
    loading: $('#roulette3dLoading'),
    newBtn: $('#roulette3dNewBtn'),
    randomBetsBtn: $('#roulette3dRandomBetsBtn'),
    clearBtn: $('#roulette3dClearBtn'),
    resetViewBtn: $('#roulette3dResetViewBtn'),
    chipChoices: $$('#roulette3dChipChoices button'),
    actionChoices: $$('#roulette3dActionChoices button'),
    resultInput: $('#roulette3dResultInput'),
    applyResultBtn: $('#roulette3dApplyResultBtn'),
    randomResultBtn: $('#roulette3dRandomResultBtn'),
    resultStat: $('#roulette3dResultStat'),
    stakeStat: $('#roulette3dStakeStat'),
    winningStat: $('#roulette3dWinningStat'),
    stageBadge: $('#roulette3dStageBadge'),
    resultCard: $('#roulette3dResultCard'),
    resultLabel: $('#roulette3dResultLabel'),
    payoutTotal: $('#roulette3dPayoutTotal'),
    breakdown: $('#roulette3dBreakdown'),
    answerForm: $('#roulette3dAnswerForm'),
    answer: $('#roulette3dAnswer'),
    message: $('#roulette3dMessage'),
    rulesStatus: $('#roulette3dRulesStatus')
  };

  function randomInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function shuffle(list) {
    const copy = list.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[other]] = [copy[other], copy[index]];
    }
    return copy;
  }

  function gridRight() {
    return WORLD.gridLeft + WORLD.cellW * 3;
  }

  function gridBottom() {
    return WORLD.gridTop - WORLD.rowH * 12;
  }

  function numberCell(number) {
    if (number === 0) return null;
    const index = number - 1;
    return {
      row: Math.floor(index / 3),
      col: index % 3
    };
  }

  function cellPosition(row, col) {
    return {
      x: WORLD.gridLeft + (col + 0.5) * WORLD.cellW,
      z: WORLD.gridTop - (row + 0.5) * WORLD.rowH
    };
  }

  function colorHex(number) {
    if (number === 0) return 0x07846e;
    return RED.has(number) ? 0xa92e35 : 0x111820;
  }

  function resultColorLabel(number) {
    if (number === 0) return 'зеро';
    return RED.has(number) ? 'красное' : 'чёрное';
  }

  function createCanvasTexture(text, color, background = null) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (background) {
      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    const lines = String(text).split('\n');
    const fontSize = lines.length > 1 ? 58 : 82;
    context.font = `800 ${fontSize}px Arial, sans-serif`;
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    lines.forEach((line, index) => {
      const y = canvas.height * ((index + 0.5) / lines.length);
      context.fillText(line, canvas.width / 2, y);
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.encoding = THREE.sRGBEncoding;
    return texture;
  }

  function makeLabel(text, color, scaleX, scaleY, background = null) {
    const material = new THREE.SpriteMaterial({
      map: createCanvasTexture(text, color, background),
      transparent: true,
      depthWrite: false,
      depthTest: true
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(scaleX, scaleY, 1);
    return sprite;
  }

  function addLabel(group, text, x, y, z, color, scaleX, scaleY, background = null) {
    const sprite = makeLabel(text, color, scaleX, scaleY, background);
    sprite.position.set(x, y, z);
    group.add(sprite);
    return sprite;
  }

  function addBox(group, width, height, depth, x, y, z, color, options = {}) {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: options.roughness ?? 0.72,
      metalness: options.metalness ?? 0.08,
      transparent: options.transparent || false,
      opacity: options.opacity ?? 1,
      depthWrite: options.depthWrite ?? true
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = options.castShadow ?? true;
    mesh.receiveShadow = options.receiveShadow ?? true;
    group.add(mesh);
    return mesh;
  }

  function addPlaneZone(group, width, depth, x, z, color = 0xd6a73c, opacity = 0.16) {
    const marker = addBox(group, width, 0.035, depth, x, 0.245, z, color, {
      roughness: 0.5,
      metalness: 0.3,
      transparent: true,
      opacity,
      castShadow: false,
      receiveShadow: false
    });
    return marker;
  }

  function clearObjectGroup(group) {
    if (!group) return;
    while (group.children.length) {
      const child = group.children[group.children.length - 1];
      group.remove(child);
    }
  }

  function disposeChipObject(object) {
    object.traverse((child) => {
      if (child.material && child.material.map) {
        child.material.map.dispose();
      }
    });
  }

  function clearRenderedChips() {
    if (!state.chipsGroup) return;
    while (state.chipsGroup.children.length) {
      const child = state.chipsGroup.children[state.chipsGroup.children.length - 1];
      disposeChipObject(child);
      state.chipsGroup.remove(child);
    }
  }

  function getChipMaterial(value) {
    if (state.chipMaterials.has(value)) {
      return state.chipMaterials.get(value);
    }
    const style = VALUE_STYLE[value] || VALUE_STYLE[1];
    const material = new THREE.MeshStandardMaterial({
      color: style.color,
      roughness: 0.34,
      metalness: 0.12
    });
    state.chipMaterials.set(value, material);
    return material;
  }

  function createChip(chip, anchor, index) {
    const style = VALUE_STYLE[chip.value] || VALUE_STYLE[1];
    const group = new THREE.Group();
    const body = new THREE.Mesh(state.chipGeometry, getChipMaterial(chip.value));
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const rimMaterial = new THREE.MeshStandardMaterial({
      color: style.rim,
      roughness: 0.36,
      metalness: 0.24
    });
    const rim = new THREE.Mesh(state.chipRimGeometry, rimMaterial);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.047;
    rim.castShadow = true;
    group.add(rim);

    const label = makeLabel(String(chip.value), style.ink, 0.22, 0.12);
    label.position.y = 0.058;
    group.add(label);

    const angle = ((index * 37 + chip.id * 11) % 360) * (Math.PI / 180);
    group.rotation.y = angle;
    group.position.set(anchor.x, 0.36 + index * 0.105, anchor.z);
    state.chipsGroup.add(group);
  }

  function renderChips() {
    clearRenderedChips();
    state.bets.forEach((bet) => {
      const catalogEntry = state.catalog.get(bet.key);
      if (!catalogEntry) return;
      bet.chips.forEach((chip, index) => createChip(chip, catalogEntry.anchor, index));
    });
  }

  function disposeTextures(group) {
    group.traverse((child) => {
      if (child.material && child.material.map) child.material.map.dispose();
    });
  }

  function setVisualHighlight(entry, isWin) {
    const mesh = entry.visual;
    if (!mesh || !mesh.material || !('emissive' in mesh.material)) return;
    mesh.material.emissive.setHex(isWin ? 0xc58f1d : 0x000000);
    mesh.material.emissiveIntensity = isWin ? 0.7 : 0;
  }

  function updateNumberHighlight() {
    state.numberMeshes.forEach((mesh, number) => {
      if (!mesh.material || !('emissive' in mesh.material)) return;
      const active = number === state.result;
      mesh.material.emissive.setHex(active ? 0xe1a72b : 0x000000);
      mesh.material.emissiveIntensity = active ? 0.65 : 0;
    });
  }

  function updateResultUi() {
    const label = `${state.result} · ${resultColorLabel(state.result)}`;
    els.resultStat.textContent = String(state.result);
    els.stageBadge.textContent = `Выпало: ${state.result}`;
    els.resultLabel.textContent = label;
    els.resultInput.value = String(state.result);
    updateNumberHighlight();
  }

  function calculate() {
    const bets = [...state.bets.values()].map((bet) => ({
      ...bet,
      amount: bet.chips.reduce((sum, chip) => sum + chip.value, 0)
    }));
    const result = RULES.calculate(bets, state.result);
    els.stakeStat.textContent = String(result.totalStake);
    els.winningStat.textContent = String(result.netPayout);
    els.payoutTotal.textContent = result.netPayout > 0 ? String(result.netPayout) : '0';

    state.catalog.forEach((entry) => setVisualHighlight(entry, false));
    result.entries.forEach((entry) => {
      const catalogEntry = state.catalog.get(entry.key);
      if (catalogEntry) setVisualHighlight(catalogEntry, entry.isWin);
    });

    renderBreakdown(result);
    return result;
  }

  function appendBreakdownRow(container, label, value, isWin) {
    const row = document.createElement('div');
    row.className = `roulette3d-breakdown-row ${isWin ? 'is-win' : 'is-loss'}`.trim();
    const text = document.createElement('span');
    text.textContent = label;
    const amount = document.createElement('strong');
    amount.textContent = value;
    row.append(text, amount);
    container.appendChild(row);
  }

  function renderBreakdown(result) {
    els.breakdown.innerHTML = '';
    if (!result.entries.length) {
      els.breakdown.textContent = 'Нет ставок. Выберите зону на столе и поставьте фишку.';
      return;
    }

    result.entries.forEach((entry) => {
      const label = `${entry.label} · ${entry.amount} × ${entry.odds}`;
      const value = entry.isWin ? `+${entry.profit}` : 'проигрыш';
      appendBreakdownRow(els.breakdown, label, value, entry.isWin);
    });

    const summary = document.createElement('div');
    summary.className = 'roulette3d-summary-line';
    summary.textContent = `Чистая выплата: ${result.netPayout} · возврат ставок: ${result.returnedStake} · всего: ${result.totalReturn}`;
    els.breakdown.appendChild(summary);
  }

  function addChipToBet(key, value = state.chipValue) {
    const entry = state.catalog.get(key);
    if (!entry) return;
    let bet = state.bets.get(key);
    if (!bet) {
      bet = { ...entry, chips: [] };
      state.bets.set(key, bet);
    }
    if (bet.chips.length >= 24) {
      showMessage(els.message, 'Максимум 24 фишки в одном стеке', 'bad');
      return;
    }
    bet.chips.push({ id: Date.now() + Math.random(), value });
    renderChips();
    calculate();
    showMessage(els.message, `${entry.label}: +${value}`, '');
  }

  function removeChipFromBet(key) {
    const bet = state.bets.get(key);
    if (!bet || !bet.chips.length) return;
    const removed = bet.chips.pop();
    if (!bet.chips.length) state.bets.delete(key);
    renderChips();
    calculate();
    showMessage(els.message, `${bet.label}: −${removed.value}`, '');
  }

  function clearBets(message = 'Фишки убраны со стола') {
    state.bets.clear();
    renderChips();
    calculate();
    if (message) showMessage(els.message, message, '');
  }

  function betFor(type, numbers) {
    const candidate = RULES.makeBet(type, numbers, '');
    return state.catalog.get(candidate.key);
  }

  function addDemoBet(type, numbers, value, count = 1) {
    const entry = betFor(type, numbers);
    if (!entry) return;
    for (let index = 0; index < count; index += 1) {
      addChipToBet(entry.key, value);
    }
  }

  function seedDemoBets() {
    clearBets('');
    const result = state.result;
    if (result === 0) {
      addDemoBet('straight', [0], 5, 1);
      addDemoBet('split', [0, 1], 5, 1);
      addDemoBet('trio', [0, 1, 2], 5, 1);
      addDemoBet('corner', [0, 1, 2, 3], 5, 1);
    } else {
      const cell = numberCell(result);
      const rowStart = cell.row * 3 + 1;
      const streetNumbers = [rowStart, rowStart + 1, rowStart + 2];
      const dozenStart = Math.floor((result - 1) / 12) * 12 + 1;
      const dozenNumbers = Array.from({ length: 12 }, (_, index) => dozenStart + index);
      const columnNumbers = Array.from({ length: 12 }, (_, index) => cell.col + 1 + index * 3);
      addDemoBet('straight', [result], 5, 1);
      addDemoBet('street', streetNumbers, 5, 1);
      addDemoBet('dozen', dozenNumbers, 5, 1);
      addDemoBet('column', columnNumbers, 1, 2);
      addDemoBet(RED.has(result) ? 'red' : 'black', [], 1, 1);
      if (cell.col < 2) {
        addDemoBet('split', [result, result + 1], 5, 1);
      } else {
        addDemoBet('split', [result - 1, result], 5, 1);
      }
    }
    renderChips();
    calculate();
    els.answer.value = '';
    showMessage(els.message, 'Демонстрационные ставки готовы. Сложите чистую выплату.', '');
  }

  function randomBets() {
    clearBets('');
    const candidates = shuffle([...state.catalog.values()]).filter((entry) => entry.type !== 'straight');
    const count = randomInt(5, 9);
    candidates.slice(0, count).forEach((entry) => {
      const value = [1, 5, 25][randomInt(0, 2)];
      const chips = randomInt(1, 3);
      for (let index = 0; index < chips; index += 1) {
        addChipToBet(entry.key, value);
      }
    });
    showMessage(els.message, 'Случайные ставки готовы. Проверьте расчёт по строкам.', '');
  }

  function setResult(value) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0 || number > 36) {
      showMessage(els.message, 'Результат должен быть целым числом от 0 до 36', 'bad');
      return;
    }
    state.result = number;
    updateResultUi();
    calculate();
    showMessage(els.message, `Результат: ${number} · ${resultColorLabel(number)}`, '');
  }

  function findBetKey(event) {
    const rect = state.renderer.domElement.getBoundingClientRect();
    state.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    state.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    state.raycaster.setFromCamera(state.pointer, state.camera);
    const hits = state.raycaster.intersectObjects(state.clickables, false);
    return hits[0]?.object?.userData?.betKey || null;
  }

  function onStagePointerDown(event) {
    state.pointerDown = { x: event.clientX, y: event.clientY };
  }

  function onStagePointerUp(event) {
    if (!state.pointerDown || !state.renderer || !state.camera) return;
    const dx = event.clientX - state.pointerDown.x;
    const dy = event.clientY - state.pointerDown.y;
    state.pointerDown = null;
    if (dx * dx + dy * dy > 36) return;
    const key = findBetKey(event);
    if (!key) return;
    if (state.action === 'remove') {
      removeChipFromBet(key);
    } else {
      addChipToBet(key);
    }
  }

  function onStagePointerMove(event) {
    if (!state.renderer || !state.camera || !state.pointer || !els.stage) return;
    const key = findBetKey(event);
    els.stage.classList.toggle('is-bet-hover', Boolean(key));
  }

  function registerBet(type, numbers, label, anchor, width, depth, visual = {}) {
    const bet = RULES.makeBet(type, numbers, label);
    if (state.catalog.has(bet.key)) return state.catalog.get(bet.key);

    const visualMesh = visual.mesh || addPlaneZone(state.staticGroup, width, depth, anchor.x, anchor.z, visual.color || 0xd6a73c, visual.opacity ?? 0.12);
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.16, depth),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hit.position.set(anchor.x, 0.34, anchor.z);
    hit.userData.betKey = bet.key;
    hit.userData.label = label;
    state.staticGroup.add(hit);
    state.clickables.push(hit);

    const entry = {
      ...bet,
      anchor,
      visual: visualMesh,
      hit,
      chips: []
    };
    state.catalog.set(bet.key, entry);
    return entry;
  }

  function addNumberCell(number, row, col) {
    const position = cellPosition(row, col);
    const cell = addBox(
      state.staticGroup,
      WORLD.cellW - 0.045,
      0.14,
      WORLD.rowH - 0.045,
      position.x,
      0.16,
      position.z,
      colorHex(number),
      { roughness: 0.78, metalness: 0.04 }
    );
    cell.userData.betKey = RULES.makeBet('straight', [number], String(number)).key;
    state.clickables.push(cell);
    state.numberMeshes.set(number, cell);
    addLabel(state.staticGroup, String(number), position.x, 0.29, position.z, '#fff6dc', 0.43, 0.25);
    registerBet('straight', [number], String(number), position, WORLD.cellW - 0.07, WORLD.rowH - 0.07, { mesh: cell });
  }

  function addLabeledZone(type, numbers, label, x, z, width, depth, color = 0x1c5e51) {
    const marker = addPlaneZone(state.staticGroup, width, depth, x, z, color, 0.56);
    addLabel(state.staticGroup, label, x, 0.31, z, '#f8e8ad', Math.min(width * 0.8, 0.82), Math.min(depth * 0.55, 0.34));
    return registerBet(type, numbers, label, { x, z }, width, depth, { mesh: marker });
  }

  function buildNumberGrid() {
    const gridWidth = WORLD.cellW * 3;
    const zeroZ = WORLD.gridTop + 0.46;
    const zero = addBox(state.staticGroup, gridWidth - 0.045, 0.14, 0.78, WORLD.gridLeft + gridWidth / 2, 0.16, zeroZ, colorHex(0), {
      roughness: 0.78,
      metalness: 0.04
    });
    zero.userData.betKey = RULES.makeBet('straight', [0], '0').key;
    state.clickables.push(zero);
    state.numberMeshes.set(0, zero);
    addLabel(state.staticGroup, '0', WORLD.gridLeft + gridWidth / 2, 0.29, zeroZ, '#f5ffe8', 0.5, 0.32);
    registerBet('straight', [0], '0', { x: WORLD.gridLeft + gridWidth / 2, z: zeroZ }, gridWidth - 0.07, 0.72, { mesh: zero });

    for (let row = 0; row < 12; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        addNumberCell(row * 3 + col + 1, row, col);
      }
    }
  }

  function buildLineBets() {
    const gridWidth = WORLD.cellW * 3;
    const right = gridRight();
    const bottom = gridBottom();
    const zeroBoundary = WORLD.gridTop;

    for (let row = 0; row < 12; row += 1) {
      const rowZ = WORLD.gridTop - (row + 0.5) * WORLD.rowH;
      const start = row * 3 + 1;
      registerBet('street', [start, start + 1, start + 2], `${start}-${start + 2}`, { x: WORLD.streetX, z: rowZ }, 0.74, 0.39);
      if (row < 11) {
        const boundaryZ = WORLD.gridTop - (row + 1) * WORLD.rowH;
        registerBet('sixline', [start, start + 1, start + 2, start + 3, start + 4, start + 5], `${start}-${start + 5}`, { x: WORLD.streetX, z: boundaryZ }, 0.74, 0.2);
      }

      for (let col = 0; col < 3; col += 1) {
        const position = cellPosition(row, col);
        if (col < 2) {
          const x = WORLD.gridLeft + (col + 1) * WORLD.cellW;
          registerBet('split', [row * 3 + col + 1, row * 3 + col + 2], `${row * 3 + col + 1}/${row * 3 + col + 2}`, { x, z: position.z }, 0.18, 0.43);
        }
        if (row < 11) {
          const z = WORLD.gridTop - (row + 1) * WORLD.rowH;
          registerBet('split', [row * 3 + col + 1, row * 3 + col + 4], `${row * 3 + col + 1}/${row * 3 + col + 4}`, { x: position.x, z }, 0.43, 0.18);
        }
        if (col < 2 && row < 11) {
          const x = WORLD.gridLeft + (col + 1) * WORLD.cellW;
          const z = WORLD.gridTop - (row + 1) * WORLD.rowH;
          const numbers = [row * 3 + col + 1, row * 3 + col + 2, row * 3 + col + 4, row * 3 + col + 5];
          registerBet('corner', numbers, numbers.join('/'), { x, z }, 0.24, 0.24);
        }
      }
    }

    for (let col = 0; col < 3; col += 1) {
      const x = WORLD.gridLeft + (col + 0.5) * WORLD.cellW;
      registerBet('split', [0, col + 1], `0/${col + 1}`, { x, z: zeroBoundary }, 0.45, 0.2);
      if (col < 2) {
        const xBoundary = WORLD.gridLeft + (col + 1) * WORLD.cellW;
        registerBet('trio', col === 0 ? [0, 1, 2] : [0, 2, 3], col === 0 ? '0-1-2' : '0-2-3', { x: xBoundary, z: zeroBoundary }, 0.2, 0.45);
      }
    }
    registerBet('corner', [0, 1, 2, 3], '0/1/2/3', { x: WORLD.streetX, z: zeroBoundary }, 0.42, 0.24);

    const dozenNumbers = [1, 13, 25].map((start) => Array.from({ length: 12 }, (_, index) => start + index));
    dozenNumbers.forEach((numbers, index) => {
      const firstRow = index * 4;
      const z = WORLD.gridTop - (firstRow + 2) * WORLD.rowH;
      addLabeledZone('dozen', numbers, `${index + 1}${index === 0 ? 'ST' : index === 1 ? 'ND' : 'RD'} 12`, WORLD.dozenX, z, 0.98, WORLD.rowH * 3.55);
    });

    for (let col = 0; col < 3; col += 1) {
      const numbers = Array.from({ length: 12 }, (_, index) => col + 1 + index * 3);
      const x = WORLD.gridLeft + (col + 0.5) * WORLD.cellW;
      addLabeledZone('column', numbers, `COL ${col + 1}`, x, bottom - 0.43, WORLD.cellW - 0.08, 0.55, 0x245b4c);
    }

    const outside = [
      { type: 'low', numbers: [], label: '1-18', color: 0x245b4c },
      { type: 'even', numbers: [], label: 'EVEN', color: 0x245b4c },
      { type: 'red', numbers: [], label: 'RED', color: 0x8d2e36 },
      { type: 'black', numbers: [], label: 'BLACK', color: 0x151b22 },
      { type: 'odd', numbers: [], label: 'ODD', color: 0x245b4c },
      { type: 'high', numbers: [], label: '19-36', color: 0x245b4c }
    ];
    const outsideWidth = gridWidth / outside.length;
    outside.forEach((bet, index) => {
      const x = WORLD.gridLeft + outsideWidth * (index + 0.5);
      addLabeledZone(bet.type, bet.numbers, bet.label, x, bottom - 1.1, outsideWidth - 0.05, 0.55, bet.color);
    });

    addLabel(state.staticGroup, 'STREETS', WORLD.streetX, 0.32, WORLD.gridTop - WORLD.rowH * 6, '#f1d98d', 0.55, 0.2);
    addLabel(state.staticGroup, 'DOZENS', WORLD.dozenX, 0.32, WORLD.gridTop - WORLD.rowH * 6, '#f1d98d', 0.62, 0.2);
    addLabel(state.staticGroup, 'COLUMNS', WORLD.gridLeft + gridWidth / 2, 0.32, bottom - 0.43, '#f1d98d', 1.05, 0.2);
  }

  function createWheel() {
    const group = new THREE.Group();
    group.position.set(WORLD.wheelX, 0.29, WORLD.wheelZ);
    state.staticGroup.add(group);
    state.wheelGroup = group;

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(2.03, 2.12, 0.34, 48),
      new THREE.MeshStandardMaterial({ color: 0x1a1110, roughness: 0.55, metalness: 0.28 })
    );
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const wood = new THREE.Mesh(
      new THREE.CylinderGeometry(1.82, 1.82, 0.18, 48),
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.5, metalness: 0.08 })
    );
    wood.position.y = 0.22;
    wood.castShadow = true;
    group.add(wood);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.82, 0.11, 10, 48),
      new THREE.MeshStandardMaterial({ color: 0xd6a73c, roughness: 0.32, metalness: 0.65 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.35;
    group.add(ring);

    RULES.EURO_NUMBERS.forEach((number, index) => {
      const angle = (index / RULES.EURO_NUMBERS.length) * Math.PI * 2;
      const pocket = addBox(group, 0.3, 0.16, 0.52, Math.cos(angle) * 1.47, 0.39, Math.sin(angle) * 1.47, colorHex(number), {
        roughness: 0.65,
        metalness: 0.05,
        castShadow: true
      });
      pocket.rotation.y = -angle;
      addLabel(group, String(number), Math.cos(angle) * 1.47, 0.51, Math.sin(angle) * 1.47, '#fff6dc', 0.18, 0.1);
    });

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 0.68, 0.48, 40),
      new THREE.MeshStandardMaterial({ color: 0xd3a53e, roughness: 0.28, metalness: 0.72 })
    );
    hub.position.y = 0.45;
    hub.castShadow = true;
    group.add(hub);

    const hubTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 0.06, 32),
      new THREE.MeshStandardMaterial({ color: 0x0e3933, roughness: 0.42, metalness: 0.18 })
    );
    hubTop.position.y = 0.72;
    group.add(hubTop);

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 20, 12),
      new THREE.MeshStandardMaterial({ color: 0xf8f1dc, roughness: 0.23, metalness: 0.05 })
    );
    ball.position.set(1.06, 0.6, 0.12);
    ball.castShadow = true;
    group.add(ball);
    state.wheelBall = ball;

    addLabel(state.staticGroup, 'EURO WHEEL', WORLD.wheelX, 0.36, WORLD.wheelZ - 2.35, '#f1d98d', 1.08, 0.25);
  }

  function createTable() {
    const width = WORLD.tableMaxX - WORLD.tableMinX;
    const depth = WORLD.tableMaxZ - WORLD.tableMinZ;
    const centerX = (WORLD.tableMinX + WORLD.tableMaxX) / 2;
    const centerZ = (WORLD.tableMinZ + WORLD.tableMaxZ) / 2;

    addBox(state.staticGroup, width, 0.46, depth, centerX, -0.03, centerZ, 0x17120c, {
      roughness: 0.62,
      metalness: 0.22,
      castShadow: true,
      receiveShadow: true
    });
    addBox(state.staticGroup, width - 0.32, 0.12, depth - 0.32, centerX, 0.23, centerZ, 0x0b4a3f, {
      roughness: 0.94,
      metalness: 0,
      castShadow: false,
      receiveShadow: true
    });

    const railColor = 0x2b1c0b;
    addBox(state.staticGroup, width, 0.22, 0.16, centerX, 0.34, WORLD.tableMinZ + 0.14, railColor, { metalness: 0.32 });
    addBox(state.staticGroup, width, 0.22, 0.16, centerX, 0.34, WORLD.tableMaxZ - 0.14, railColor, { metalness: 0.32 });
    addBox(state.staticGroup, 0.16, 0.22, depth, WORLD.tableMinX + 0.14, 0.34, centerZ, railColor, { metalness: 0.32 });
    addBox(state.staticGroup, 0.16, 0.22, depth, WORLD.tableMaxX - 0.14, 0.34, centerZ, railColor, { metalness: 0.32 });

    const gridWidth = WORLD.cellW * 3;
    const gridHeight = WORLD.rowH * 12;
    addBox(state.staticGroup, gridWidth + 0.12, 0.035, gridHeight + 1.03, WORLD.gridLeft + gridWidth / 2, 0.295, WORLD.gridTop - gridHeight / 2 + 0.23, 0xd2a33d, {
      roughness: 0.38,
      metalness: 0.68,
      castShadow: false,
      receiveShadow: false
    });
    addBox(state.staticGroup, gridWidth + 0.02, 0.04, gridHeight + 0.93, WORLD.gridLeft + gridWidth / 2, 0.32, WORLD.gridTop - gridHeight / 2 + 0.23, 0x0b4a3f, {
      roughness: 0.9,
      metalness: 0,
      castShadow: false,
      receiveShadow: false
    });
  }

  function buildLayout() {
    state.staticGroup = new THREE.Group();
    state.chipsGroup = new THREE.Group();
    state.scene.add(state.staticGroup, state.chipsGroup);
    createTable();
    buildNumberGrid();
    buildLineBets();
    createWheel();
  }

  function setupLights() {
    const hemi = new THREE.HemisphereLight(0x9edbd0, 0x10130e, 1.2);
    state.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff0bd, 2.8);
    key.position.set(-3, 11, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -8;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    state.scene.add(key);

    const fill = new THREE.PointLight(0x23a996, 1.5, 22, 2);
    fill.position.set(4, 5, -2);
    state.scene.add(fill);

    const warm = new THREE.PointLight(0xd9932d, 1.2, 18, 2);
    warm.position.set(-4, 4, 4);
    state.scene.add(warm);
  }

  function resetView() {
    if (!state.camera || !state.controls) return;
    state.camera.position.set(0.85, 12.8, 13.2);
    state.controls.target.set(0.65, 0.1, -0.45);
    state.controls.update();
  }

  function resizeRenderer() {
    if (!state.renderer || !state.camera || !els.stage) return;
    const rect = els.stage.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    state.renderer.setSize(width, height, false);
    state.camera.aspect = width / height;
    state.camera.updateProjectionMatrix();
  }

  function animate() {
    if (!state.renderer) return;
    state.animationFrame = window.requestAnimationFrame(animate);
    if (state.controls) state.controls.update();
    if (state.wheelGroup) state.wheelGroup.rotation.y += 0.0008;
    if (state.wheelBall) {
      state.wheelBall.position.x = Math.cos(Date.now() * 0.0011) * 1.06;
      state.wheelBall.position.z = Math.sin(Date.now() * 0.0011) * 1.06;
    }
    state.renderer.render(state.scene, state.camera);
  }

  function setupThree() {
    if (typeof THREE === 'undefined' || typeof THREE.OrbitControls === 'undefined') {
      els.loading.textContent = 'Three.js не загрузился. Проверьте подключение к CDN.';
      els.rulesStatus.textContent = 'Правила доступны, 3D-сцена недоступна';
      els.rulesStatus.style.color = 'var(--bad)';
      return false;
    }

    state.scene = new THREE.Scene();
    state.scene.background = new THREE.Color(0x061a19);
    state.scene.fog = new THREE.Fog(0x061a19, 17, 31);
    state.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
    state.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    state.renderer.outputEncoding = THREE.sRGBEncoding;
    state.renderer.shadowMap.enabled = true;
    state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    state.renderer.domElement.setAttribute('aria-hidden', 'true');
    els.stage.insertBefore(state.renderer.domElement, els.loading);

    state.controls = new THREE.OrbitControls(state.camera, state.renderer.domElement);
    state.controls.enableDamping = true;
    state.controls.dampingFactor = 0.075;
    state.controls.minDistance = 8;
    state.controls.maxDistance = 23;
    state.controls.minPolarAngle = 0.32;
    state.controls.maxPolarAngle = 1.43;
    state.controls.enablePan = true;
    state.controls.screenSpacePanning = false;
    state.raycaster = new THREE.Raycaster();
    state.pointer = new THREE.Vector2();
    state.chipGeometry = new THREE.CylinderGeometry(0.22, 0.22, 0.075, 32);
    state.chipRimGeometry = new THREE.TorusGeometry(0.18, 0.021, 8, 32);

    setupLights();
    buildLayout();
    resetView();
    resizeRenderer();
    els.loading.classList.add('is-hidden');
    els.stage.addEventListener('pointerdown', onStagePointerDown);
    els.stage.addEventListener('pointerup', onStagePointerUp);
    els.stage.addEventListener('pointermove', onStagePointerMove);
    window.addEventListener('resize', resizeRenderer);
    if ('ResizeObserver' in window) {
      state.resizeObserver = new ResizeObserver(resizeRenderer);
      state.resizeObserver.observe(els.stage);
    }
    animate();
    return true;
  }

  function wireControls() {
    els.newBtn.addEventListener('click', () => {
      state.result = randomInt(0, 36);
      updateResultUi();
      seedDemoBets();
    });
    els.randomBetsBtn.addEventListener('click', randomBets);
    els.clearBtn.addEventListener('click', () => clearBets());
    els.resetViewBtn.addEventListener('click', resetView);
    els.applyResultBtn.addEventListener('click', () => setResult(els.resultInput.value));
    els.randomResultBtn.addEventListener('click', () => setResult(randomInt(0, 36)));

    els.chipChoices.forEach((button) => {
      button.addEventListener('click', () => {
        state.chipValue = Number(button.dataset.value);
        els.chipChoices.forEach((item) => setPressed(item, item === button));
      });
    });
    els.actionChoices.forEach((button) => {
      button.addEventListener('click', () => {
        state.action = button.dataset.action;
        els.actionChoices.forEach((item) => setPressed(item, item === button));
      });
    });
    els.answerForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const answer = Number(els.answer.value);
      const result = calculate();
      if (els.answer.value.trim() === '' || !Number.isFinite(answer)) {
        showMessage(els.message, 'Введите чистую выплату', 'bad');
        return;
      }
      if (answer === result.netPayout) {
        showMessage(els.message, `Верно · чистая выплата ${result.netPayout}`, 'good');
      } else {
        showMessage(els.message, `Неверно · правильная чистая выплата ${result.netPayout}`, 'bad');
      }
    });
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;
    wireControls();
    const selfTestPassed = RULES.runSelfTest();
    els.rulesStatus.textContent = selfTestPassed ? 'Встроенная проверка выплат пройдена' : 'Ошибка встроенной проверки выплат';
    els.rulesStatus.style.color = selfTestPassed ? 'var(--good)' : 'var(--bad)';
    try {
      if (!setupThree()) return;
    } catch (error) {
      els.loading.textContent = 'Не удалось создать WebGL-сцену. Остальные режимы приложения работают.';
      els.rulesStatus.textContent = 'Правила доступны, WebGL недоступен';
      els.rulesStatus.style.color = 'var(--bad)';
      return;
    }
    updateResultUi();
    seedDemoBets();
  }

  Trainer.stopRoulette3D = function stopRoulette3D() {
    // The scene keeps rendering while hidden so returning to the tab is immediate.
  };

  Trainer.refreshRoulette3D = function refreshRoulette3D() {
    if (!state.initialized || !state.renderer) return;
    resizeRenderer();
    if (state.controls) state.controls.update();
  };

  Trainer.initRoulette3D = init;
})();

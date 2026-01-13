// Reference: GENERATING URBAN STRUCTURES: A METHOD FOR URBAN PLANNING SUPPORTED BY MULTI-AGENT SYSTEMS AND CELLULAR AUTOMATA
// - A hexagonal grid is used to represent the city
// - Entity hierarchy: empty -> house -> shop -> tower -> factory -> etc.
// - Diffusion growth (DLA): agents random-walk on hex grid, aggregate when touching existing entity (with probability p), new entity starts as house (level 1)
// - Evolution: count lower-level neighbors (von Neumann neighborhood), if > threshold, upgrade to next level
// > - State space: 0 = empty, 1 = candidate, 2 = crystallized
// > - For each cell H, let C_U(H)(t) be the number of crystallized neighbors of H at time t:
// > - Transition rules: S_H(t+1) = 1  if  S_H(t)=0  AND  C_U(H)(t) > 0
// > - Aggregation rules: S_H(t+1) = 2  if  S_H(t)=1  AND  P_A(t)=H  AND  ε < ρ (sticking probability)

const CANVAS_SIZE = 1080;
const CELL_RADIUS = CANVAS_SIZE / 64;

// Global font for WEBGL text rendering
let textFontLoaded;

const STATE_SPACE = {
  EMPTY: 0,
  CANDIDATE: 1,
  CRYSTALLIZED: 2
};

const LEVEL = {
  EMPTY: 0,
  HOUSE: 1,
  SHOP: 2,
  TOWER: 3,
  FACTORY: 4
};

const EVOLUTION = {
  [LEVEL.HOUSE]: { threshold: 2, next: LEVEL.SHOP },
  [LEVEL.SHOP]: { threshold: 3, next: LEVEL.TOWER },
  [LEVEL.TOWER]: { threshold: 4, next: LEVEL.FACTORY },
  [LEVEL.FACTORY]: null
};

const LEVEL_COLORS = {
  [LEVEL.EMPTY]: null,
  [LEVEL.HOUSE]: "rgb(0, 255, 133)", // neon green
  [LEVEL.SHOP]: "rgb(0, 194, 255)", // electric cyan
  [LEVEL.TOWER]: "rgb(255, 45, 255)", // hot magenta
  [LEVEL.FACTORY]: "rgb(255, 247, 90)" // neon yellow
};

const SERVICE_RANGE = {
  [LEVEL.EMPTY]: 0,
  [LEVEL.HOUSE]: 1,
  [LEVEL.SHOP]: 2,
  [LEVEL.TOWER]: 3,
  [LEVEL.FACTORY]: 4
};

let size;
let cols;
let rows;
let grid;
let hoveredTile = null;

// Add at top with other globals
let controls = {
  spawnRate: 2,
  maxAgents: 50,
  stickingProb: 0.7,
  evolveRate: 15,
  shadowFactor: 0.5,
  biasedWalkChance: 0.3,
  paused: false,
  decayRate: 20,
  decayProb: 0.505,
  seed: 42 // Random seed for reproducible patterns
};

let sliders = {};
let geometryManager; // 3D geometry system
let cameraController; // Orbit camera controller

// ref: https://www.redblobgames.com/grids/hexagons/

class Tile {
  // Flat-top hexagon
  constructor(q, r, size) {
    this.q = q; // column (hex coord)
    this.r = r; // row (hex coord)
    this.size = size;

    const colSpacing = 1.5 * size; // horz distance between adjacent hexagons centers
    const rowSpacing = sqrt(3) * size; // vert distance
    const oddColOffset = rowSpacing / 2; // half of the rowSpacing

    // 3D coordinates (WEBGL uses y-up axis)
    this.x = colSpacing * q;
    this.z = rowSpacing * r + (q % 2) * oddColOffset; // NEW: y becomes z for depth
    this.y = 0; // NEW: vertical height (base level)

    // State for DLA simulation
    this.state = 0;
    this.level = 0;

    // Morphing animation state
    this.targetLevel = this.level;
    this.morphProgress = 1.0; // 0.0 = source shape, 1.0 = target shape
    this.morphDuration = 1000; // milliseconds
    this.morphStartTime = 0;
  }

  init() {
    this.state = int(random(2));
  }

  canPromote(grid) {
    if (this.state !== STATE_SPACE.CRYSTALLIZED) return false;

    const neighbors = grid.getNeighbors(this.q, this.r);
    const currentLevel = this.level;
    const config = EVOLUTION[currentLevel];

    if (!config) return false;

    const lowerNeighbors = neighbors.filter(
      (n) => n.state === STATE_SPACE.CRYSTALLIZED && n.level <= currentLevel
    );
    const servedEnough = lowerNeighbors.length >= config.threshold;

    // Use controls.shadowFactor instead of constant
    const shadowRadius = SERVICE_RANGE[config.next] * controls.shadowFactor;
    const inShadow = grid.tiles.some(
      (n) =>
        n !== this &&
        n.state === STATE_SPACE.CRYSTALLIZED &&
        grid.hexDistance(this, n) <= shadowRadius &&
        n.level >= config.next
    );

    return servedEnough && !inShadow;
  }

  generate() {
    // Try to promote to next level
  }

  setTargetLevel(newLevel) {
    if (newLevel === this.level) return;

    this.targetLevel = newLevel;
    this.morphProgress = 0.0;
    this.morphStartTime = millis();
  }

  updateMorphing() {
    if (this.morphProgress >= 1.0) return;

    const elapsed = millis() - this.morphStartTime;
    this.morphProgress = constrain(elapsed / this.morphDuration, 0, 1);

    // Smooth easing (ease-in-out cubic)
    if (this.morphProgress < 0.5) {
      this.morphProgress =
        4 * this.morphProgress * this.morphProgress * this.morphProgress;
    } else {
      this.morphProgress = 1 - Math.pow(-2 * this.morphProgress + 2, 3) / 2;
    }

    // Complete the transition
    if (this.morphProgress >= 1.0) {
      this.level = this.targetLevel;
      // If morphing to EMPTY, update state now (synchronized with level change)
      if (this.targetLevel === LEVEL.EMPTY) {
        this.state = STATE_SPACE.EMPTY;
      }
    }
  }

  draw3D() {
    push();
    translate(this.x, 0, this.z); // Position in 3D space

    // Get morphed geometry based on animation progress
    const geometry = geometryManager.getMorphedGeometry(
      this.level,
      this.targetLevel,
      this.morphProgress
    );

    // Apply material
    if (geometry.color) {
      fill(geometry.color);
    } else {
      fill("rgb(25, 15, 60)"); // Empty tiles, deep violet
    }
    noStroke();

    // Draw using triangle mesh
    beginShape(TRIANGLES);
    for (let i = 0; i < geometry.indices.length; i += 3) {
      const i0 = geometry.indices[i];
      const i1 = geometry.indices[i + 1];
      const i2 = geometry.indices[i + 2];

      normal(
        geometry.normals[i0].x,
        geometry.normals[i0].y,
        geometry.normals[i0].z
      );
      vertex(
        geometry.vertices[i0].x,
        geometry.vertices[i0].y,
        geometry.vertices[i0].z
      );

      normal(
        geometry.normals[i1].x,
        geometry.normals[i1].y,
        geometry.normals[i1].z
      );
      vertex(
        geometry.vertices[i1].x,
        geometry.vertices[i1].y,
        geometry.vertices[i1].z
      );

      normal(
        geometry.normals[i2].x,
        geometry.normals[i2].y,
        geometry.normals[i2].z
      );
      vertex(
        geometry.vertices[i2].x,
        geometry.vertices[i2].y,
        geometry.vertices[i2].z
      );
    }
    endShape();

    pop();
  }

  contains(px, py) {
    // Point-in-hexagon check using distance to center
    // For flat-top hex, use inscribed circle as approximation
    const dx = px - this.x;
    const dz = py - this.z; // Using z for 2D depth coordinate

    // More accurate hex hit-test using axial distance
    // Transform to hex-local coordinates
    const q = ((2 / 3) * dx) / this.size;
    const r = ((-1 / 3) * dx + (sqrt(3) / 3) * dz) / this.size;

    // Check if within unit hexagon
    const s = -q - r;
    return Math.abs(q) <= 1 && Math.abs(r) <= 1 && Math.abs(s) <= 1;
  }

  drawServiceRange(grid) {
    if (this.state !== STATE_SPACE.CRYSTALLIZED) return;

    const range = SERVICE_RANGE[this.level];
    if (range === 0) return;

    const tilesInRange = grid.getTilesInRange(this.q, this.r, range);
    const color = LEVEL_COLORS[this.level];

    // Draw range overlay
    push();
    noStroke();

    // Parse rgb string to get values for alpha
    const match = color.match(/\d+/g);
    fill(match[0], match[1], match[2], 80);

    for (const t of tilesInRange) {
      if (t === this) continue; // skip self

      push();
      translate(t.x, t.z); // Using z for 2D depth
      beginShape();
      for (let i = 0; i < 6; i++) {
        const angle = (i * PI) / 3;
        vertex(t.size * cos(angle), t.size * sin(angle));
      }
      endShape(CLOSE);
      pop();
    }

    // Draw range border (outermost ring)
    stroke(match[0], match[1], match[2], 200);
    strokeWeight(2);
    noFill();

    for (const t of tilesInRange) {
      const dist = grid.hexDistance(this, t);
      if (dist === range) {
        push();
        translate(t.x, t.z); // Using z for 2D depth
        beginShape();
        for (let i = 0; i < 6; i++) {
          const angle = (i * PI) / 3;
          vertex(t.size * cos(angle), t.size * sin(angle));
        }
        endShape(CLOSE);
        pop();
      }
    }

    pop();
  }
}

class Agent {
  constructor(grid, tile) {
    this.grid = grid;
    this.tile = tile;
    this.alive = true;
    // For multi-agent system
    // this.tribe = tribe;
  }

  couldBeCandidate() {
    const neighbors = this.grid.getNeighbors(this.tile.q, this.tile.r);

    // For now the only condition is at least 1 of its neighbors are crystallized.
    return neighbors.some((n) => n.state === STATE_SPACE.CRYSTALLIZED);
  }

  aggregate(rho = 0.7) {
    if (!this.alive) return false;
    if (this.tile.state == STATE_SPACE.CRYSTALLIZED) return false;

    if (this.couldBeCandidate()) {
      this.tile.state = STATE_SPACE.CANDIDATE;

      // Sticking probability check
      if (random() < rho) {
        this.tile.state = STATE_SPACE.CRYSTALLIZED;
        this.tile.level = LEVEL.HOUSE;
        this.alive = false;
        return true;
      }
    }
    return false;
  }

  promote() {
    if (!this.alive) return false;
    if (this.tile.state != STATE_SPACE.CRYSTALLIZED) return false;

    if (this.tile.canPromote(this.grid)) {
      this.tile.level = EVOLUTION[this.tile.level].next;
    }
  }

  draw() {
    if (!this.alive) return;

    push();
    fill(255, 100, 100);
    noStroke();
    circle(this.tile.x, this.tile.z, this.grid.tileSize * 0.5); // Using z for 2D depth
    pop();
  }

  getServiceScore(tile) {
    let score = 0;
    for (const other of this.grid.tiles) {
      if (other.state !== STATE_SPACE.CRYSTALLIZED) continue;
      if (other.level < LEVEL.HOUSE) continue;

      const dist = this.grid.hexDistance(tile, other);
      const range = SERVICE_RANGE[other.level];

      if (dist <= range) {
        score += range - dist + 1;
      }
    }

    // Boost cells closer to center
    // This is helpful at the beginning when there is only the center cell
    if (score === 0) {
      const centerQ = floor(this.grid.nCols / 2);
      const centerR = floor(this.grid.nRows / 2);
      const centerTile = this.grid.getTile(centerQ, centerR);
      score += 1 / this.grid.hexDistance(tile, centerTile);
    }

    // console.log("getServiceScore", tile, score);

    return score;
  }

  walk() {
    if (!this.alive) return;

    const neighbors = this.grid.getNeighbors(this.tile.q, this.tile.r);
    if (neighbors.length === 0) return;

    if (random() < controls.biasedWalkChance) {
      const scored = neighbors.map((n) => ({
        tile: n,
        score: this.getServiceScore(n)
      }));
      scored.sort((a, b) => b.score - a.score);
      this.tile = scored[0].tile;
    } else {
      this.tile = random(neighbors);
    }
  }
}

class Grid {
  constructor(nRows, nCols, tileSize) {
    this.nRows = nRows;
    this.nCols = nCols;
    this.tileSize = tileSize;
    this.tiles = [];

    this.colSpacing = 1.5 * tileSize;
    this.rowSpacing = sqrt(3) * tileSize;

    this._createTiles();

    this.agents = [];
  }

  _createTiles() {
    for (let r = 0; r < this.nRows; r++) {
      for (let q = 0; q < this.nCols; q++) {
        this.tiles.push(new Tile(q, r, this.tileSize));
      }
    }
  }

  // Get tile by hex coordinates
  getTile(q, r) {
    if (q < 0 || q >= this.nCols || r < 0 || r >= this.nRows) {
      return null;
    }
    return this.tiles[r * this.nCols + q];
  }

  // Get 6 neighbors (hex adjacency for odd-q flat-top)
  getNeighbors(q, r) {
    const isOddCol = q % 2 === 1;
    const directions = isOddCol
      ? [
          [+1, 0],
          [+1, +1],
          [0, +1],
          [-1, +1],
          [-1, 0],
          [0, -1]
        ] // odd column
      : [
          [+1, -1],
          [+1, 0],
          [0, +1],
          [-1, 0],
          [-1, -1],
          [0, -1]
        ]; // even column

    return directions
      .map(([dq, dr]) => this.getTile(q + dq, r + dr))
      .filter((tile) => tile !== null);
  }

  draw(offsetX = 0, offsetY = 0) {
    push();
    translate(offsetX, offsetY);
    for (const tile of this.tiles) {
      tile.draw();
    }
    pop();
  }

  init() {
    for (const tile of this.tiles) {
      tile.init();
    }
  }

  spawnAgent() {
    // Spawn on random edge tile (simulates agents arriving from outside)
    const edge = this._getRandomEdgeTile();
    if (edge && edge.state !== STATE_SPACE.CRYSTALLIZED) {
      const agent = new Agent(this, edge);
      this.agents.push(agent);
      return agent;
    }
    return null;
  }

  _getRandomEdgeTile() {
    const edgeTiles = [];
    for (let q = 0; q < this.nCols; q++) {
      edgeTiles.push(this.getTile(q, 0)); // top
      edgeTiles.push(this.getTile(q, this.nRows - 1)); // bottom
    }
    for (let r = 1; r < this.nRows - 1; r++) {
      edgeTiles.push(this.getTile(0, r)); // left
      edgeTiles.push(this.getTile(this.nCols - 1, r)); // right
    }
    return random(edgeTiles.filter((t) => t !== null));
  }

  // Seed initial crystallized cell (DLA needs a starting point)
  seedCenter() {
    const centerQ = floor(this.nCols / 2);
    const centerR = floor(this.nRows / 2);
    const centerTile = this.getTile(centerQ, centerR);
    if (centerTile) {
      centerTile.state = STATE_SPACE.CRYSTALLIZED;
      centerTile.level = LEVEL.HOUSE;
    }
  }

  offsetToCube(q, r) {
    const x = q;
    const z = r - (q - (q & 1)) / 2;
    const y = -x - z;
    return { x, y, z };
  }

  // Hex distance between two tiles
  hexDistance(tile1, tile2) {
    const a = this.offsetToCube(tile1.q, tile1.r);
    const b = this.offsetToCube(tile2.q, tile2.r);
    return Math.max(
      Math.abs(a.x - b.x),
      Math.abs(a.y - b.y),
      Math.abs(a.z - b.z)
    );
  }

  // Get all tiles within range of a tile
  getTilesInRange(q, r, range) {
    const center = this.getTile(q, r);
    if (!center) return [];

    return this.tiles.filter((tile) => {
      return this.hexDistance(center, tile) <= range;
    });
  }

  evolveAll() {
    let evolved = 0;

    // Collect tiles that should evolve (double-buffer to avoid order dependency)
    // Skip tiles that are currently morphing to prevent duplicate promotions
    const toEvolve = this.tiles.filter((t) => t.morphProgress >= 1.0 && t.canPromote(this));

    // Apply evolution with morphing
    for (const tile of toEvolve) {
      tile.setTargetLevel(EVOLUTION[tile.level].next);
      evolved++;
    }

    return evolved;
  }

  canDieFromCompetition(tile, grid) {
    const range = SERVICE_RANGE[tile.level];
    const competitors = grid
      .getTilesInRange(tile.q, tile.r, range)
      .filter((t) => t !== tile && t.level === tile.level);

    const MAX_COMPETITORS = {
      [LEVEL.HOUSE]: 4,
      [LEVEL.SHOP]: 2,
      [LEVEL.TOWER]: 1,
      [LEVEL.FACTORY]: 0
    };
    return competitors.length > MAX_COMPETITORS[tile.level];
  }

  isServedBy(tile) {
    // Top level could only die because of competition
    if (tile.level >= LEVEL.FACTORY)
      return !this.canDieFromCompetition(tile, this);

    // Check if any higher-level entity serves this tile
    for (const other of this.tiles) {
      if (other === tile) continue;
      if (other.state !== STATE_SPACE.CRYSTALLIZED) continue;
      if (other.level <= tile.level) continue;

      const dist = this.hexDistance(tile, other);
      if (dist <= SERVICE_RANGE[other.level]) {
        return true;
      }
    }
    return false;
  }

  decayPass() {
    const toDemote = [];

    // Start decay after 10 entities are crrated
    if (this.tiles.filter((t) => t.state != STATE_SPACE.EMPTY).length <= 10)
      return;

    for (const tile of this.tiles) {
      if (tile.state !== STATE_SPACE.CRYSTALLIZED) continue;
      
      // Skip tiles that are currently morphing to prevent cascade decay
      if (tile.morphProgress < 1.0) continue;

      // Service starvation check
      if (!this.isServedBy(tile) && random() < controls.decayProb) {
        toDemote.push(tile);
      }
    }

    // Apply demotions with morphing
    for (const tile of toDemote) {
      const newLevel = tile.level - 1;
      if (newLevel < LEVEL.HOUSE) {
        tile.setTargetLevel(LEVEL.EMPTY);
        // State will be set to EMPTY when morph completes (in updateMorphing)
      } else {
        tile.setTargetLevel(newLevel);
      }
    }

    return toDemote.length;
  }
}

// Preload font for WEBGL text rendering
function preload() {
  // Load a Google Font (Roboto Mono) for text rendering in WEBGL
  textFontLoaded = loadFont("RobotoMono-VariableFont_wght.ttf");
}

function setup() {
  createCanvas(CANVAS_SIZE, CANVAS_SIZE, WEBGL); // Add WEBGL for 3D rendering

  // Set random seed for reproducible patterns
  randomSeed(controls.seed);

  // Initialize 3D systems
  geometryManager = new GeometryManager();
  cameraController = new CameraController();

  size = CELL_RADIUS / 2;
  const colSpacing = 1.5 * size;
  const rowSpacing = sqrt(3) * size;
  const margin = size; // margin from edge

  // Calculate max cells that fit
  cols = floor((CANVAS_SIZE - 2 * margin) / colSpacing) + 1;
  rows = floor((CANVAS_SIZE - 2 * margin - rowSpacing / 2) / rowSpacing) + 1; // account for odd-col offset

  grid = new Grid(rows, cols, size);
  grid.seedCenter();

  // setupControls();
}

function updateHoveredTile() {
  // In WEBGL mode, mouse coordinates are relative to center
  // Convert back to tile space
  const localX = mouseX - width / 2;
  const localY = mouseY - height / 2;

  hoveredTile = null;

  for (const tile of grid.tiles) {
    if (tile.contains(localX, localY)) {
      hoveredTile = tile;
      break;
    }
  }
}

function drawHexagon(cx, cy, r) {
  beginShape();
  for (let i = 0; i < 6; i++) {
    const angle = (i * PI) / 3;
    vertex(cx + r * cos(angle), cy + r * sin(angle));
  }
  endShape(CLOSE);
}

function makeGrid() {
  const colSpacing = 1.5 * size;
  const rowSpacing = sqrt(3) * size;
  const oddColOffset = rowSpacing / 2;

  for (let r = 0; r < rows; r++) {
    for (let q = 0; q < cols; q++) {
      const x = colSpacing * q;
      const y = rowSpacing * r + (q % 2) * oddColOffset;
      drawHexagon(x, y, size);
    }
  }
}

function drawHUD() {
  if (!hoveredTile) return;

  push();
  fill(255);
  noStroke();
  textFont(textFontLoaded); // Set loaded font for WEBGL mode
  textSize(14);
  textAlign(LEFT, TOP);

  const levelNames = ["Empty", "House", "Shop", "Tower", "Factory"];
  const stateNames = ["Empty", "Candidate", "Crystallized"];

  const info = [
    `Tile: (${hoveredTile.q}, ${hoveredTile.r})`,
    `State: ${stateNames[hoveredTile.state]}`,
    `Level: ${levelNames[hoveredTile.level]}`,
    `Range: ${SERVICE_RANGE[hoveredTile.level]}`
  ];

  text(info.join("\n"), 10, 10);
  pop();
}

function drawLegend() {
  const padding = 10;
  const swatchSize = 16;
  const lineHeight = 24;
  const legendWidth = 100;

  const levels = [
    { level: LEVEL.HOUSE, name: "House" },
    { level: LEVEL.SHOP, name: "Shop" },
    { level: LEVEL.TOWER, name: "Tower" },
    { level: LEVEL.FACTORY, name: "Factory" }
  ];

  const legendHeight = levels.length * lineHeight + padding * 2;
  const x = width - legendWidth - padding;
  const y = padding;

  push();

  // Background
  fill(0, 0, 0, 180);
  noStroke();
  rect(x, y, legendWidth, legendHeight, 4);

  // Entries
  textFont(textFontLoaded); // Set loaded font for WEBGL mode
  textSize(12);
  textAlign(LEFT, CENTER);

  for (let i = 0; i < levels.length; i++) {
    const entry = levels[i];
    const entryY = y + padding + i * lineHeight + lineHeight / 2;

    // Color swatch
    fill(LEVEL_COLORS[entry.level]);
    stroke(80);
    strokeWeight(1);
    rect(x + padding, entryY - swatchSize / 2, swatchSize, swatchSize, 2);

    // Label
    fill(255);
    noStroke();
    text(entry.name, x + padding + swatchSize + 8, entryY);
  }

  pop();
}

function setupControls() {
  const panelWidth = 210;
  const panelHeight = 8 * 36 + 100; // 8 sliders + seed input + buttons
  const padding = 10;
  const panelX = width - panelWidth - padding;
  const panelY = height - panelHeight - padding;
  const sliderWidth = 120;
  const lineHeight = 36;

  const params = [
    { key: "spawnRate", label: "Spawn Rate", min: 1, max: 20, step: 1 },
    { key: "maxAgents", label: "Max Agents", min: 10, max: 200, step: 10 },
    { key: "stickingProb", label: "Stick Prob", min: 0.1, max: 1.0, step: 0.1 },
    { key: "evolveRate", label: "Evolve Rate", min: 5, max: 60, step: 5 },
    { key: "shadowFactor", label: "Shadow", min: 0.0, max: 2.0, step: 0.1 },
    {
      key: "biasedWalkChance",
      label: "Bias Walk",
      min: 0.0,
      max: 1.0,
      step: 0.1
    },
    { key: "decayRate", label: "Decay Rate", min: 5, max: 60, step: 5 }, // add
    { key: "decayProb", label: "Decay Prob", min: 0.0, max: 1.0, step: 0.1 }
  ];

  params.forEach((p, i) => {
    const y = panelY + i * lineHeight + 20;
    const slider = createSlider(p.min, p.max, controls[p.key], p.step);
    slider.position(panelX + 80, y);
    slider.size(sliderWidth);
    slider.input(() => {
      controls[p.key] = slider.value();
    });
    sliders[p.key] = { slider, label: p.label, y };
  });

  // Seed input
  const seedInput = createInput(controls.seed.toString());
  seedInput.position(panelX + 60, panelY + params.length * lineHeight + 30);
  seedInput.size(50);
  seedInput.attribute('placeholder', 'Seed');

  // Pause button
  const pauseBtn = createButton("Pause");
  pauseBtn.position(panelX, panelY + params.length * lineHeight + 60);
  pauseBtn.mousePressed(() => {
    controls.paused = !controls.paused;
    pauseBtn.html(controls.paused ? "Resume" : "Pause");
  });

  // Reset button
  const resetBtn = createButton("Reset");
  resetBtn.position(panelX + 60, panelY + params.length * lineHeight + 60);
  resetBtn.mousePressed(() => {
    const newSeed = parseInt(seedInput.value()) || controls.seed;
    controls.seed = newSeed;
    randomSeed(controls.seed);
    grid = new Grid(rows, cols, size);
    grid.seedCenter();
  });
}

function drawControls() {
  const panelWidth = 210;
  const panelHeight = Object.keys(sliders).length * 36 + 100;
  const padding = 10;
  const panelX = width - panelWidth - padding;
  const panelY = height - panelHeight - padding;

  push();

  // Background
  fill(0, 0, 0, 200);
  noStroke();
  rect(panelX - 5, panelY - 5, panelWidth, panelHeight, 4);

  // Title
  fill(255);
  textFont(textFontLoaded); // Set loaded font for WEBGL mode
  textSize(12);
  textAlign(LEFT, TOP);

  // Labels and values
  textSize(11);
  for (const key in sliders) {
    const s = sliders[key];
    const val = controls[key];
    const displayVal = Number.isInteger(val) ? val : val.toFixed(1);

    fill(180);
    textAlign(LEFT, CENTER);
    text(s.label, panelX, s.y + 10);

    fill(255);
    textAlign(RIGHT, CENTER);
    text(displayVal, panelX + panelWidth - 10, s.y + 10);
  }

  // Seed label
  fill(180);
  textAlign(LEFT, CENTER);
  textSize(11);
  text("Seed", panelX, panelY + Object.keys(sliders).length * 36 + 40);

  // Stats
  const statsY = panelY + Object.keys(sliders).length * 36 + 85;
  fill(100);
  textAlign(LEFT, TOP);
  textSize(10);

  const crystallized = grid.tiles.filter(
    (t) => t.state === STATE_SPACE.CRYSTALLIZED
  ).length;
  const stats = [
    `Agents: ${grid.agents.length}`,
    `Buildings: ${crystallized}`,
    `FPS: ${floor(frameRate())}`
  ];
  text(stats.join("  |  "), panelX, statsY);

  pop();
}

function draw() {
  background(5, 5, 16); // near-black with a hint of blue

  // Update camera
  cameraController.update();

  // Studio-style lighting for clean look
  ambientLight(180, 180, 180);
  directionalLight(255, 255, 255, 0.3, -1, -0.3);
  directionalLight(200, 200, 200, -0.3, -0.5, 0.5);

  if (!controls.paused) {
    // Spawn new agent occasionally
    if (
      frameCount % controls.spawnRate === 0 &&
      grid.agents.length < controls.maxAgents
    ) {
      grid.spawnAgent();
    }

    // Update agents
    for (const agent of grid.agents) {
      agent.walk();
      agent.aggregate(controls.stickingProb);
    }

    // Remove dead agents
    grid.agents = grid.agents.filter((a) => a.alive);

    // Evolution pass
    if (frameCount % controls.evolveRate === 0) {
      grid.evolveAll();
    }

    // Decay pass
    if (frameCount % controls.decayRate === 0) {
      grid.decayPass();
    }

    // Update all morphing animations
    for (const tile of grid.tiles) {
      tile.updateMorphing();
    }
  }

  // Center the grid in 3D space
  push();
  // Calculate grid center offset
  const centerX = (cols * 1.5 * size) / 2;
  const centerZ = (rows * sqrt(3) * size) / 2;
  translate(-centerX, 0, -centerZ);

  // Draw ground plane for reference
  push();
  fill("rgb(25, 15, 60)"); // Deep violet ground
  noStroke();
  translate(centerX, 1, centerZ);
  rotateX(PI / 2);
  plane(CANVAS_SIZE * 1.2, CANVAS_SIZE * 1.2);
  pop();

  // Draw 3D tiles - only draw crystallized tiles for performance
  for (const tile of grid.tiles) {
    if (tile.state === STATE_SPACE.CRYSTALLIZED || tile.level > LEVEL.EMPTY) {
      tile.draw3D();
    }
  }

  // Draw agents as 3D spheres - simplified
  for (const agent of grid.agents) {
    push();
    translate(agent.tile.x, -5, agent.tile.z);
    fill(255, 100, 100);
    noStroke();
    sphere(grid.tileSize * 0.2, 8, 6); // Lower detail sphere
    pop();
  }

  pop();

  // Switch to 2D for UI overlay
  push();
  camera(); // Reset to default orthographic camera
  resetMatrix();

  // Translate to top-left corner for 2D UI
  translate(-width / 2, -height / 2);

  // Update hover state (for 2D UI)
  updateHoveredTile();

  // Draw 2D UI elements
  drawHUD();
  drawLegend();
  drawControls();

  pop();
}

// Mouse event handlers for camera control
function mousePressed() {
  cameraController.startDrag();
}

function mouseReleased() {
  cameraController.stopDrag();
}

function mouseDragged() {
  cameraController.handleDrag(mouseX, mouseY, pmouseX, pmouseY);
}

function mouseWheel(event) {
  cameraController.handleZoom(event.delta);
  return false; // Prevent page scroll
}

// Genetic Algorithm - Evolving GENUARY Grid
// Adapted from Daniel Shiffman's Evolving Shakespeare

const FONT = {
  G: [
    [1, 1, 1],
    [1, 0, 0],
    [1, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
  E: [
    [1, 1, 1],
    [1, 0, 0],
    [1, 1, 0],
    [1, 0, 0],
    [1, 1, 1],
  ],
  N: [
    [1, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [1, 0, 1],
    [1, 0, 1],
  ],
  U: [
    [1, 0, 1],
    [1, 0, 1],
    [1, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
  A: [
    [0, 1, 0],
    [1, 0, 1],
    [1, 1, 1],
    [1, 0, 1],
    [1, 0, 1],
  ],
  R: [
    [1, 1, 0],
    [1, 0, 1],
    [1, 1, 0],
    [1, 0, 1],
    [1, 0, 1],
  ],
  Y: [
    [1, 0, 1],
    [1, 0, 1],
    [0, 1, 0],
    [0, 1, 0],
    [0, 1, 0],
  ],
};

const layout = ["GENUARY"];
const letterSpacing = 1;
const rowSpacing = 1;

let target; // 2D array of 0s and 1s
let targetRows, targetCols;
let targetDensity; // ratio of 1s in target
let population;
let mutationRate = 0.02;
let popmax = 100;
let pixelSize = 14;

// Population grid display settings
const popGridCols = 5;
const popGridRows = 15;
const popPixelSize = 10; // smaller pixels for population view
const popGapX = 15; // horizontal gap between grids
const popGapY = 5; // vertical gap between grids

// Wave effect state
let waveActive = false;
let waveIndex = 0;
let waveFrameCount = 0;
const waveSpeed = 2; // frames between each grid turning green

function buildTargetGrid() {
  // Calculate dimensions
  let maxLettersPerRow = 0;
  for (const line of layout) {
    maxLettersPerRow = max(maxLettersPerRow, line.length);
  }

  targetCols = maxLettersPerRow * 3 + (maxLettersPerRow - 1) * letterSpacing;
  targetRows = layout.length * 5 + (layout.length - 1) * rowSpacing;

  // Initialize with zeros
  target = [];
  for (let r = 0; r < targetRows; r++) {
    target[r] = [];
    for (let c = 0; c < targetCols; c++) {
      target[r][c] = 0;
    }
  }

  // Fill in the letters
  let yOffset = 0;
  let onesCount = 0;
  for (const line of layout) {
    for (let row = 0; row < 5; row++) {
      let xOffset = 0;
      for (const char of line) {
        const letter = FONT[char];
        if (letter) {
          for (let col = 0; col < letter[row].length; col++) {
            if (letter[row][col] === 1) {
              target[yOffset + row][xOffset + col] = 1;
              onesCount++;
            }
          }
        }
        xOffset += 3 + letterSpacing;
      }
    }
    yOffset += 5 + rowSpacing;
  }

  // Calculate target density (for smarter initialization)
  targetDensity = onesCount / (targetRows * targetCols);
}

function setup() {
  frameRate(30);
  buildTargetGrid();

  // Calculate canvas size
  let bestGridWidth = targetCols * pixelSize;
  let bestGridHeight = targetRows * pixelSize;

  // Population grid dimensions
  let popItemWidth = targetCols * popPixelSize;
  let popItemHeight = targetRows * popPixelSize;
  let popTotalWidth = popGridCols * popItemWidth + (popGridCols - 1) * popGapX;
  let popTotalHeight =
    popGridRows * popItemHeight + (popGridRows - 1) * popGapY;

  let canvasWidth = bestGridWidth + popTotalWidth + 80;
  let canvasHeight = max(bestGridHeight + 120, popTotalHeight + 60);

  createCanvas(canvasWidth, canvasHeight);

  population = new Population(target, mutationRate, popmax, targetDensity);
}

function draw() {
  background(30);

  // Only evolve if not finished
  if (!population.isFinished()) {
    population.naturalSelection();
    population.generate();
    population.calcFitness();
    population.evaluate();
  }

  let bestGridWidth = targetCols * pixelSize;
  let bestGridHeight = targetRows * pixelSize;

  // LEFT COLUMN: Best individual
  push();
  translate(10, 20);
  fill(255);
  noStroke();
  textSize(12);
  text("BEST", 0, -8);
  let bestGrid = population.getBest();
  drawGrid(bestGrid, pixelSize, color(0, 200, 100));
  pop();

  // Stats below best
  let statsY = bestGridHeight + 40;
  fill(255);
  noStroke();
  textSize(11);
  textFont("monospace");

  let fitness = population.getBestFitness();
  let accuracy = (fitness * 100).toFixed(1);

  text(`Gen: ${population.getGenerations()}`, 10, statsY);
  text(`Acc: ${accuracy}%`, 10, statsY + 15);
  text(
    `Avg: ${(population.getAverageFitness() * 100).toFixed(1)}%`,
    10,
    statsY + 30
  );

  // Fitness bar
  let barWidth = bestGridWidth;
  stroke(100);
  noFill();
  rect(10, statsY + 40, barWidth, 10);
  noStroke();
  fill(0, 200, 100);
  rect(10, statsY + 40, barWidth * fitness, 10);

  // RIGHT COLUMN: Population grid (5x4 = 20 individuals)
  let popItemWidth = targetCols * popPixelSize;
  let popItemHeight = targetRows * popPixelSize;
  let startX = bestGridWidth + 40;
  let startY = 20;

  fill(255);
  noStroke();
  textSize(12);
  text("POPULATION", startX, startY - 8);

  let individuals = population.getPopulation();
  let dispalyCount = individuals.length;
  let displayCount = min(popGridCols * popGridRows, individuals.length);

  // Update wave effect
  if (waveActive && waveIndex < displayCount) {
    waveFrameCount++;
    if (waveFrameCount >= waveSpeed) {
      waveFrameCount = 0;
      waveIndex++;
    }
  }

  for (let i = 0; i < displayCount; i++) {
    let col = i % popGridCols;
    let row = floor(i / popGridCols);
    let x = startX + col * (popItemWidth + popGapX);
    let y = startY + row * (popItemHeight + popGapY);

    push();
    translate(x, y);

    // Determine which grid and color to use
    let gridToShow;
    let gridColor;

    if (waveActive && i < waveIndex) {
      // Already turned: show best grid in green
      gridToShow = bestGrid;
      gridColor = color(0, 200, 100);
    } else {
      // Not yet turned: show individual's grid in blue
      gridToShow = individuals[i].getGrid();
      gridColor = color(100, 150, 255);
    }

    drawGrid(gridToShow, popPixelSize, gridColor);
    pop();
  }

  // Start wave effect when finished
  if (population.isFinished() && !waveActive) {
    waveActive = true;
    waveIndex = 0;
    waveFrameCount = 0;
  }

  // Show message and stop when wave is complete
  if (waveActive && waveIndex >= displayCount) {
    fill(0, 255, 100);
    textSize(16);
    text("HAPPY GENUARY!", 10, statsY + 70);
    noLoop();
  }
}

function drawGrid(grid, size, onColor) {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === 1) {
        fill(onColor);
      } else {
        fill(40);
      }
      noStroke();
      rect(c * size, r * size, size - 1, size - 1);
    }
  }
}

// Keyboard controls
function keyPressed() {
  if (key === " ") {
    // Toggle pause/play
    if (isLooping()) {
      noLoop();
    } else {
      loop();
    }
  }
  if (key === "r" || key === "R") {
    // Reset
    population = new Population(target, mutationRate, popmax, targetDensity);
    waveActive = false;
    waveIndex = 0;
    waveFrameCount = 0;
    loop();
  }
}

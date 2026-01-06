// Genetic Algorithm - Grid Population
// A population of binary grids evolving toward a target

class Population {
  constructor(target, mutationRate, num, density = 0.5) {
    this.target = target; // 2D target grid
    this.mutationRate = mutationRate;
    this.generations = 0;
    this.finished = false;
    this.perfectScore = 1;
    this.density = density; // target density for initialization

    this.rows = target.length;
    this.cols = target[0].length;

    // Create initial population with biased density
    this.population = [];
    for (let i = 0; i < num; i++) {
      this.population[i] = new DNA(this.rows, this.cols, null, density);
    }

    this.matingPool = [];
    this.bestDNA = this.population[0];
    this.bestFitness = 0;
    this.bestRawFitness = 0;

    this.calcFitness();
  }

  // Calculate fitness for all individuals
  calcFitness() {
    for (let i = 0; i < this.population.length; i++) {
      this.population[i].calcFitness(this.target);
    }
  }

  // Generate mating pool based on fitness (tournament selection)
  naturalSelection() {
    this.matingPool = [];

    // Find max fitness for normalization
    let maxFitness = 0;
    for (let i = 0; i < this.population.length; i++) {
      if (this.population[i].fitness > maxFitness) {
        maxFitness = this.population[i].fitness;
      }
    }

    // Add to mating pool based on normalized fitness
    for (let i = 0; i < this.population.length; i++) {
      let fitness = maxFitness > 0 ? this.population[i].fitness / maxFitness : 0;
      let n = floor(fitness * 100) + 1;
      for (let j = 0; j < n; j++) {
        this.matingPool.push(this.population[i]);
      }
    }
  }

  // Create next generation with elitism
  generate() {
    // Sort by fitness (descending)
    let sorted = this.population.slice().sort((a, b) => b.fitness - a.fitness);

    // Keep top 5% (elitism)
    let eliteCount = max(1, floor(this.population.length * 0.05));

    let newPopulation = [];

    // Preserve elites
    for (let i = 0; i < eliteCount; i++) {
      newPopulation.push(sorted[i]);
    }

    // Fill rest with children
    for (let i = eliteCount; i < this.population.length; i++) {
      let a = floor(random(this.matingPool.length));
      let b = floor(random(this.matingPool.length));
      let partnerA = this.matingPool[a];
      let partnerB = this.matingPool[b];
      let child = partnerA.crossover(partnerB, this.density);
      child.mutate(this.mutationRate);
      newPopulation.push(child);
    }

    this.population = newPopulation;
    this.generations++;
  }

  // Find the best individual
  evaluate() {
    let worldrecord = 0;
    let index = 0;

    for (let i = 0; i < this.population.length; i++) {
      if (this.population[i].fitness > worldrecord) {
        index = i;
        worldrecord = this.population[i].fitness;
      }
    }

    this.bestDNA = this.population[index];
    this.bestFitness = worldrecord;

    // Calculate raw fitness for display
    let score = 0;
    let total = this.rows * this.cols;
    let grid = this.bestDNA.getGrid();
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (grid[r][c] === this.target[r][c]) {
          score++;
        }
      }
    }
    this.bestRawFitness = score / total;

    if (this.bestRawFitness >= 0.999) {
      this.finished = true;
    }
  }

  getBest() {
    return this.bestDNA.getGrid();
  }

  getBestFitness() {
    return this.bestRawFitness; // Return raw for display
  }

  isFinished() {
    return this.finished;
  }

  getGenerations() {
    return this.generations;
  }

  getPopulation() {
    return this.population;
  }

  getAverageFitness() {
    let total = 0;
    for (let i = 0; i < this.population.length; i++) {
      // Calculate raw fitness for display
      let score = 0;
      let grid = this.population[i].getGrid();
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (grid[r][c] === this.target[r][c]) {
            score++;
          }
        }
      }
      total += score / (this.rows * this.cols);
    }
    return total / this.population.length;
  }
}

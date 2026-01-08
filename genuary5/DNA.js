// Genetic Algorithm - Grid DNA
// Each individual is a 2D grid of 0s and 1s

class DNA {
  constructor(rows, cols, genes = null, density = 0.5) {
    this.rows = rows;
    this.cols = cols;
    this.fitness = 0;

    if (genes) {
      // Use provided genes
      this.genes = genes;
    } else {
      // Smart initialization: use target density to bias initial population
      this.genes = [];
      for (let r = 0; r < rows; r++) {
        this.genes[r] = [];
        for (let c = 0; c < cols; c++) {
          // Initialize with same density as target
          this.genes[r][c] = random() < density ? 1 : 0;
        }
      }
    }
  }

  // Get the grid
  getGrid() {
    return this.genes;
  }

  // Fitness function: percentage of pixels matching target
  // Using exponential scaling to reward higher matches more
  calcFitness(target) {
    let score = 0;
    let total = this.rows * this.cols;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.genes[r][c] === target[r][c]) {
          score++;
        }
      }
    }

    let rawFitness = score / total;
    // Exponential scaling to increase selection pressure
    this.fitness = pow(rawFitness, 4);
  }

  // Crossover: combine two parents to create child
  crossover(partner, density) {
    // Create empty child genes
    let childGenes = [];
    for (let r = 0; r < this.rows; r++) {
      childGenes[r] = [];
    }

    // Uniform crossover works best for grids
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (random() < 0.5) {
          childGenes[r][c] = this.genes[r][c];
        } else {
          childGenes[r][c] = partner.genes[r][c];
        }
      }
    }

    return new DNA(this.rows, this.cols, childGenes, density);
  }

  // Mutation: flip random bits
  mutate(mutationRate) {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (random() < mutationRate) {
          // Flip the bit
          this.genes[r][c] = this.genes[r][c] === 1 ? 0 : 1;
        }
      }
    }
  }
}

// GeometryManager: Handles 3D geometry creation for all entity levels
// All shapes use 24 vertices for morphing compatibility

class GeometryManager {
  constructor() {
    this.geometries = {};
    this._buildAllGeometries();
  }

  _buildAllGeometries() {
    // Build geometry for each level
    this.geometries[LEVEL.EMPTY] = this._createEmptyGeometry();
    this.geometries[LEVEL.HOUSE] = this._createHouseGeometry();
    this.geometries[LEVEL.SHOP] = this._createShopGeometry();
    this.geometries[LEVEL.TOWER] = this._createTowerGeometry();
    this.geometries[LEVEL.FACTORY] = this._createFactoryGeometry();
  }

  getGeometry(level) {
    return this.geometries[level];
  }

  // Empty: Flat hexagon at ground level (24 vertices)
  _createEmptyGeometry() {
    const vertices = [];
    const normals = [];
    const radius = 8;  // Scale up to match building sizes

    // Top ring (12 vertices in hexagonal pattern)
    for (let i = 0; i < 12; i++) {
      const angle = (i * TWO_PI) / 12;
      const r = (i % 2 === 0) ? radius : radius * 0.95;
      vertices.push(createVector(
        cos(angle) * r,
        0.01, // Slightly above ground to avoid z-fighting
        sin(angle) * r
      ));
      normals.push(createVector(0, 1, 0));
    }

    // Bottom ring (12 vertices, same as top for flat shape)
    for (let i = 0; i < 12; i++) {
      const angle = (i * TWO_PI) / 12;
      const r = (i % 2 === 0) ? radius : radius * 0.95;
      vertices.push(createVector(
        cos(angle) * r,
        0,
        sin(angle) * r
      ));
      normals.push(createVector(0, -1, 0));
    }

    const indices = this._generateHexIndices();
    const color = "rgb(69, 6, 147)"; // Dark purple for empty

    return { vertices, normals, indices, color };
  }

  // House: Small box (24 vertices)
  _createHouseGeometry() {
    const vertices = [];
    const normals = [];
    const w = 6;  // Width
    const h = 15; // Height

    // Top face (12 vertices in circular pattern)
    for (let i = 0; i < 12; i++) {
      const angle = (i * TWO_PI) / 12;
      vertices.push(createVector(
        cos(angle) * w,
        -h,  // Negative Y = upward in WEBGL
        sin(angle) * w
      ));
      // Normal points outward and up slightly
      const normal = createVector(cos(angle), -0.3, sin(angle));
      normals.push(normal.normalize());
    }

    // Bottom face (12 vertices at ground level)
    for (let i = 0; i < 12; i++) {
      const angle = (i * TWO_PI) / 12;
      vertices.push(createVector(
        cos(angle) * w,
        0,  // Ground level
        sin(angle) * w
      ));
      // Normal points outward and down slightly
      const normal = createVector(cos(angle), 0.3, sin(angle));
      normals.push(normal.normalize());
    }

    const indices = this._generateCylinderIndices();
    const color = LEVEL_COLORS[LEVEL.HOUSE];

    return { vertices, normals, indices, color };
  }

  // Shop: Taller box (24 vertices)
  _createShopGeometry() {
    const vertices = [];
    const normals = [];
    const w = 7;  // Width
    const h = 25; // Height - taller than house

    // Top face (12 vertices)
    for (let i = 0; i < 12; i++) {
      const angle = (i * TWO_PI) / 12;
      vertices.push(createVector(
        cos(angle) * w,
        -h,  // Negative Y = upward
        sin(angle) * w
      ));
      const normal = createVector(cos(angle), -0.3, sin(angle));
      normals.push(normal.normalize());
    }

    // Bottom face (12 vertices at ground level)
    for (let i = 0; i < 12; i++) {
      const angle = (i * TWO_PI) / 12;
      vertices.push(createVector(
        cos(angle) * w,
        0,  // Ground level
        sin(angle) * w
      ));
      const normal = createVector(cos(angle), 0.3, sin(angle));
      normals.push(normal.normalize());
    }

    const indices = this._generateCylinderIndices();
    const color = LEVEL_COLORS[LEVEL.SHOP];

    return { vertices, normals, indices, color };
  }

  // Tower: Taller box (24 vertices)
  _createTowerGeometry() {
    const vertices = [];
    const normals = [];
    const w = 7;  // Width
    const h = 40; // Height - taller than shop

    // Top face (12 vertices)
    for (let i = 0; i < 12; i++) {
      const angle = (i * TWO_PI) / 12;
      vertices.push(createVector(
        cos(angle) * w,
        -h,  // Negative Y = upward
        sin(angle) * w
      ));
      const normal = createVector(cos(angle), -0.3, sin(angle));
      normals.push(normal.normalize());
    }

    // Bottom face (12 vertices at ground level)
    for (let i = 0; i < 12; i++) {
      const angle = (i * TWO_PI) / 12;
      vertices.push(createVector(
        cos(angle) * w,
        0,  // Ground level
        sin(angle) * w
      ));
      const normal = createVector(cos(angle), 0.3, sin(angle));
      normals.push(normal.normalize());
    }

    const indices = this._generateCylinderIndices();
    const color = LEVEL_COLORS[LEVEL.TOWER];

    return { vertices, normals, indices, color };
  }

  // Factory: Tallest box with wider base (24 vertices)
  _createFactoryGeometry() {
    const vertices = [];
    const normals = [];
    const w = 8;  // Width - wider than tower
    const h = 50; // Height - tallest building

    // Top face (12 vertices)
    for (let i = 0; i < 12; i++) {
      const angle = (i * TWO_PI) / 12;
      vertices.push(createVector(
        cos(angle) * w,
        -h,  // Negative Y = upward
        sin(angle) * w
      ));
      const normal = createVector(cos(angle), -0.3, sin(angle));
      normals.push(normal.normalize());
    }

    // Bottom face (12 vertices at ground level)
    for (let i = 0; i < 12; i++) {
      const angle = (i * TWO_PI) / 12;
      vertices.push(createVector(
        cos(angle) * w,
        0,  // Ground level
        sin(angle) * w
      ));
      const normal = createVector(cos(angle), 0.3, sin(angle));
      normals.push(normal.normalize());
    }

    const indices = this._generateCylinderIndices();
    const color = LEVEL_COLORS[LEVEL.FACTORY];

    return { vertices, normals, indices, color };
  }

  // Generate indices for flat hexagon
  _generateHexIndices() {
    const indices = [];

    // Top face triangles (fan from center)
    for (let i = 0; i < 11; i++) {
      indices.push(0, i, i + 1);
    }
    indices.push(0, 11, 0); // Close the fan

    // Bottom face triangles
    for (let i = 12; i < 23; i++) {
      indices.push(12, i + 1, i);
    }
    indices.push(12, 12, 23);

    return indices;
  }

  // Generate indices for cylinder/box shapes
  _generateCylinderIndices() {
    const indices = [];

    // Top cap (fan from vertex 0)
    for (let i = 0; i < 11; i++) {
      indices.push(0, i, i + 1);
    }
    indices.push(0, 11, 0);

    // Side faces (connect top ring to bottom ring)
    for (let i = 0; i < 12; i++) {
      const top1 = i;
      const top2 = (i + 1) % 12;
      const bot1 = i + 12;
      const bot2 = ((i + 1) % 12) + 12;

      // Two triangles per quad
      indices.push(top1, bot1, top2);
      indices.push(top2, bot1, bot2);
    }

    // Bottom cap (fan from vertex 12)
    for (let i = 12; i < 23; i++) {
      indices.push(12, i + 1, i);
    }
    indices.push(12, 12, 23);

    return indices;
  }


  // Morphing support: interpolate between two geometries
  getMorphedGeometry(fromLevel, toLevel, progress) {
    const from = this.getGeometry(fromLevel);
    const to = this.getGeometry(toLevel);

    const morphed = {
      vertices: [],
      normals: [],
      indices: from.indices, // Same topology for all shapes
      color: null
    };

    // Interpolate each vertex
    for (let i = 0; i < 24; i++) {
      morphed.vertices[i] = p5.Vector.lerp(from.vertices[i], to.vertices[i], progress);
      morphed.normals[i] = p5.Vector.lerp(from.normals[i], to.normals[i], progress);
      morphed.normals[i].normalize(); // Re-normalize after interpolation
    }

    // Color interpolation
    morphed.color = lerpColor(
      color(from.color),
      color(to.color),
      progress
    );

    return morphed;
  }
}

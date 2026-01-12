// CameraController: Orbit camera with mouse controls

class CameraController {
  constructor() {
    this.distance = 600;            // Distance from target - closer for better view
    this.theta = PI / 4;            // Horizontal rotation (azimuth) - angled view
    this.phi = PI / 3;              // Vertical rotation (elevation) - 60° for better angle
    this.target = createVector(0, 0, 0); // Look-at point
    this.position = createVector(0, 0, 0); // Camera position
    this.isDragging = false;

    // Mouse sensitivity
    this.rotationSpeed = 0.01;
    this.zoomSpeed = 20;

    // Constraints
    this.minDistance = 200;
    this.maxDistance = 1500;
    this.minPhi = 0.1;              // Don't go fully vertical
    this.maxPhi = PI - 0.1;
  }

  update() {
    // Calculate camera position using spherical coordinates
    // x = r * sin(phi) * cos(theta)
    // y = r * cos(phi)
    // z = r * sin(phi) * sin(theta)

    this.position.x = this.distance * sin(this.phi) * cos(this.theta);
    this.position.y = -this.distance * cos(this.phi);  // Negative for top-down view
    this.position.z = this.distance * sin(this.phi) * sin(this.theta);

    // Apply camera transformation
    camera(
      this.position.x, this.position.y, this.position.z,  // Camera position
      this.target.x, this.target.y, this.target.z,        // Look-at point
      0, 1, 0                                             // Up vector
    );
  }

  handleDrag(mx, my, pmx, pmy) {
    if (this.isDragging) {
      // Update rotation based on mouse movement
      this.theta += (mx - pmx) * this.rotationSpeed;
      this.phi += (my - pmy) * this.rotationSpeed;

      // Constrain phi to prevent flipping
      this.phi = constrain(this.phi, this.minPhi, this.maxPhi);
    }
  }

  handleZoom(delta) {
    // Zoom in/out
    this.distance += delta * this.zoomSpeed;
    this.distance = constrain(this.distance, this.minDistance, this.maxDistance);
  }

  startDrag() {
    this.isDragging = true;
  }

  stopDrag() {
    this.isDragging = false;
  }

  // Get camera frustum for culling (simplified)
  getFrustumPlanes() {
    // Calculate view direction
    const forward = p5.Vector.sub(this.target, this.position).normalize();
    const up = createVector(0, 1, 0);
    const right = p5.Vector.cross(forward, up).normalize();
    const actualUp = p5.Vector.cross(right, forward).normalize();

    // For now, return basic planes (can be expanded for true frustum culling)
    return {
      forward,
      right,
      up: actualUp,
      position: this.position.copy()
    };
  }
}

let cols;
let rows;
let img;
let otherImg;
let size = 12;
let w;
let h;
let imgScale;
let offset = 0;
let offsetX = 0; // For centering artwork horizontally
let offsetY = 0; // For centering artwork vertically

const CANVAS_SIZE = 1080; // Instagram-optimized square
const GAP = 1; // Gap between quadrants (adjust as needed)

function preload() {
    img = loadImage("assets/tile2.jpg")
    otherImg = loadImage("assets/tile1.png")
}

function setup() {
    pixelDensity(1); // Force 1:1 pixel ratio (no Retina scaling)
    createCanvas(CANVAS_SIZE, CANVAS_SIZE);
    
    // Calculate scale to fit the 2x2 grid (4 quadrants) + gap within 1080x1080
    // Available space per quadrant = (canvas - gap) / 2
    let maxQuadrantW = (CANVAS_SIZE - GAP) / 2;
    let maxQuadrantH = (CANVAS_SIZE - GAP) / 2;
    
    // Scale to fit while maintaining aspect ratio
    let scaleW = maxQuadrantW / img.width;
    let scaleH = maxQuadrantH / img.height;
    imgScale = min(scaleW, scaleH);
    
    w = floor(img.width * imgScale);
    h = floor(img.height * imgScale);
    
    // Calculate offsets to center the artwork (including gap)
    let totalW = w * 2 + GAP;
    let totalH = h * 2 + GAP;
    offsetX = (CANVAS_SIZE - totalW) / 2;
    offsetY = (CANVAS_SIZE - totalH) / 2;
    
    // Adjust dot size to scale proportionally
    size = max(1, floor(size * imgScale));

    cols = floor(w / size);
    rows = floor(h / size);

    img.filter(GRAY);
    otherImg.filter(GRAY);
    
    // Resize images once in setup
    img.resize(w, h);
    otherImg.resize(w, h);
    
    console.log(`Canvas: ${CANVAS_SIZE}x${CANVAS_SIZE}, Artwork: ${totalW}x${totalH}, Gap: ${GAP}, Offset: (${offsetX}, ${offsetY})`);
}

function draw() {
    background(255);

    // Use push/pop to apply centering offset
    push();
    translate(offsetX, offsetY);
    
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            let x = (i * size + offset) % w;
            let y = j * size;
            let color1 = transformColor(img.get(x, y));
            let color2 = transformColor(otherImg.get(x, y));
            
            // Top left: img only
            fill(color1);
            ellipse(i * size, j * size, size, size);
            
            // Top right: otherImg only
            fill(color2);
            ellipse(w + GAP + i * size, j * size, size, size);
            
            // Bottom left: AND operation
            let colorAnd = booleanOp(color1, color2, "AND");
            fill(colorAnd);
            ellipse(i * size, h + GAP + j * size, size, size);
            
            // Bottom right: OR operation
            let colorOr = booleanOp(color1, color2, "OR");
            fill(colorOr);
            ellipse(w + GAP + i * size, h + GAP + j * size, size, size);
        }
    }
    
    pop();

    if (offset > w) {
        offset = 0;
    }

    offset += 1;
}

function transformColor(c) {
    // Threshold each channel: > 128 → 255, else → 0
    // return c
    const from = 255;
    const to = 0;
    let r = c[0] > 128 ? to : from;
    let g = c[1] > 128 ? to : from;
    let b = c[2] > 128 ? to : from;
    let a = c[3]; // Keep alpha unchanged
    return [r, g, b, a];
}

function colorfy(c) {
    const aColor = [212, 163, 128, 255] // rgb(212,163,128)   
    const bColor = [209,90,52, 255] // rgb(209, 90, 52)

    if (c[0] === 255 && c[1] === 255 && c[2] === 255) {
        return bColor;
    }
    return [255,255,255,255];
}

function booleanOp(arr1, arr2, op) {
    const ops = {
        AND: (a, b) => a & b,
        OR: (a, b) => a | b,
        XOR: (a, b) => a ^ b,
    };
    blended = arr1.map((element, index) => ops[op](element, arr2[index]));
    // return blended;
    return colorfy(blended);
}

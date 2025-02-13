const canvas = document.getElementById('whiteboard');
const context = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const brushSize = document.getElementById('brushSize');
const clearBtn = document.getElementById('clearBtn');
const undoBtn = document.getElementById('undoBtn');
const toolSelect = document.getElementById('toolSelect');
const fillShapeCheckbox = document.getElementById('fillShape');

// Set canvas size
canvas.width = window.innerWidth - 40;
canvas.height = window.innerHeight - 100;

// WebSocket connection
const ws = new WebSocket(`ws://${window.location.host}`);

// Drawing state
let isDrawing = false;
let startX = 0;
let startY = 0;
let currentShape = null;

// Undo history
const undoStack = [];
let maxUndoSteps = 20;

// Save initial canvas state
saveState();

function saveState() {
    if (undoStack.length >= maxUndoSteps) {
        undoStack.shift();
    }
    undoStack.push(canvas.toDataURL());
}

function undo() {
    if (undoStack.length > 1) {
        undoStack.pop(); // Remove current state
        const previousState = undoStack[undoStack.length - 1];
        const img = new Image();
        img.src = previousState;
        img.onload = () => {
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(img, 0, 0);
            broadcastClear();
            broadcastImage();
        };
    }
}

function drawShape(shape, x, y, startX, startY, color, size, fill) {
    context.beginPath();
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = size;

    switch (shape) {
        case 'rectangle':
            const width = x - startX;
            const height = y - startY;
            if (fill) {
                context.fillRect(startX, startY, width, height);
            } else {
                context.strokeRect(startX, startY, width, height);
            }
            break;

        case 'circle':
            const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
            context.beginPath();
            context.arc(startX, startY, radius, 0, 2 * Math.PI);
            if (fill) {
                context.fill();
            } else {
                context.stroke();
            }
            break;

        case 'line':
            context.beginPath();
            context.moveTo(startX, startY);
            context.lineTo(x, y);
            context.stroke();
            break;

        case 'triangle':
            context.beginPath();
            context.moveTo(startX, startY);
            context.lineTo(x, y);
            context.lineTo(startX - (x - startX), y);
            context.closePath();
            if (fill) {
                context.fill();
            } else {
                context.stroke();
            }
            break;

        case 'text':
            context.font = `${size * 2}px Arial`;
            if (fill) {
                context.fillText('Text', x, y);
            } else {
                context.strokeText('Text', x, y);
            }
            break;
    }
}

function draw(e) {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (toolSelect.value === 'pencil') {
        context.lineWidth = brushSize.value;
        context.lineCap = 'round';
        context.strokeStyle = colorPicker.value;

        context.beginPath();
        context.moveTo(startX, startY);
        context.lineTo(x, y);
        context.stroke();

        broadcastDraw({
            type: 'draw',
            tool: 'pencil',
            x: x,
            y: y,
            startX: startX,
            startY: startY,
            color: colorPicker.value,
            size: brushSize.value
        });

        [startX, startY] = [x, y];
    } else {
        // Preview for shapes
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempContext = tempCanvas.getContext('2d');
        
        // Copy current canvas state
        tempContext.drawImage(canvas, 0, 0);
        
        // Draw new shape
        drawShape(
            toolSelect.value,
            x,
            y,
            startX,
            startY,
            colorPicker.value,
            brushSize.value,
            fillShapeCheckbox.checked
        );

        // Clear and redraw
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(tempCanvas, 0, 0);
        
        currentShape = {
            tool: toolSelect.value,
            endX: x,
            endY: y,
            startX: startX,
            startY: startY,
            color: colorPicker.value,
            size: brushSize.value,
            fill: fillShapeCheckbox.checked
        };
    }
}

function broadcastDraw(data) {
    ws.send(JSON.stringify(data));
}

function broadcastShape(shape) {
    ws.send(JSON.stringify({
        type: 'shape',
        ...shape
    }));
}

function broadcastClear() {
    ws.send(JSON.stringify({ type: 'clear' }));
}

function broadcastImage() {
    ws.send(JSON.stringify({
        type: 'image',
        data: canvas.toDataURL()
    }));
}

// Event listeners
canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    currentShape = null;
});

canvas.addEventListener('mousemove', draw);

canvas.addEventListener('mouseup', () => {
    if (isDrawing && currentShape) {
        broadcastShape(currentShape);
        saveState();
    }
    isDrawing = false;
});

canvas.addEventListener('mouseout', () => {
    if (isDrawing && currentShape) {
        broadcastShape(currentShape);
        saveState();
    }
    isDrawing = false;
});

clearBtn.addEventListener('click', () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    broadcastClear();
    saveState();
});

undoBtn.addEventListener('click', () => {
    undo();
});

// WebSocket event handlers
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    switch (data.type) {
        case 'draw':
            context.beginPath();
            context.lineWidth = data.size;
            context.lineCap = 'round';
            context.strokeStyle = data.color;
            context.moveTo(data.startX, data.startY);
            context.lineTo(data.x, data.y);
            context.stroke();
            break;

        case 'shape':
            drawShape(
                data.tool,
                data.endX,
                data.endY,
                data.startX,
                data.startY,
                data.color,
                data.size,
                data.fill
            );
            break;

        case 'clear':
            context.clearRect(0, 0, canvas.width, canvas.height);
            break;

        case 'image':
            const img = new Image();
            img.src = data.data;
            img.onload = () => {
                context.clearRect(0, 0, canvas.width, canvas.height);
                context.drawImage(img, 0, 0);
            };
            break;
    }
};

// Handle window resize
window.addEventListener('resize', () => {
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = window.innerWidth - 40;
    canvas.height = window.innerHeight - 100;
    context.putImageData(imageData, 0, 0);
});

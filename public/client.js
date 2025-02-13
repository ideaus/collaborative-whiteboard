const canvas = document.getElementById('whiteboard');
const context = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const brushSize = document.getElementById('brushSize');
const clearBtn = document.getElementById('clearBtn');

// Set canvas size
canvas.width = window.innerWidth - 40;
canvas.height = window.innerHeight - 100;

// WebSocket connection
const ws = new WebSocket(`ws://${window.location.host}`);

let isDrawing = false;
let lastX = 0;
let lastY = 0;

// Drawing functions
function draw(e) {
    if (!isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    context.lineWidth = brushSize.value;
    context.lineCap = 'round';
    context.strokeStyle = colorPicker.value;

    context.beginPath();
    context.moveTo(lastX, lastY);
    context.lineTo(x, y);
    context.stroke();

    // Send drawing data to server
    ws.send(JSON.stringify({
        type: 'draw',
        x: x,
        y: y,
        lastX: lastX,
        lastY: lastY,
        color: colorPicker.value,
        size: brushSize.value
    }));

    [lastX, lastY] = [x, y];
}

// Event listeners
canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    [lastX, lastY] = [e.clientX - rect.left, e.clientY - rect.top];
});

canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', () => isDrawing = false);
canvas.addEventListener('mouseout', () => isDrawing = false);

clearBtn.addEventListener('click', () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    ws.send(JSON.stringify({ type: 'clear' }));
});

// WebSocket event handlers
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'draw') {
        context.beginPath();
        context.lineWidth = data.size;
        context.lineCap = 'round';
        context.strokeStyle = data.color;
        context.moveTo(data.lastX, data.lastY);
        context.lineTo(data.x, data.y);
        context.stroke();
    } else if (data.type === 'clear') {
        context.clearRect(0, 0, canvas.width, canvas.height);
    }
};

// Handle window resize
window.addEventListener('resize', () => {
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = window.innerWidth - 40;
    canvas.height = window.innerHeight - 100;
    context.putImageData(imageData, 0, 0);
});

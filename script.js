let images = [];
let sounds = [];
let spritesheetBlob = null;

let animations = {};

const predefinedAnimations = [
    "idle", "walk", "listen", "fall", "jump", "land", "sleep", "sleep_transition"
];

const editorCanvas = document.getElementById('editorCanvas');
const editorCtx = editorCanvas.getContext('2d');
const previewCanvas = document.getElementById('previewCanvas');
const previewCtx = previewCanvas.getContext('2d');

let selectedImage = null;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

let hoveredAnimation = null;
let hoveredFrame = null;
let currentSelectionFrames = [];

let isSelectingFrames = false;
let currentAnimationForFrames = null;

let zoomLevel = parseInt(document.getElementById('zoomLevel').value);
const zoomValueSpan = document.getElementById('zoomValue');
let isPanning = false;
let panStart = {
    x: 0,
    y: 0
};
let panOffset = {
    x: 0,
    y: 0
};

document.getElementById('zoomLevel').addEventListener('input', function(e) {
    zoomLevel = parseInt(e.target.value);
    zoomValueSpan.textContent = zoomLevel + 'x';
    drawEditor();
});

let previewZoomLevel = parseInt(document.getElementById('previewZoomLevel').value);
const previewZoomValueSpan = document.getElementById('previewZoomValue');
document.getElementById('previewZoomLevel').addEventListener('input', function(e) {
    previewZoomLevel = parseInt(e.target.value);
    previewZoomValueSpan.textContent = previewZoomLevel + 'x';
    drawPreview();
});

let animationZoomLevel = parseInt(document.getElementById('animationZoomLevel').value);
const animationZoomValueSpan = document.getElementById('animationZoomValue');
document.getElementById('animationZoomLevel').addEventListener('input', function(e) {
    animationZoomLevel = parseInt(e.target.value);
    animationZoomValueSpan.textContent = animationZoomLevel + 'x';
    updateAnimationList();
});

let animationSpeedLevel = parseInt(document.getElementById('animationSpeedLevel').value);
const animationSpeedValueSpan = document.getElementById('animationSpeedValue');
document.getElementById('animationSpeedLevel').addEventListener('input', function(e) {
    animationSpeedLevel = parseInt(e.target.value);
    animationSpeedValueSpan.textContent = animationSpeedLevel + ' fps';
    updateAnimationList();
});

let showGrid = document.getElementById('gridToggle').checked;
document.getElementById('gridToggle').addEventListener('change', function(e) {
    showGrid = e.target.checked;
    drawEditor();
    drawPreview();
});

document.getElementById('frameWidth').addEventListener('input', function(e) {
    drawEditor();
    drawPreview();
    updateAnimationList();
});

document.getElementById('frameHeight').addEventListener('input', function(e) {
    drawEditor();
    drawPreview();
    updateAnimationList();
});

const imageDropZone = document.getElementById('imageDropZone');
const imageLoader = document.getElementById('imageLoader');

imageDropZone.addEventListener('click', () => imageLoader.click());

['dragenter', 'dragover'].forEach(eventName => {
    imageDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        imageDropZone.classList.add('dragover');
    }, false);
});

['dragleave', 'drop'].forEach(eventName => {
    imageDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        imageDropZone.classList.remove('dragover');
    }, false);
});

imageDropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleImageFiles(files);
});

imageLoader.addEventListener('change', function(e) {
    handleImageFiles(e.target.files);
});

/**
 * Handles the loading of image files.
 * Positions new images in the next available free space from the top.
 * @param {FileList} files - List of image files.
 */
function handleImageFiles(files) {
    for (let file of files) {
        if (file.type !== 'image/png') {
            showMessageModal('Invalid File Format', 'Please upload images in PNG format.');
            continue;
        }
        const reader = new FileReader();
        reader.onload = function(event) {
            const imgElement = new Image();
            imgElement.onload = function() {
                if (!imgElement.width || !imgElement.height) {
                    console.error('Image did not load correctly:', imgElement);
                    return;
                }
                const img = {
                    image: imgElement,
                    x: findNextFreeX(imgElement.width),
                    y: findNextFreeY(imgElement.height),
                    width: imgElement.width,
                    height: imgElement.height,
                    filename: file.name
                };
                images.push(img);
                updateFileList();
                drawEditor();
            };
            imgElement.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
}

/**
 * Finds the next free X position for a new image.
 * Currently places images at x = 0.
 * Modify this function if horizontal placement is needed.
 * @param {number} imgWidth - Width of the image to be placed.
 * @returns {number} - X position.
 */
function findNextFreeX(imgWidth) {
    // For simplicity, placing all images aligned to the left.
    return 0;
}

/**
 * Finds the next free Y position for a new image.
 * Places images below existing ones, aligned to the bottom grid lines.
 * @param {number} imgHeight - Height of the image to be placed.
 * @returns {number} - Y position.
 */
function findNextFreeY(imgHeight) {
    const frameHeight = parseInt(document.getElementById('frameHeight').value) || 32;
    let maxY = 0;
    images.forEach(img => {
        if (img.y + img.height > maxY) {
            maxY = img.y + img.height;
        }
    });
    // Align to the nearest bottom grid line
    const nearestGridY = Math.ceil(maxY / frameHeight) * frameHeight;
    return nearestGridY;
}

/**
 * Updates the list of loaded image files in the UI.
 */
function updateFileList() {
    const list = document.getElementById('fileList');
    list.innerHTML = '';
    images.forEach((img, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.textContent = img.filename || (`Image ${index + 1}`);
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.onclick = function() {
            images.splice(index, 1);
            updateFileList();
            drawEditor();
        };
        item.appendChild(deleteButton);
        list.appendChild(item);
    });
}

/**
 * Draws all images and grid on the editor canvas.
 */
function drawEditor() {
    const frameWidth = parseInt(document.getElementById('frameWidth').value) || 32;
    let frameHeight = parseInt(document.getElementById('frameHeight').value) || 32;

    // Calculate maximum dimensions
    let maxX = 0;
    let maxY = 0;
    let maxSpriteHeight = 0;
    images.forEach(img => {
        const imgRight = img.x + img.width;
        const imgBottom = img.y + img.height;
        if (imgRight > maxX) maxX = imgRight;
        if (imgBottom > maxY) maxY = imgBottom;
        if (img.height > maxSpriteHeight) maxSpriteHeight = img.height;
    });

    // Update frame height based on the tallest sprite
    frameHeight = Math.max(frameHeight, maxSpriteHeight);
    document.getElementById('frameHeight').value = frameHeight;

    // Set canvas size based on sprite positions
    const canvasWidth = Math.max(800, maxX + 100);
    const canvasHeight = Math.max(600, maxY + 100);

    editorCanvas.width = canvasWidth;
    editorCanvas.height = canvasHeight;

    // Reset transformations and clear canvas
    editorCtx.setTransform(1, 0, 0, 1, 0, 0);
    editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
    editorCtx.imageSmoothingEnabled = false;

    // Apply panning and zooming
    editorCtx.translate(panOffset.x, panOffset.y);
    editorCtx.scale(zoomLevel, zoomLevel);

    // Draw all images
    images.forEach((img) => {
        editorCtx.drawImage(
            img.image,
            img.x,
            img.y,
            img.width,
            img.height
        );
        if (img === selectedImage) {
            editorCtx.strokeStyle = '#007BFF';
            editorCtx.lineWidth = 2 / zoomLevel;
            editorCtx.strokeRect(
                img.x,
                img.y,
                img.width,
                img.height
            );
        }
    });

    // Draw grid
    if (showGrid) {
        const cols = Math.ceil((canvasWidth / frameWidth) / zoomLevel);
        const rows = Math.ceil((canvasHeight / frameHeight) / zoomLevel);
        editorCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        editorCtx.lineWidth = 1 / zoomLevel;
        for (let i = 0; i <= cols; i++) {
            editorCtx.beginPath();
            editorCtx.moveTo(i * frameWidth, 0);
            editorCtx.lineTo(i * frameWidth, rows * frameHeight);
            editorCtx.stroke();
        }
        for (let j = 0; j <= rows; j++) {
            editorCtx.beginPath();
            editorCtx.moveTo(0, j * frameHeight);
            editorCtx.lineTo(cols * frameWidth, j * frameHeight);
            editorCtx.stroke();
        }
    }

    // Highlight frames for hovered animation
    if (hoveredAnimation && animations[hoveredAnimation]) {
        editorCtx.strokeStyle = 'rgba(0, 255, 0, 0.5)'; // Green color for animations
        editorCtx.lineWidth = 2 / zoomLevel;
        animations[hoveredAnimation].forEach(frameKey => {
            const [row, col] = frameKey.split(':').map(Number);
            const x = col * frameWidth;
            const y = row * frameHeight;
            editorCtx.strokeRect(x, y, frameWidth, frameHeight);
        });
    }

    // Highlight a specific hovered frame
    if (hoveredFrame) {
        editorCtx.strokeStyle = 'rgba(255, 0, 0, 0.8)'; // Red color for specific frame
        editorCtx.lineWidth = 2 / zoomLevel;
        const [row, col] = hoveredFrame.split(':').map(Number);
        const x = col * frameWidth;
        const y = row * frameHeight;
        editorCtx.strokeRect(x, y, frameWidth, frameHeight);
    }

    // Highlight frames during selection
    if (isSelectingFrames && currentSelectionFrames.length > 0) {
        editorCtx.strokeStyle = 'rgba(0, 0, 255, 0.5)'; // Blue color for selection
        editorCtx.lineWidth = 2 / zoomLevel;
        currentSelectionFrames.forEach(frameKey => {
            const [row, col] = frameKey.split(':').map(Number);
            const x = col * frameWidth;
            const y = row * frameHeight;
            editorCtx.strokeRect(x, y, frameWidth, frameHeight);
        });
    }
}

/**
 * Calculates the mouse position on the canvas, accounting for zoom and pan.
 * @param {HTMLCanvasElement} canvas - The canvas element.
 * @param {MouseEvent} evt - The mouse event.
 * @returns {Object} - The x and y coordinates.
 */
function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();

    const clientX = evt.clientX - rect.left;
    const clientY = evt.clientY - rect.top;

    const x = (clientX - panOffset.x) / zoomLevel;
    const y = (clientY - panOffset.y) / zoomLevel;

    return {
        x,
        y
    };
}

/**
 * Determines which image is under the cursor.
 * @param {Object} mousePos - The x and y coordinates of the mouse.
 * @returns {Object|null} - The image object or null if none.
 */
function getImageUnderCursor(mousePos) {
    for (let i = images.length - 1; i >= 0; i--) {
        const img = images[i];
        if (
            mousePos.x >= img.x &&
            mousePos.x <= img.x + img.width &&
            mousePos.y >= img.y &&
            mousePos.y <= img.y + img.height
        ) {
            return img;
        }
    }
    return null;
}

editorCanvas.addEventListener('wheel', function(e) {
    e.preventDefault(); 

    const zoomIntensity = 0.1;
    const delta = e.deltaY > 0 ? -zoomIntensity : zoomIntensity;
    let newZoomLevel = zoomLevel + delta;

    newZoomLevel = Math.min(Math.max(newZoomLevel, 0.5), 10);

    zoomLevel = newZoomLevel;
    zoomValueSpan.textContent = zoomLevel.toFixed(1) + 'x';

    drawEditor();
});

editorCanvas.addEventListener('mousedown', function(e) {
    if (e.button === 2) { 
        isPanning = true;
        panStart = {
            x: e.clientX,
            y: e.clientY
        };
        editorCanvas.style.cursor = 'move';
    } else if (!isSelectingFrames) { 
        const mousePos = getMousePos(editorCanvas, e);
        const clickedImage = getImageUnderCursor(mousePos);
        if (clickedImage) {
            selectedImage = clickedImage;
            isDragging = true;
            dragOffsetX = mousePos.x - selectedImage.x;
            dragOffsetY = mousePos.y - selectedImage.y;
            drawEditor();
        } else {
            selectedImage = null;
            drawEditor();
        }
    }
});

editorCanvas.addEventListener('mousemove', function(e) {
  if (isPanning) { // Pan
    const dx = (e.clientX - panStart.x);
    const dy = (e.clientY - panStart.y);
    panOffset.x += dx;
    panOffset.y += dy;
    panStart = { x: e.clientX, y: e.clientY };

    // Panning constraint: do not move left and up outside the grid
    panOffset.x = Math.min(panOffset.x, 0);
    panOffset.y = Math.min(panOffset.y, 0);

    // Limit panning to the right and down to avoid showing empty space
    const maxPanX = Math.max(editorCanvas.width * zoomLevel - editorCanvas.clientWidth, 0) * -1;
    const maxPanY = Math.max(editorCanvas.height * zoomLevel - editorCanvas.clientHeight, 0) * -1;
    panOffset.x = Math.max(panOffset.x, maxPanX);
    panOffset.y = Math.max(panOffset.y, maxPanY);

    drawEditor();
  } else if (isDragging && selectedImage && !isSelectingFrames) { // Moving sprites
    const mousePos = getMousePos(editorCanvas, e);
    let newX = mousePos.x - dragOffsetX;
    let newY = mousePos.y - dragOffsetY;

    // Pulling to the grid
    const frameWidth = parseInt(document.getElementById('frameWidth').value);
    const frameHeight = parseInt(document.getElementById('frameHeight').value);

    const threshold = 10; // Attraction threshold (you can adjust it to your needs)

    // Calculate the nearest grid coordinates
    const nearestGridX = Math.round(newX / frameWidth) * frameWidth;
    const nearestGridY = Math.round(newY / frameHeight) * frameHeight;

    // Determine which grid boundary to pull to (upper or lower)
    const distanceToTop = Math.abs(newY - nearestGridY);
    const distanceToBottom = Math.abs(newY + selectedImage.height - (nearestGridY + frameHeight));

    if (distanceToBottom < distanceToTop && distanceToBottom < threshold) {
      newY = nearestGridY + frameHeight - selectedImage.height;
    } else if (distanceToTop < threshold) {
      newY = nearestGridY;
    }

    const distanceToLeft = Math.abs(newX - nearestGridX);
    const distanceToRight = Math.abs(newX + selectedImage.width - (nearestGridX + frameWidth));

    if (distanceToRight < distanceToLeft && distanceToRight < threshold) {
      newX = nearestGridX + frameWidth - selectedImage.width;
    } else if (distanceToLeft < threshold) {
      newX = nearestGridX;
    }

    selectedImage.x = newX;
    selectedImage.y = newY;

    drawEditor();
  }
});

editorCanvas.addEventListener('mouseup', function(e) {
    if (e.button === 2) { 
        isPanning = false;
        editorCanvas.style.cursor = 'default';
    } else if (!isSelectingFrames) { 
        isDragging = false;
    }
});

editorCanvas.addEventListener('mouseleave', function(e) {
    if (isPanning) {
        isPanning = false;
        editorCanvas.style.cursor = 'default';
    }
    if (!isSelectingFrames) {
        isDragging = false;
    }
});

editorCanvas.addEventListener('contextmenu', function(e) {
    e.preventDefault();
});

/**
 * Aligns all sprites to the bottom grid lines.
 */
function alignAllToGrid() {
    const frameWidth = parseInt(document.getElementById('frameWidth').value);
    const frameHeight = parseInt(document.getElementById('frameHeight').value);

    let yPosition = 0;

    images.forEach(img => {
        img.x = 0;
        // Align to the nearest bottom grid line
        img.y = Math.ceil((yPosition + img.height) / frameHeight) * frameHeight - img.height;
        yPosition += Math.ceil(img.height / frameHeight) * frameHeight;
    });

    drawEditor();
}

/**
 * Crops sprites based on transparency.
 */
function cropSprites() {
    let minHeight = parseInt(document.getElementById('frameHeight').value);

    images.forEach(img => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img.image, 0, 0);

        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const data = imageData.data;

        let top = null;
        let bottom = null;

        for (let y = 0; y < img.height; y++) {
            for (let x = 0; x < img.width; x++) {
                const alpha = data[(y * img.width + x) * 4 + 3];
                if (alpha !== 0) {
                    if (top === null) {
                        top = y;
                    }
                    bottom = y;
                }
            }
        }

        if (top !== null && bottom !== null) {
            const newHeight = bottom - top + 1;
            const croppedCanvas = document.createElement('canvas');
            croppedCanvas.width = img.width;
            croppedCanvas.height = newHeight;
            const croppedCtx = croppedCanvas.getContext('2d');
            croppedCtx.drawImage(img.image, 0, top, img.width, newHeight, 0, 0, img.width, newHeight);

            img.image = new Image();
            img.image.src = croppedCanvas.toDataURL();

            img.height = newHeight;
            img.y += top;

            if (newHeight < minHeight) {
                minHeight = newHeight;
            }
        }
    });

    document.getElementById('frameHeight').value = minHeight;

    drawEditor();
}

/**
 * Opens the modal to select predefined animations.
 */
function openAnimationSelectModal() {
    const modal = document.getElementById('animationSelectModal');
    const optionsContainer = document.getElementById('animationOptions');
    optionsContainer.innerHTML = '';

    predefinedAnimations.forEach(animName => {

        if (animName.startsWith('idle')) {
            let index = 0;
            let nameToCheck = 'idle';
            while (animations[nameToCheck]) {
                index++;
                nameToCheck = `idle-${index}`;
            }
            animName = nameToCheck;
        } else if (animations[animName]) {
            return; 
        }

        const optionDiv = document.createElement('div');
        optionDiv.className = 'animation-option';
        optionDiv.textContent = animName;
        optionDiv.onclick = function() {
            animations[animName] = [];
            updateAnimationList();
            modal.style.display = 'none';
        };
        optionsContainer.appendChild(optionDiv);
    });

    modal.style.display = 'block';
}

/**
 * Closes the animation selection modal.
 */
function closeAnimationSelectModal() {
    document.getElementById('animationSelectModal').style.display = 'none';
}

/**
 * Displays a message modal with the given title and content.
 * @param {string} title - The title of the modal.
 * @param {string} content - The content/message of the modal.
 */
function showMessageModal(title, content) {
    const modal = document.getElementById('messageModal');
    document.getElementById('messageModalTitle').textContent = title;
    document.getElementById('messageModalContent').textContent = content;
    modal.style.display = 'block';
}

/**
 * Closes the message modal.
 */
function closeMessageModal() {
    document.getElementById('messageModal').style.display = 'none';
}

/**
 * Updates the animation list in the UI with hover effects.
 */
function updateAnimationList() {
    const list = document.getElementById('animationList');
    list.innerHTML = '';
    for (let animName in animations) {
        const animDiv = document.createElement('div');
        animDiv.className = 'animation-item';
        animDiv.innerHTML = `
          <strong>${animName}</strong> 
          <button onclick="deleteAnimation('${animName}')">Delete</button>
          <button onclick="selectFramesForAnimation('${animName}')" style="margin-left: 10px;">Add Frames</button>
          <div class="frame-list"></div>
          <div id="preview-${animName}" class="animation-preview"></div>
        `;

        // Add hover event listeners for the animation item
        animDiv.addEventListener('mouseover', function() {
            hoveredAnimation = animName;
            drawEditor();
        });
        animDiv.addEventListener('mouseout', function() {
            hoveredAnimation = null;
            drawEditor();
        });

        const frameList = animDiv.querySelector('.frame-list');
        animations[animName].forEach((frameKey, index) => {
            const frameDiv = document.createElement('div');
            frameDiv.className = 'frame-item';
            frameDiv.textContent = frameKey;
            frameDiv.title = "Click to delete frame";
            frameDiv.onclick = function() {
                animations[animName].splice(index, 1);
                updateAnimationList();
            };

            // Add hover event listeners for each frame
            frameDiv.addEventListener('mouseover', function() {
                hoveredFrame = frameKey;
                drawEditor();
            });
            frameDiv.addEventListener('mouseout', function() {
                hoveredFrame = null;
                drawEditor();
            });

            frameList.appendChild(frameDiv);
        });
        list.appendChild(animDiv);

        if (spritesheetCanvas) {
            previewAnimation(animName);
        }
    }
}

/**
 * Deletes an animation by name.
 * @param {string} name - The name of the animation to delete.
 */
function deleteAnimation(name) {
    delete animations[name];

    if (name.startsWith('idle')) {
        const idleAnimations = Object.keys(animations).filter(n => n.startsWith('idle')).sort();
        idleAnimations.forEach((animName, index) => {
            const newName = index === 0 ? 'idle' : `idle-${index}`;
            if (newName !== animName) {
                animations[newName] = animations[animName];
                delete animations[animName];
            }
        });
    }
    updateAnimationList();
}

/**
 * Allows the user to select frames for a specific animation.
 * Highlights the selected frames on the editor canvas.
 * @param {string} animName - The name of the animation to add frames to.
 */
function selectFramesForAnimation(animName) {
    alert('Select areas on the editor for animation ' + animName);
    isSelectingFrames = true;
    currentAnimationForFrames = animName;
    currentSelectionFrames = [];

    let startPos = null;

    function mouseDownHandler(e) {
        if (e.button !== 0) return; // Only left mouse button
        startPos = getMousePos(editorCanvas, e);
    }

    function mouseMoveHandler(e) {
        if (!isSelectingFrames || !startPos) return;
        const currentPos = getMousePos(editorCanvas, e);

        const x1 = Math.min(startPos.x, currentPos.x);
        const y1 = Math.min(startPos.y, currentPos.y);
        const x2 = Math.max(startPos.x, currentPos.x);
        const y2 = Math.max(startPos.y, currentPos.y);

        const frameWidth = parseInt(document.getElementById('frameWidth').value);
        const frameHeight = parseInt(document.getElementById('frameHeight').value);

        const colStart = Math.floor(x1 / frameWidth);
        const rowStart = Math.floor(y1 / frameHeight);
        const colEnd = Math.floor(x2 / frameWidth);
        const rowEnd = Math.floor(y2 / frameHeight);

        const selectedFrames = [];
        for (let row = rowStart; row <= rowEnd; row++) {
            for (let col = colStart; col <= colEnd; col++) {
                const frameKey = `${row}:${col}`;
                selectedFrames.push(frameKey);
            }
        }

        currentSelectionFrames = selectedFrames;
        drawEditor();
    }

    function mouseUpHandler(e) {
        if (!isSelectingFrames || !startPos || e.button !== 0) return;
        const endPos = getMousePos(editorCanvas, e);

        const x1 = Math.min(startPos.x, endPos.x);
        const y1 = Math.min(startPos.y, endPos.y);
        const x2 = Math.max(startPos.x, endPos.x);
        const y2 = Math.max(startPos.y, endPos.y);

        const frameWidth = parseInt(document.getElementById('frameWidth').value);
        const frameHeight = parseInt(document.getElementById('frameHeight').value);

        const colStart = Math.floor(x1 / frameWidth);
        const rowStart = Math.floor(y1 / frameHeight);
        const colEnd = Math.floor(x2 / frameWidth);
        const rowEnd = Math.floor(y2 / frameHeight);

        for (let row = rowStart; row <= rowEnd; row++) {
            for (let col = colStart; col <= colEnd; col++) {
                const frameKey = `${row}:${col}`;
                if (!animations[animName].includes(frameKey)) {
                    animations[animName].push(frameKey);
                }
            }
        }

        updateAnimationList();
        isSelectingFrames = false;
        currentAnimationForFrames = null;
        currentSelectionFrames = [];
        startPos = null;

        // Remove temporary event listeners
        editorCanvas.removeEventListener('mousedown', mouseDownHandler);
        editorCanvas.removeEventListener('mousemove', mouseMoveHandler);
        editorCanvas.removeEventListener('mouseup', mouseUpHandler);
        editorCanvas.style.cursor = 'default';
        drawEditor();
    }

    editorCanvas.style.cursor = 'crosshair';
    editorCanvas.addEventListener('mousedown', mouseDownHandler);
    editorCanvas.addEventListener('mousemove', mouseMoveHandler);
    editorCanvas.addEventListener('mouseup', mouseUpHandler);
}

/**
 * Displays a message modal with the given title and content.
 * @param {string} title - The title of the modal.
 * @param {string} content - The content/message of the modal.
 */
function showMessageModal(title, content) {
    const modal = document.getElementById('messageModal');
    document.getElementById('messageModalTitle').textContent = title;
    document.getElementById('messageModalContent').textContent = content;
    modal.style.display = 'block';
}

/**
 * Closes the message modal.
 */
function closeMessageModal() {
    document.getElementById('messageModal').style.display = 'none';
}

/**
 * Generates the configuration JSON for the spritesheet and animations.
 * @returns {string} - The JSON string of the configuration.
 */
function generateConfig() {
    const config = {
        "spritesheet": "spritesheet.png",
        "frame_width": parseInt(document.getElementById('frameWidth').value),
        "frame_height": parseInt(document.getElementById('frameHeight').value),
        "animations": animations,
        "sound": sounds.map(sound => sound.name)
    };
    return JSON.stringify(config, null, 2);
}

let spritesheetCanvas = null; 

/**
 * Generates the spritesheet by arranging selected frames.
 */
function generateSpritesheet() {
    if (images.length === 0) {
        showMessageModal('Error', 'Please upload at least one image.');
        return;
    }

    const frameWidth = parseInt(document.getElementById('frameWidth').value);
    const frameHeight = parseInt(document.getElementById('frameHeight').value);

    if (frameWidth <= 0 || frameHeight <= 0) {
        showMessageModal('Error', 'Frame sizes must be positive numbers.');
        return;
    }

    const requiredAnimations = ["idle", "walk", "listen", "fall", "jump", "sleep", "sleep_transition"];
    const missingAnimations = requiredAnimations.filter(anim => !Object.keys(animations).includes(anim));
    if (missingAnimations.length > 0) {
        showMessageModal('Attention', 'Missing required animations: ' + missingAnimations.join(', '));
    }

    let frames = [];

    let usedFramesSet = new Set();
    for (let animName in animations) {
        animations[animName].forEach(frameKey => {
            usedFramesSet.add(frameKey);
        });
    }

    let usedFrames = Array.from(usedFramesSet).sort((a, b) => {
        const [rowA, colA] = a.split(':').map(Number);
        const [rowB, colB] = b.split(':').map(Number);
        return rowA - rowB || colA - colB;
    });

    usedFrames.forEach(frameKey => {
        const [row, col] = frameKey.split(':').map(Number);
        const x = col * frameWidth;
        const y = row * frameHeight;

        let img = null;
        for (let image of images) {
            if (
                x >= image.x && x < image.x + image.width &&
                y >= image.y && y < image.y + image.height
            ) {
                img = image;
                break;
            }
        }
        if (img) {
            frames.push({
                img: img,
                sx: x - img.x,
                sy: y - img.y,
                frameKey: frameKey
            });
        }
    });

    if (frames.length === 0) {
        showMessageModal('Error', 'No frames available for spritesheet generation. Add frames to animations.');
        return;
    }

    const columns = 1;
    const rows = frames.length;

    spritesheetCanvas = document.createElement('canvas');
    spritesheetCanvas.width = columns * frameWidth;
    spritesheetCanvas.height = rows * frameHeight;
    const spritesheetCtx = spritesheetCanvas.getContext('2d');
    spritesheetCtx.imageSmoothingEnabled = false;

    let frameMap = {};
    frames.forEach((frame, index) => {
        const dx = 0;
        const dy = index * frameHeight;

        spritesheetCtx.drawImage(
            frame.img.image,
            frame.sx,
            frame.sy,
            frameWidth,
            frameHeight,
            dx,
            dy,
            frameWidth,
            frameHeight
        );

        const newFrameKey = `${index}:0`; 
        frameMap[frame.frameKey] = newFrameKey;
    });

    for (let animName in animations) {
        animations[animName] = animations[animName].map(frameKey => {
            const newFrameKey = frameMap[frameKey];
            if (newFrameKey) {
                return newFrameKey;
            } else {
                return null;
            }
        }).filter(frame => frame !== null);
    }

    drawPreview();

    spritesheetCanvas.toBlob(function(blob) {
        spritesheetBlob = blob;
        showMessageModal('Success', 'Spritesheet generated successfully!');
        updateAnimationList(); 
    });
}

/**
 * Draws the preview of the spritesheet.
 */
function drawPreview() {
    if (!spritesheetCanvas) return;

    const scaledWidth = spritesheetCanvas.width * previewZoomLevel;
    const scaledHeight = spritesheetCanvas.height * previewZoomLevel;

    previewCanvas.width = spritesheetCanvas.width * previewZoomLevel;
    previewCanvas.height = spritesheetCanvas.height * previewZoomLevel;

    previewCtx.imageSmoothingEnabled = false;
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    previewCtx.drawImage(spritesheetCanvas, 0, 0, scaledWidth, scaledHeight);

    if (showGrid) {
        previewCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        previewCtx.lineWidth = 1;
        const frameWidth = parseInt(document.getElementById('frameWidth').value) * previewZoomLevel;
        const frameHeight = parseInt(document.getElementById('frameHeight').value) * previewZoomLevel;
        const cols = Math.ceil(previewCanvas.width / frameWidth);
        const rows = Math.ceil(previewCanvas.height / frameHeight);

        for (let i = 0; i <= cols; i++) {
            previewCtx.beginPath();
            previewCtx.moveTo(i * frameWidth, 0);
            previewCtx.lineTo(i * frameWidth, previewCanvas.height);
            previewCtx.stroke();
        }
        for (let j = 0; j <= rows; j++) {
            previewCtx.beginPath();
            previewCtx.moveTo(0, j * frameHeight);
            previewCtx.lineTo(previewCanvas.width, j * frameHeight);
            previewCtx.stroke();
        }
    }
}

/**
 * Previews a specific animation by animating its frames on a separate canvas.
 * @param {string} animName - The name of the animation to preview.
 */
function previewAnimation(animName) {
    const anim = animations[animName];
    if (!anim || anim.length === 0) return;

    const previewContainer = document.getElementById(`preview-${animName}`);
    previewContainer.innerHTML = ''; 

    const canvas = document.createElement('canvas');
    const frameWidth = parseInt(document.getElementById('frameWidth').value);
    const frameHeight = parseInt(document.getElementById('frameHeight').value);
    canvas.width = frameWidth * animationZoomLevel;
    canvas.height = frameHeight * animationZoomLevel;
    canvas.className = 'animation-preview-canvas';
    previewContainer.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    let frameIndex = 0;
    const fps = animationSpeedLevel;
    const frameDuration = 1000 / fps;
    let lastFrameTime = performance.now();

    function drawFrame(time) {
        if (!spritesheetCanvas || !animations[animName] || anim.length === 0) {
            return;
        }

        if (time - lastFrameTime >= frameDuration) {
            const frameKey = anim[frameIndex];
            if (!frameKey) {
                frameIndex = 0;
                return;
            }

            const [row, col] = frameKey.split(':').map(Number);
            if (isNaN(row) || isNaN(col)) {
                console.error(`Invalid frameKey: ${frameKey}`);
                return;
            }

            const sx = col * frameWidth;
            const sy = row * frameHeight;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(
                spritesheetCanvas,
                sx,
                sy,
                frameWidth,
                frameHeight,
                0,
                0,
                canvas.width,
                canvas.height
            );

            frameIndex = (frameIndex + 1) % anim.length;
            lastFrameTime = time;
        }

        previewContainer.animationFrameId = requestAnimationFrame(drawFrame);
    }

    // Cancel any existing animation frames
    if (previewContainer.animationFrameId) {
        cancelAnimationFrame(previewContainer.animationFrameId);
    }

    // Start the animation
    previewContainer.animationFrameId = requestAnimationFrame(drawFrame);
}

const soundDropZone = document.getElementById('soundDropZone');
const soundLoader = document.getElementById('soundLoader');

soundDropZone.addEventListener('click', () => soundLoader.click());

['dragenter', 'dragover'].forEach(eventName => {
    soundDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        soundDropZone.classList.add('dragover');
    }, false);
});

['dragleave', 'drop'].forEach(eventName => {
    soundDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        soundDropZone.classList.remove('dragover');
    }, false);
});

soundDropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleSoundFiles(files);
});

soundLoader.addEventListener('change', function(e) {
    handleSoundFiles(e.target.files);
});

/**
 * Handles the loading of sound files.
 * @param {FileList} files - List of sound files.
 */
function handleSoundFiles(files) {
    for (let file of files) {
        if (file.type !== 'audio/mpeg' && file.type !== 'audio/mp3') {
            showMessageModal('Invalid File Format', 'Please upload sounds in MP3 format.');
            continue;
        }
        sounds.push(file);
    }
    updateSoundList();
}

/**
 * Updates the list of loaded sound files in the UI.
 */
function updateSoundList() {
    const list = document.getElementById('soundList');
    list.innerHTML = '';
    sounds.forEach((sound, index) => {
        const item = document.createElement('div');
        item.className = 'sound-item';
        item.textContent = sound.name;
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.onclick = function() {
            sounds.splice(index, 1);
            updateSoundList();
        };
        item.appendChild(deleteButton);
        list.appendChild(item);
    });
}

/**
 * Generates the configuration JSON for the spritesheet and animations.
 * @returns {string} - The JSON string of the configuration.
 */
function generateConfig() {
    const config = {
        "spritesheet": "spritesheet.png",
        "frame_width": parseInt(document.getElementById('frameWidth').value),
        "frame_height": parseInt(document.getElementById('frameHeight').value),
        "animations": animations,
        "sound": sounds.map(sound => sound.name)
    };
    return JSON.stringify(config, null, 2);
}

/**
 * Initiates the download of the spritesheet and configuration.
 */
function downloadSkin() {
    if (!spritesheetBlob) {
        showMessageModal('Error', 'Please generate the spritesheet first.');
        return;
    }

    const zip = new JSZip();

    zip.file("spritesheet.png", spritesheetBlob);

    zip.file("config.json", generateConfig());

    sounds.forEach(sound => {
        zip.file(sound.name, sound);
    });

    zip.generateAsync({
        type: "blob"
    }).then(function(content) {
        saveAs(content, "skin.zip");
    });
}

/**
 * Handles window clicks to close modals when clicking outside of them.
 * @param {MouseEvent} event - The click event.
 */
window.onclick = function(event) {
    const animationModal = document.getElementById('animationSelectModal');
    const messageModal = document.getElementById('messageModal');
    if (event.target == animationModal) {
        animationModal.style.display = "none";
    }
    if (event.target == messageModal) {
        messageModal.style.display = "none";
    }
}

drawEditor();
updateAnimationList();

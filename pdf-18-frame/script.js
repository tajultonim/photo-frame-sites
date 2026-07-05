(function () {
  const FRAME_SRC = "frame.png";
  const OUTPUT_SIZE = 1400;

  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const placeholder = document.getElementById('placeholder');
  const downloadBtn = document.getElementById('downloadBtn');
  const resetBtn = document.getElementById('resetBtn');
  const changeBtn = document.getElementById('changeBtn');
  const zoomRow = document.getElementById('zoomRow');
  const zoomSlider = document.getElementById('zoomSlider');
  const frameLoader = document.getElementById('frameLoader');

  let userImg = null;
  let frameImg = null;
  let frameReady = false;
  let pendingDraw = false;

  // view state: baseScale = scale at zoom level 1 that makes image "cover" the square
  let baseScale = 1;
  let zoom = 1;
  let centerX = OUTPUT_SIZE / 2;
  let centerY = OUTPUT_SIZE / 2;

  let dragging = false;
  let lastPX = 0, lastPY = 0;

  // --- Defer the frame image fetch until the page itself has finished loading,
  // so first paint / interactivity never waits on it. ---
  function startFrameLoad() {
    const img = new Image();
    img.onload = () => {
      frameImg = img;
      frameReady = true;
      frameLoader.classList.remove('visible');
      if (pendingDraw) drawComposite();
    };
    img.onerror = () => {
      frameLoader.classList.remove('visible');
      console.error('Could not load frame.png');
    };
    img.src = FRAME_SRC;
  }

  if (document.readyState === 'complete') {
    startFrameLoad();
  } else {
    window.addEventListener('load', startFrameLoad);
  }

  function currentDims() {
    const scale = baseScale * zoom;
    return { w: userImg.width * scale, h: userImg.height * scale };
  }

  function clampCenter() {
    const { w, h } = currentDims();
    const minX = OUTPUT_SIZE - w / 2;
    const maxX = w / 2;
    const minY = OUTPUT_SIZE - h / 2;
    const maxY = h / 2;
    centerX = Math.min(Math.max(centerX, Math.min(minX, maxX)), Math.max(minX, maxX));
    centerY = Math.min(Math.max(centerY, Math.min(minY, maxY)), Math.max(minY, maxY));
  }

  function drawComposite() {
    if (!userImg) return;

    if (!frameReady) {
      // Show the photo right away; overlay the frame as soon as it arrives.
      pendingDraw = true;
      frameLoader.classList.add('visible');
    }

    clampCenter();
    const { w, h } = currentDims();

    ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    ctx.drawImage(userImg, centerX - w / 2, centerY - h / 2, w, h);

    if (frameImg) {
      ctx.drawImage(frameImg, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      pendingDraw = false;
    }
  }

  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        userImg = img;
        baseScale = OUTPUT_SIZE / Math.min(img.width, img.height);
        zoom = 1;
        zoomSlider.value = 1;
        centerX = OUTPUT_SIZE / 2;
        centerY = OUTPUT_SIZE / 2;

        canvas.style.display = 'block';
        placeholder.style.display = 'none';
        dropZone.classList.add('has-image');
        downloadBtn.disabled = false;
        resetBtn.disabled = false;
        zoomRow.classList.add('visible');

        drawComposite();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function canvasScaleRatio() {
    const rect = canvas.getBoundingClientRect();
    return OUTPUT_SIZE / rect.width;
  }

  // ---- Upload interactions ----
  dropZone.addEventListener('click', () => {
    if (!userImg) fileInput.click();
  });

  changeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) loadFile(e.target.files[0]);
  });

  ['dragenter', 'dragover'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  });

  // ---- Reposition (pan) interactions ----
  canvas.addEventListener('pointerdown', (e) => {
    if (!userImg) return;
    dragging = true;
    lastPX = e.clientX;
    lastPY = e.clientY;
    dropZone.classList.add('dragging');
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || !userImg) return;
    const ratio = canvasScaleRatio();
    const dx = (e.clientX - lastPX) * ratio;
    const dy = (e.clientY - lastPY) * ratio;
    centerX += dx;
    centerY += dy;
    lastPX = e.clientX;
    lastPY = e.clientY;
    drawComposite();
  });

  function endDrag() {
    dragging = false;
    dropZone.classList.remove('dragging');
  }

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => { if (dragging) endDrag(); });

  // mouse wheel to zoom
  canvas.addEventListener('wheel', (e) => {
    if (!userImg) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    zoom = Math.min(3, Math.max(1, zoom + delta));
    zoomSlider.value = zoom;
    drawComposite();
  }, { passive: false });

  zoomSlider.addEventListener('input', (e) => {
    zoom = parseFloat(e.target.value);
    drawComposite();
  });

  // ---- Download / reset ----
  downloadBtn.addEventListener('click', () => {
    if (!userImg) return;
    const link = document.createElement('a');
    link.download = 'pdf-18-anniversary-photo.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  resetBtn.addEventListener('click', () => {
    userImg = null;
    fileInput.value = '';
    zoom = 1;
    zoomSlider.value = 1;
    canvas.style.display = 'none';
    placeholder.style.display = 'block';
    dropZone.classList.remove('has-image');
    zoomRow.classList.remove('visible');
    downloadBtn.disabled = true;
    resetBtn.disabled = true;
  });
})();

// Global variables
let scene, camera, renderer, controls;
let currentMesh; // for primitives
let currentModel; // for GLTF/GLB models
let autoRotationSpeed = 0.01;
let isAutoRotating = true;
let parallaxEnabled = true;
let targetOrbitOffset = { x: 0, y: 0 };
let currentOrbitOffset = { x: 0, y: 0 };
// Lifecycle flags and handles
let _isInitialized = false; // ensure init runs once
let _listenersAttached = false; // ensure listeners attach once
let _interactiveAttached = false; // ensure interactive effects attach once
let _animationId = null;
let _lastRaycast = 0; // timestamp for throttlin raycast
const RAYCAST_MIN_INTERVAL = 60;
let lastCanvasRect = null;
let lastCursorState = "default";

// Geometric shapes collection
const shapes = {
  cube: () => new THREE.BoxGeometry(2, 2, 2),
  sphere: () => new THREE.SphereGeometry(1.5, 32, 32),
  torus: () => new THREE.TorusGeometry(1.5, 0.5, 16, 100),
  cylinder: () => new THREE.CylinderGeometry(1, 1, 2, 32),
  octahedron: () => new THREE.OctahedronGeometry(1.5),
};

// Initialize the 3D scene
function init() {
  if (_isInitialized) {
    console.warn("init() already called; skipping reinitialization.");
    return;
  }

  // Get canvas element
  const canvas = document.getElementById('three-canvas');
  const container = document.querySelector('.canvas-container');

  if (!canvas || !container) {
    console.error("Canvas or container element not found; aborting init().");
    return;
  }

  // Ensure THREE is present
  if (typeof THREE === "undefined") {
    console.error("Three.js is not loaded; cannot initialize 3D scene.");
    return;
  }
  _isInitialized = true;
  // Create scene
  scene = new THREE.Scene();
  // Keep scene background transparent so the site stays white
  // renderer will composite over the white page background

  // Create camera
  const aspectRatio = container.clientWidth / container.clientHeight;
  camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
  camera.position.set(5, 5, 5);

  // Create renderer
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true, // allow DOM/page background to show through
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0); // keep transparent

  // Add lighting
  setupLighting();
  // Setup controls
  setupControls();

  // Load model: allow page to specify a different model via data-model
  const modelPath = canvas && canvas.dataset.model ? canvas.dataset.model : 'assets/models/prism.glb';
  loadGltfFromUrl(modelPath, undefined, () => {
    console.warn('Falling back to primitive shape because prism.glb failed to load.');
    safeCreatePrimitiveFallback();
  });

  // Setup event listeners & interactive effects
  setupEventListeners();
  addInteractiveEffects();
  // Hide loading screen
  // and announce completion
  setTimeout(() => {
    const loader = document.getElementById("loading-screen");
    if (loader) loader.classList.add("hidden");

    // Screen reader announcement
    const doneMsg = document.createElement("div");
    doneMsg.setAttribute("role", "status");
    doneMsg.setAttribute("aria-live", "polite");
    doneMsg.classList.add("sr-only");
    doneMsg.textContent = "XAYTHEON has finished loading.";
    document.body.appendChild(doneMsg);
  }, 1000);

  // Start animation loop
  startAnimation();
}

function disposeScene() {
  // Stop animation loop
  stopAnimation();

  if (_listenersAttached) {
    // Some listeners are attached to specific elements; we guard-check them inside setupEventListeners
    // We do not attempt to remove anonymous closures here other than global ones below.
    window.removeEventListener("resize", onWindowResize);
    _listenersAttached = false;
  }

  if (_interactiveAttached) {
    // remove global listeners added by interactive effects (if necessary)
    // Those were attached with named functions stored on renderer.domElement where possible
    // For simplicity we won't aggressively remove every handler, but nullify refs to free memory
    _interactiveAttached = false;
  }

  // Dispose meshes and models
  if (currentMesh) {
    scene.remove(currentMesh);
    if (currentMesh.geometry) currentMesh.geometry.dispose();
    if (currentMesh.material) {
      if (Array.isArray(currentMesh.material)) {
        currentMesh.material.forEach((m) => m.dispose && m.dispose());
      } else {
        currentMesh.material.dispose && currentMesh.material.dispose();
      }
    }
    currentMesh = null;
  }

  if (currentModel) {
    scene.remove(currentModel);
    disposeObject(currentModel);
    currentModel = null;
  }

  if (scene) {
    const lightsToRemove = [];
    scene.traverse(obj => {
      if (obj.isLight) {
        lightsToRemove.push(obj);
      }
    });
    lightsToRemove.forEach(light => scene.remove(light));
  }

  // Dispose renderer
  try {
    if (renderer) {
      renderer.forceContextLoss && renderer.forceContextLoss();
      if (renderer.domElement && renderer.domElement.width) {
        renderer.domElement.width = 1;
        renderer.domElement.height = 1;
      }
      renderer = null;
    }
  } catch (e) {
    console.warn("Renderer disposal failed:", e);
  }

  if (window.__interactiveCleanup) {
    window.__interactiveCleanup();
    window.__interactiveCleanup = null;
  }
  // Clear controls
  if (controls && typeof controls.dispose === "function") {
    controls.dispose();
  }
  controls = null;
  scene = null;
  camera = null;
  _isInitialized = false;
}

// -----------------------------
// Lighting and Controls
// -----------------------------
// Setup lighting
function setupLighting() {
  if (!scene) return;
  // Ambient light
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(ambientLight);

  // Main directional light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(10, 10, 5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  scene.add(directionalLight);

  // Fill light
  const fillLight = new THREE.DirectionalLight(0x6699ff, 0.3);
  fillLight.position.set(-5, 0, -5);
  scene.add(fillLight);

  // Point light for extra highlights
  const pointLight = new THREE.PointLight(0xff9999, 0.5, 50);
  pointLight.position.set(5, 5, 5);
  scene.add(pointLight);
}

// Setup camera controls
function setupControls() {
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 3;
  controls.maxDistance = 20;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.enableRotate = true;
}

// -----------------------------
// Shape creation and model handling
// -----------------------------
function createShape(shapeType) {
  // Remove existing mesh
  if (currentMesh) {
    scene.remove(currentMesh);
    if (currentMesh.geometry) currentMesh.geometry.dispose();
    if (currentMesh.material) {
      if (Array.isArray(currentMesh.material)) {
        currentMesh.material.forEach((m) => m.dispose && m.dispose());
      } else {
        currentMesh.material.dispose && currentMesh.material.dispose();
      }
    }
    currentMesh = null;
  }
  // Remove existing model
  if (currentModel) {
    try {
      scene.remove(currentModel);
      disposeObject(currentModel);
    } catch (e) { }
    currentModel = null;
  }

  // Create new geometry
  const creator = shapes[shapeType];
  if (!creator) {
    console.warn("Unknown shape type:", shapeType);
    return;
  }
  const geometry = creator();

  // Create material with current settings (guard optional controls)
  const colorEl = document.getElementById("color-picker");
  const wireEl = document.getElementById("wireframe-toggle");
  const color = colorEl ? colorEl.value : "#66ccff";
  const isWireframe = wireEl ? !!wireEl.checked : false;

  const material = new THREE.MeshPhongMaterial({
    color: color,
    wireframe: isWireframe,
    shininess: 100,
    transparent: true,
    opacity: 0.9,
  });

  // Create mesh
  currentMesh = new THREE.Mesh(geometry, material);
  currentMesh.castShadow = true;
  currentMesh.receiveShadow = true;

  // Add to scene
  scene.add(currentMesh);

  console.log(`Created ${shapeType} shape`);
}

// Setup event listeners
function setupEventListeners() {
  if (_listenersAttached) return;
  _listenersAttached = true;

  // UI controls: guard each element's existence
  const shapeSel = document.getElementById("shape-selector");
  if (shapeSel) shapeSel.addEventListener("change", (e) => createShape(e.target.value));

  const colorPicker = document.getElementById("color-picker");
  if (colorPicker)
    colorPicker.addEventListener("input", (e) => {
      if (currentMesh && currentMesh.material && currentMesh.material.color) {
        currentMesh.material.color.set(e.target.value);
      }
    });
  const wireframeToggle = document.getElementById("wireframe-toggle");
  if (wireframeToggle)
    wireframeToggle.addEventListener("change", (e) => {
      if (currentMesh && currentMesh.material) currentMesh.material.wireframe = e.target.checked;
    });

  const rotationSpeed = document.getElementById("rotation-speed");
  if (rotationSpeed) rotationSpeed.addEventListener("input", (e) => {
    autoRotationSpeed = parseFloat(e.target.value) || 0;
    isAutoRotating = autoRotationSpeed > 0;
  });
  const resetBtn = document.getElementById("reset-camera");
  if (resetBtn) resetBtn.addEventListener("click", () => {
    if (camera) camera.position.set(5, 5, 5);
    if (controls && typeof controls.reset === "function") controls.reset();
  });
  const fileInput = document.getElementById("model-file");
  if (fileInput) fileInput.addEventListener("change", handleModelUpload);

  const sampleBtn = document.getElementById("load-sample");
  if (sampleBtn) sampleBtn.addEventListener("click", () => {
    loadGltfFromUrl(
      "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb"
    );
  });


  // Handle window resize
  window.addEventListener("resize", onWindowResize);
}

// Handle window resize
function onWindowResize() {
  const container = document.querySelector(".canvas-container");
  if (!container || !camera || !renderer) return;
  const aspectRatio = Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight);
  camera.aspect = aspectRatio;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}


// Animation loop
function animateLoop(time) {
  // Schedule next frame
  _animationId = requestAnimationFrame(animateLoop);

  // Auto rotation of primitive mesh
  if (currentMesh && isAutoRotating) {
    currentMesh.rotation.x += autoRotationSpeed;
    currentMesh.rotation.y += autoRotationSpeed * 1.5;
  }
  // Update TWEEN if present
  if (typeof TWEEN !== "undefined" && TWEEN.update) TWEEN.update();
  // Parallax and controls update
  if (parallaxEnabled && controls) {
    currentOrbitOffset.x += (targetOrbitOffset.x - currentOrbitOffset.x) * 0.05;
    currentOrbitOffset.y += (targetOrbitOffset.y - currentOrbitOffset.y) * 0.05;
    // Keep z at 0 so orbit target remains planar
    if (controls.target) controls.target.set(currentOrbitOffset.x, currentOrbitOffset.y, 0);
  }
  if (controls && typeof controls.update === "function") controls.update();
  // Rotate loaded model
  if (currentModel && isAutoRotating) {
    currentModel.rotation.y += autoRotationSpeed;
  }
  // Throttled raycast processing for hover highlights (if interactive attached)
  const now = performance.now();
  if (_interactiveAttached && now - _lastRaycast >= RAYCAST_MIN_INTERVAL) {
    _lastRaycast = now;
    if (typeof window.__processRaycast === "function") {
      try {
        window.__processRaycast();
      } catch (e) {
        // avoid breaking render loop
        console.warn("Raycast process error:", e);
      }
    }
  }
  // Render (guard)
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}
function startAnimation() {
  if (_animationId !== null) return; // already running
  _animationId = requestAnimationFrame(animateLoop);
}
function stopAnimation() {
  if (_animationId !== null) {
    cancelAnimationFrame(_animationId);
    _animationId = null;
  }
}

//-----------------------------------------
// ---------- GLTF MODEL LOADING ----------
//-----------------------------------------
function handleModelUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  loadGltfFromUrl(url, () => URL.revokeObjectURL(url));
}

function loadGltfFromUrl(url, onDone, onError) {
  showLoading(true, "Loading Model...");
  if (typeof THREE === "undefined" || !THREE.GLTFLoader) {
    const err = new Error("GLTFLoader unavailable");
    console.warn(err);
    showLoading(false);
    if (typeof onError === "function") onError(err);
    if (typeof onDone === "function") onDone();
    return;
  }

  const loader = new THREE.GLTFLoader();
  loader.load(
    url,
    (gltf) => {
      // Clean up current mesh if present
      if (currentMesh) {
        scene.remove(currentMesh);
        if (currentMesh.geometry) currentMesh.geometry.dispose();
        if (currentMesh.material) {
          if (Array.isArray(currentMesh.material)) {
            currentMesh.material.forEach((m) => m.dispose && m.dispose());
          } else {
            currentMesh.material.dispose && currentMesh.material.dispose();
          }
        }
        currentMesh = null;
      }

      // Remove existing model
      if (currentModel) {
        scene.remove(currentModel);
        disposeObject(currentModel);
      }

      currentModel = gltf.scene;
      preprocessModel(currentModel);
      scene.add(currentModel);
      frameObject(currentModel);
      showLoading(false);
      if (onDone) onDone();
      console.log("✅ Model loaded:", url);
    },
    undefined,
    (err) => {
      console.error("Model load error:", err);
      showLoading(false);
      if (onError) onError(err);
      if (onDone) onDone();
    }
  );
}

function safeCreatePrimitiveFallback() {
  try {
    createShape("octahedron");
  } catch (e) {
    console.warn("Fallback primitive creation failed:", e);
  }
}
//-------------------------------
//---------Model utilities-------
//-------------------------------
function preprocessModel(object3d) {
  object3d.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material) {
        // Ensure standard material for consistency
        if (
          !child.material.isMeshStandardMaterial &&
          !child.material.isMeshPhysicalMaterial
        ) {
          child.material = new THREE.MeshStandardMaterial({ color: 0xffffff });
        }
      }
    }
  });
  // Center & scale to fit (larger to cover hero/dashboard)
  const canvas = document.getElementById("three-canvas");
  const isDashboard =
    canvas && canvas.dataset.model && canvas.dataset.model.includes("github");
  centerAndScale(object3d, isDashboard ? 20 : 16);
}

function centerAndScale(object3d, targetSize = 3) {
  const box = new THREE.Box3().setFromObject(object3d);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  // Recenter at origin
  object3d.position.sub(center);

  // Scale uniformly to target size
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) {
    const scale = targetSize / maxDim;
    object3d.scale.setScalar(scale);
  }
}

function frameObject(object3d) {
  const box = new THREE.Box3().setFromObject(object3d);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);

  // Bring camera even closer for a larger on-screen presence
  const canvas = document.getElementById("three-canvas");
  const isDashboard =
    canvas && canvas.dataset.model && canvas.dataset.model.includes("github");
  const fitDist = maxDim * (isDashboard ? 0.8 : 0.95);
  const direction = new THREE.Vector3(1, 1, 1).normalize();
  camera.position.copy(direction.multiplyScalar(fitDist));
  // Slightly narrow field of view to keep model large without clipping
  camera.fov = 60;
  camera.near = fitDist / 100;
  camera.far = fitDist * 100;
  camera.updateProjectionMatrix();
  controls.target.set(0, 0, 0);
  controls.update();
}
function disposeObject(object3d) {
  object3d.traverse((child) => {
    if (child.isMesh) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose && m.dispose());
        } else if (child.material.dispose) {
          child.material.dispose();
        }
      }
    }
  });
}

function showLoading(visible, text) {
  const el = document.getElementById("loading-screen");
  if (!el) return;
  if (text) {
    const p = el.querySelector("p");
    if (p) p.textContent = text;
  }
  el.classList.toggle("hidden", !visible);
}

//----------------------------------------
// ---------Interactive effects-----------
//----------------------------------------
function addInteractiveEffects() {
  if (_interactiveAttached) return;
  if (!renderer || !camera) {
    console.warn("Renderer or camera missing; skipping interactive effects.");
    return;
  }
  _interactiveAttached = true;
  // Mouse interaction with the mesh
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const canvas = renderer.domElement;

  function onDomMouseMove(event) {
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    lastCanvasRect = rect;
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    // Mark raycast to be run by animation loop
    window.__raycastMouse = { x: mouse.x, y: mouse.y };
  }

  function onDomClick(event) {
    // Update normalized coords immediately so click hit is responsive
    const rect = canvas.getBoundingClientRect();
    const mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const my = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera({ x: mx, y: my }, camera);

    // Prefer currentMesh clicks for primitives
    if (currentMesh) {
      const intersects = raycaster.intersectObject(currentMesh, false);
      if (intersects.length > 0) {
        animateClick();
      }
    }
  }

  function animateClick() {
    if (!currentMesh) return;
    if (typeof TWEEN === "undefined") return; // only if tween lib available

    const originalScale = currentMesh.scale.clone();
    const targetScale = originalScale.clone().multiplyScalar(1.2);

    // Scale up
    const scaleUp = new TWEEN.Tween(currentMesh.scale)
      .to(targetScale, 150)
      .easing(TWEEN.Easing.Quadratic.Out);

    // Scale back down
    const scaleDown = new TWEEN.Tween(currentMesh.scale)
      .to(originalScale, 150)
      .easing(TWEEN.Easing.Quadratic.Out);

    scaleUp.chain(scaleDown);
    scaleUp.start();
  }

  // Expose a processing function to be called from the render loop in a throttled way
  window.__processRaycast = function () {
    if (!window.__raycastMouse) return;
    const m = window.__raycastMouse;
    raycaster.setFromCamera(m, camera);

    if (currentMesh) {
      const intersects = raycaster.intersectObject(currentMesh, false);
      const canvas = renderer.domElement;

      if (intersects.length > 0) {
        // Highlight effect on hover
        try {
          if (currentMesh.material && currentMesh.material.emissive) {
            currentMesh.material.emissive.setHex(0x111111);
          }
          if (lastCursorState !== "pointer") {
            canvas.style.cursor = "pointer";
            lastCursorState = "pointer";
          }
        } catch (e) {
          // ignore material state errors
        }
      } else {
        try {
          if (currentMesh.material && currentMesh.material.emissive) {
            currentMesh.material.emissive.setHex(0x000000);
          }
          if (lastCursorState !== "default") {
            canvas.style.cursor = "default";
            lastCursorState = "default";
          }
        } catch (e) { }
      }
    }
  };

  // Parallax by tracking viewport mouse position (lightweight)
  function onWindowMouseMove(e) {
    const nx = (e.clientX / window.innerWidth) * 2 - 1; // -1..1
    const ny = (e.clientY / window.innerHeight) * 2 - 1; // -1..1
    targetOrbitOffset.x = nx * 0.5; // subtle
    targetOrbitOffset.y = -ny * 0.3; // subtle
  }

  // Adjust canvas opacity slightly by scroll position for depth
  const setOpacityByScroll = () => {
    const top = window.scrollY;
    const max = 600; // after hero
    // Allow per-page override for base/max opacity
    const baseAttr = canvas.getAttribute("data-baseopacity");
    const maxAttr = canvas.getAttribute("data-maxopacity");
    const base = baseAttr ? parseFloat(baseAttr) : 0.18;
    const maxOpacity = maxAttr ? parseFloat(maxAttr) : 0.35;
    const extra = Math.min(top / max, 1) * (maxOpacity - base);
    canvas.style.opacity = Math.min(base + extra, maxOpacity).toFixed(2);
  }
  // Attach listeners to renderer.domElement and window (only once)
  canvas.addEventListener("mousemove", onDomMouseMove);
  canvas.addEventListener("click", onDomClick);
  window.addEventListener("mousemove", onWindowMouseMove);
  window.addEventListener("scroll", setOpacityByScroll);
  setOpacityByScroll();

  // Keep a reference cleanup function in case disposeScene wants to remove (optional)
  window.__interactiveCleanup = () => {
    try {
      canvas.removeEventListener("mousemove", onDomMouseMove);
      canvas.removeEventListener("click", onDomClick);
      window.removeEventListener("mousemove", onWindowMouseMove);
      window.removeEventListener("scroll", setOpacityByScroll);
    } catch (e) { }
    delete window.__processRaycast;
    delete window.__interactiveCleanup;
    _interactiveAttached = false;
  };
}

// Initialize when page loads
document.addEventListener("DOMContentLoaded", () => {
  // Initialize theme first before anything else
  // initTheme();

  // If the 3D canvas exists, we're on the home page; otherwise, dashboard-only page.
  const hasThree = !!document.getElementById("three-canvas");
  if (hasThree) {
    console.log("🎯 Initializing 3D Demo...");
    init();
    console.log("✅ 3D Demo ready!");
  }
  // Initialize GitHub dashboard UI if present on the page
  initGithubDashboard();
  // Initialize the mini 3D viewer on github.html if present
  initMiniViewer();
  // Delay recommendations to allow auth setup
  setTimeout(initRecommendations, 1500);

  // Listen for auth changes to apply preferences
  window.addEventListener("xaytheon:authchange", async (e) => {
    const user = e.detail.user;
    if (user) {
      // User logged in, fetch prefs
      const prefs = await window.XAYTHEON_AUTH.fetchPreferences();
      if (prefs && prefs.theme) {
        setTheme(prefs.theme);
        localStorage.setItem("xaytheon:theme", prefs.theme);
      }
    }
  });
});


// ===================== DARK MODE / THEME MANAGEMENT =====================
function initTheme() {
  const savedTheme = localStorage.getItem("xaytheon:theme");
  if (savedTheme) {
    setTheme(savedTheme);
  } else {
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      setTheme("dark");
    } else {
      setTheme("light");
    }
  }

  if (window.matchMedia) {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (e) => {
        if (!localStorage.getItem("xaytheon:theme")) {
          setTheme(e.matches ? "dark" : "light");
        }
      });
  }

  const toggleBtn = document.getElementById("theme-toggle");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", toggleTheme);
  }
}

function toggleTheme() {
  const currentTheme =
    document.documentElement.getAttribute("data-theme") || "light";
  const newTheme = currentTheme === "light" ? "dark" : "light";
  setTheme(newTheme);
  saveTheme(newTheme);
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);

  const themeIcon = document.querySelector(".theme-icon");
  if (themeIcon) {
    // Set common SVG attributes
    themeIcon.setAttribute("fill", "none");
    themeIcon.setAttribute("stroke", "currentColor");
    themeIcon.setAttribute("stroke-width", "2");
    themeIcon.setAttribute("stroke-linecap", "round");
    themeIcon.setAttribute("stroke-linejoin", "round");

    if (theme === "dark") {
      // Moon icon
      themeIcon.innerHTML = `
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            `;
    } else {
      // Sun icon
      themeIcon.innerHTML = `
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            `;
    }
  }
  updateCanvasForTheme(theme);
}

/**
 * Save theme preference to localStorage
 * @param {string} theme - 'light' or 'dark'
 * 
 */
function saveTheme(theme) {
  try {
    localStorage.setItem("xaytheon:theme", theme);

    // Sync with backend if logged in
    if (window.XAYTHEON_AUTH && window.XAYTHEON_AUTH.isAuthenticated()) {
      window.XAYTHEON_AUTH.savePreferences({ theme });
    }
  } catch (e) {
    console.warn("Could not save theme:", e);
  }
}

/**
 * Update 3D canvas opacity based on theme
 * @param {string} theme - 'light' or 'dark'
 */
function updateCanvasForTheme(theme) {
  const canvas = document.getElementById("three-canvas");
  if (!canvas) return;
}

// -----------------------------
// Developer console instructions
// -----------------------------
// Add some console instructions for developers
console.log(`
🎯 Interactive 3D Demo - Developer Console
==========================================

Available global variables:
- scene: Three.js scene object
- camera: Perspective camera
- renderer: WebGL renderer
- controls: Orbit controls
- currentMesh: Current 3D shape

Try these commands:
- scene.children: See all objects in scene
- currentMesh.rotation.set(0, 0, 0): Reset rotation
- camera.position.set(10, 10, 10): Change camera position

Have fun exploring! 🚀
`);

// ===================== GitHub Dashboard =====================

// Dashboard request state
let dashboardState = "idle";
let requestInFlight = false;

// History Management
const HISTORY_MANAGER = {
  storageKey: "xaytheon:gh:history",
  maxSnapshots: 30,

  saveSnapshot(username, metrics) {
    const history = this.getHistory(username);
    const snapshot = {
      timestamp: Date.now(),
      date: new Date().toISOString(),
      ...metrics
    };

    history.unshift(snapshot);

    if (history.length > this.maxSnapshots) {
      history.splice(this.maxSnapshots);
    }

    const allHistory = JSON.parse(localStorage.getItem(this.storageKey) || "{}");
    allHistory[username] = history;
    localStorage.setItem(this.storageKey, JSON.stringify(allHistory));

    return snapshot;
  },

  getHistory(username) {
    const allHistory = JSON.parse(localStorage.getItem(this.storageKey) || "{}");
    return allHistory[username] || [];
  },

  clearHistory(username) {
    const allHistory = JSON.parse(localStorage.getItem(this.storageKey) || "{}");
    if (username) {
      delete allHistory[username];
      localStorage.setItem(this.storageKey, JSON.stringify(allHistory));
    } else {
      localStorage.removeItem(this.storageKey);
    }
  },

  getPreviousSnapshot(username) {
    const history = this.getHistory(username);
    return history.length > 1 ? history[1] : null;
  }
};

// Cache management with TTL
const GITHUB_CACHE = {
  TTL: 10 * 60 * 1000,
  prefix: "xaytheon:gh:",

  set(key, data) {
    localStorage.setItem(
      this.prefix + key,
      JSON.stringify({ data, timestamp: Date.now() })
    );
  },

  get(key, ignoreExpiration = false) {
    const raw = localStorage.getItem(this.prefix + key);
    if (!raw) return null;

    const entry = JSON.parse(raw);
    if (!ignoreExpiration && Date.now() - entry.timestamp > this.TTL) {
      // Mark as expired but return date so caller can decide
      return { data: entry.data, expired: true, timestamp: entry.timestamp };
    }
    return { data: entry.data, expired: false, timestamp: entry.timestamp };
  },

  clear() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(this.prefix))
      .forEach((k) => localStorage.removeItem(k));
  },
};

// Chart instance
let historyChart = null;

// ---------------- UI STATE HANDLER ----------------
function setDashboardState(state, message = "") {
  dashboardState = state;

  const submitBtn = document.querySelector(
    '#github-form button[type="submit"]'
  );
  const clearBtn = document.getElementById("gh-clear");
  const status = document.getElementById("github-status");

  const loading = state === "loading";

  if (submitBtn && clearBtn) {
    submitBtn.disabled = loading;
    clearBtn.disabled = loading;
    submitBtn.textContent = loading ? "Loading…" : "Load Dashboard";
  }

  if (status) {
    status.textContent = message;
    status.className = `github-status ${state}`;
  }
}

// Helper to clear dashboard UI
function clearDashboardUI() {
  const avatar = document.getElementById("gh-avatar");
  if (avatar) avatar.src = "";

  ["gh-name", "gh-login", "gh-bio"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "";
  });

  ["gh-followers", "gh-following", "gh-repos-count"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "0";
  });

  const repoList = document.getElementById("gh-repo-list");
  if (repoList) repoList.innerHTML = '<div class="muted">Load a dashboard to see repositories</div>';

  const activityList = document.getElementById("gh-activity-list");
  if (activityList) activityList.innerHTML = '<li class="activity-item muted">Load a dashboard to see activity</li>';

  const contribSvg = document.getElementById("gh-contrib-svg");
  if (contribSvg) contribSvg.innerHTML = '<div class="muted">Load a dashboard to see contributions</div>';

  ["gh-pr-metrics", "gh-languages"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
}

// ---------------- INIT ----------------
function initGithubDashboard() {
  const form = document.getElementById("github-form");
  if (!form) return;

  const usernameInput = document.getElementById("gh-username");

  const saved = JSON.parse(localStorage.getItem("xaytheon:ghCreds") || "null");
  if (saved?.username) {
    usernameInput.value = saved.username;
    loadGithubDashboard(saved.username);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();

    if (!username) {
      setDashboardState("error", "Please enter a GitHub username.");
      return;
    }

    if (requestInFlight) {
      setDashboardState("error", "Dashboard is already loading. Please wait.");
      return;
    }

    localStorage.setItem(
      "xaytheon:ghCreds",
      JSON.stringify({ username })
    );

    loadGithubDashboard(username);
  });

  // Clear Cache button - preserves history
  document.getElementById("gh-clear").addEventListener("click", () => {
    if (requestInFlight) return;

    // Clear credentials and cache, but KEEP history
    localStorage.removeItem("xaytheon:ghCreds");
    GITHUB_CACHE.clear();
    usernameInput.value = "";

    // Clear the UI display but don't delete history data
    clearDashboardUI();
    setDashboardState("idle", "Cache cleared. History preserved.");
    renderMetricsTrends(null, null);
    renderHistoryChart([]);
    renderSnapshotList([]);
  });

  // Clear History button - only clears snapshots, not cache
  document.getElementById("clear-history").addEventListener("click", () => {
    const username = usernameInput.value.trim();

    if (!username) {
      // If no username in input, ask user to confirm clearing ALL history
      if (confirm("Clear history for ALL users? This cannot be undone.")) {
        HISTORY_MANAGER.clearHistory(); // Clear all
        renderMetricsTrends(null, null);
        renderHistoryChart([]);
        renderSnapshotList([]);
        setDashboardState("success", "All user history cleared.");
      }
    } else {
      // Clear history for current username only
      if (confirm(`Clear history for ${username}? This cannot be undone.`)) {
        HISTORY_MANAGER.clearHistory(username);
        renderMetricsTrends(null, null);
        renderHistoryChart([]);
        renderSnapshotList([]);
        setDashboardState("success", `History cleared for ${username}.`);
      }
    }
  });
}

// ---------------- LOAD DASHBOARD ----------------
async function loadGithubDashboard(username) {
  requestInFlight = true;
  setDashboardState("loading", "Loading GitHub dashboard…");

  const cacheKey = `dashboard:${username}`;
  const cached = GITHUB_CACHE.get(cacheKey, true); // Get even if expired

  if (cached && !cached.expired) {
    renderDashboardData(cached.data, username);
    setDashboardState(
      "success",
      "Loaded from cache • refreshing in background ♻️"
    );
    requestInFlight = false;
    fetchAndCacheDashboard(username);
    return;
  }

  try {
    const user = await ghJson(
      `https://api.github.com/users/${username}`
    );

    const repos = await ghJson(
      `https://api.github.com/users/${username}/repos?per_page=100`
    );

    const events = await ghJson(
      `https://api.github.com/users/${username}/events/public?per_page=25`
    );

    const topRepos = repos
      .filter((r) => !r.fork)
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 8);

    const data = {
      user,
      repos: topRepos,
      events: events.slice(0, 10),
    };

    GITHUB_CACHE.set(cacheKey, data);

    // Save metrics snapshot
    const metrics = {
      followers: user.followers,
      following: user.following,
      repos: user.public_repos,
      stars: topRepos.reduce((sum, r) => sum + r.stargazers_count, 0)
    };
    HISTORY_MANAGER.saveSnapshot(username, metrics);

    renderDashboardData(data, username);
    updateHistoryVisualization(username);
    setDashboardState("success", "Dashboard loaded successfully ✅");
  } catch (e) {
    // If we have an expired cache, show it as fallback
    if (cached && cached.expired) {
      console.warn("API failed, falling back to expired cache", e);
      renderDashboardData(cached.data, username);
      setDashboardState("success", "API rate limited. Showing cached data (may be outdated). ⚠️");
      // No need to throw here, we handled it gracefully
    } else {
      setDashboardState(
        "error",
        e.message || "Failed to load GitHub data"
      );
    }
  } finally {
    requestInFlight = false;
  }
}


async function fetchAndCacheDashboard(username) {
  try {
    const user = await ghJson(`https://api.github.com/users/${username}`);
    const repos = await ghJson(`https://api.github.com/users/${username}/repos?per_page=100`);
    const events = await ghJson(`https://api.github.com/users/${username}/events/public?per_page=25`);

    const topRepos = repos
      .filter((r) => !r.fork)
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 8);

    const data = { user, repos: topRepos, events: events.slice(0, 10) };
    GITHUB_CACHE.set(`dashboard:${username}`, data);

    // Save metrics snapshot during background refresh
    const metrics = {
      followers: user.followers,
      following: user.following,
      repos: user.public_repos,
      stars: topRepos.reduce((sum, r) => sum + r.stargazers_count, 0)
    };
    HISTORY_MANAGER.saveSnapshot(username, metrics);

    // Update visualization if this is the current user
    const currentUsername = document.getElementById("gh-username")?.value.trim();
    if (currentUsername === username) {
      updateHistoryVisualization(username);
    }
  } catch (e) {
    console.warn("Background refresh failed:", e);
  }
}

// ---------------- HISTORY VISUALIZATION ----------------
function updateHistoryVisualization(username) {
  const history = HISTORY_MANAGER.getHistory(username);
  const current = history[0];
  const previous = history[1] || null;

  renderMetricsTrends(current, previous);
  renderHistoryChart(history);
  renderSnapshotList(history);
}

function renderMetricsTrends(current, previous) {
  const container = document.getElementById("metrics-trends");
  if (!container) return;

  if (!current) {
    container.innerHTML = '<div class="muted">Load a dashboard to see trends</div>';
    return;
  }

  const metrics = [
    { label: "Followers", key: "followers" },
    { label: "Following", key: "following" },
    { label: "Repositories", key: "repos" },
    { label: "Total Stars", key: "stars" }
  ];

  container.innerHTML = metrics.map(metric => {
    const currentVal = current[metric.key] || 0;
    const previousVal = previous ? (previous[metric.key] || 0) : currentVal;
    const change = currentVal - previousVal;

    let trendClass = "neutral";
    let trendIcon = "—";
    let trendText = "No change";

    if (change > 0) {
      trendClass = "up";
      trendIcon = "▲";
      trendText = `+${change}`;
    } else if (change < 0) {
      trendClass = "down";
      trendIcon = "▼";
      trendText = `${change}`;
    }

    return `
      <div class="metric-item">
        <div class="metric-label">${metric.label}</div>
        <div class="metric-value-container">
          <div class="metric-current">${currentVal}</div>
          ${previous ? `<div class="metric-trend ${trendClass}">${trendIcon} ${trendText}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderHistoryChart(history) {
  const canvas = document.getElementById("history-chart");
  if (!canvas) return;

  // Destroy previous chart
  if (historyChart) {
    historyChart.destroy();
  }

  if (history.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data to display', canvas.width / 2, canvas.height / 2);
    return;
  }

  const sortedHistory = [...history].reverse();
  const labels = sortedHistory.map(s => {
    const date = new Date(s.timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  const ctx = canvas.getContext('2d');
  historyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Followers',
          data: sortedHistory.map(s => s.followers || 0),
          borderColor: 'rgb(99, 102, 241)',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          tension: 0.4
        },
        {
          label: 'Repos',
          data: sortedHistory.map(s => s.repos || 0),
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          tension: 0.4
        },
        {
          label: 'Stars',
          data: sortedHistory.map(s => s.stars || 0),
          borderColor: 'rgb(251, 191, 36)',
          backgroundColor: 'rgba(251, 191, 36, 0.1)',
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: 'rgba(255, 255, 255, 0.8)',
            font: { size: 11 }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: 'rgba(255, 255, 255, 0.6)',
            maxRotation: 45,
            minRotation: 45,
            font: { size: 10 }
          },
          grid: { color: 'rgba(255, 255, 255, 0.1)' }
        },
        y: {
          ticks: { color: 'rgba(255, 255, 255, 0.6)' },
          grid: { color: 'rgba(255, 255, 255, 0.1)' }
        }
      }
    }
  });
}

function renderSnapshotList(history) {
  const container = document.getElementById("snapshot-list");
  if (!container) return;

  if (history.length === 0) {
    container.innerHTML = '<div class="muted">No snapshots yet</div>';
    return;
  }

  container.innerHTML = history.slice(0, 10).map(snapshot => {
    const date = new Date(snapshot.timestamp);
    const dateStr = date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <div class="snapshot-item">
        <div class="snapshot-date">${dateStr}</div>
        <div class="snapshot-metrics">
          <div>👥 ${snapshot.followers || 0}</div>
          <div>📦 ${snapshot.repos || 0}</div>
          <div>⭐ ${snapshot.stars || 0}</div>
        </div>
      </div>
    `;
  }).join('');
}

// Helper function to render cached dashboard data
function renderDashboardData(data, username) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  const avatar = document.getElementById("gh-avatar");

  // Render user profile
  if (avatar) avatar.src = data.user.avatar_url;
  set("gh-name", data.user.name || "—");
  set("gh-login", `@${data.user.login}`);
  set("gh-bio", data.user.bio || "");
  set("gh-followers", data.user.followers ?? 0);
  set("gh-following", data.user.following ?? 0);
  set("gh-repos-count", (data.user.public_repos ?? data.repos.length) + "");

  // Render repos
  renderRepos(data.repos);

  // Render activity
  renderActivity(data.events);

  // Render contributions chart
  const setDisplay = (id, disp) => {
    const el = document.getElementById(id);
    if (el) el.style.display = disp;
  };
  const contribNote = document.getElementById("gh-contrib-note");
  const container = document.getElementById("gh-contrib-svg");

  if (contribNote)
    contribNote.textContent =
      "Full-year chart via third-party (ghchart.rshah.org). If it fails, we will show an approximate heatmap.";
  setDisplay("gh-contrib-note", "block");

  if (container) {
    container.innerHTML = '<div class="muted">Loading public contributions…</div>';
    const img = new Image();
    img.src = `https://ghchart.rshah.org/${encodeURIComponent(username)}`;
    img.alt = `${username}'s contributions (third-party chart)`;
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    img.referrerPolicy = "no-referrer";
    img.onload = () => {
      container.innerHTML = "";
      container.appendChild(img);
    };
    img.onerror = () => {
      try {
        const svg = renderEventHeatmap(data.events);
        container.innerHTML = svg;
        if (contribNote)
          contribNote.textContent =
            "Approximate heatmap based on recent public activity.";
      } catch (e) {
        console.warn("Event heatmap failed", e);
        container.innerHTML =
          '<div class="muted">No activity found to render a heatmap.</div>';
      }
    };
  }

  // Update history visualization
  updateHistoryVisualization(username);

  // Render language stats
  renderLanguageStats(data.repos);

  // Render PR metrics
  renderPrMetrics(data.events);
}

function renderLanguageStats(repos) {
  const container = document.getElementById("gh-languages");
  const list = document.getElementById("gh-language-list");

  if (!container || !list) return;

  if (!repos || repos.length === 0) {
    container.style.display = "none";
    return;
  }

  const counts = {};
  let total = 0;

  repos.forEach(repo => {
    if (repo.language) {
      counts[repo.language] = (counts[repo.language] || 0) + 1;
      total++;
    }
  });

  if (total === 0) {
    container.style.display = "none";
    return;
  }

  // Sort by count desc
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  list.innerHTML = sorted.map(([lang, count]) => {
    const pct = Math.round((count / total) * 100);
    return `
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.9rem;">
                <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
                    <span style="min-width: 80px;">${lang}</span>
                    <div style="flex-grow: 1; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                        <div style="width: ${pct}%; height: 100%; background: #6366f1; border-radius: 3px;"></div>
                    </div>
                    <span style="font-size: 0.8rem; opacity: 0.7; min-width: 30px; text-align: right;">${pct}%</span>
                </div>
            </div>
        `;
  }).join('');

  container.style.display = "block";
}

function renderPrMetrics(events) {
  const container = document.getElementById("gh-pr-metrics");
  const openedEl = document.getElementById("pr-opened");
  const mergedEl = document.getElementById("pr-merged");
  const closedEl = document.getElementById("pr-closed");

  if (!container || !openedEl || !mergedEl || !closedEl) return;

  let opened = 0;
  let merged = 0;
  let closed = 0;

  if (events && events.length > 0) {
    events.forEach(ev => {
      if (ev.type === "PullRequestEvent") {
        const action = ev.payload.action;
        const pr = ev.payload.pull_request;

        if (action === "opened") {
          opened++;
        } else if (action === "closed") {
          if (pr && pr.merged) {
            merged++;
          } else {
            closed++;
          }
        }
      }
    });
  }

  // Only show if there is some activity
  if (opened === 0 && merged === 0 && closed === 0) {
    container.style.display = "none";
    return;
  }

  openedEl.textContent = opened;
  mergedEl.textContent = merged;
  closedEl.textContent = closed;
  container.style.display = "block";
}

async function ghJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "XAYTHEON-GitHub-Dashboard",
      ...headers,
    },
  });

  // Extract Rate Limit Headers
  const limit = res.headers.get("X-RateLimit-Limit");
  const remaining = res.headers.get("X-RateLimit-Remaining");

  if (limit && remaining) {
    updateRateLimitUI(remaining, limit);
  }

  // Check for rate limiting
  if (res.status === 403 || res.status === 429) {
    const resetTime = res.headers.get('X-RateLimit-Reset');
    const remainingVal = res.headers.get('X-RateLimit-Remaining');

    if (remainingVal === '0' || res.status === 429) {
      const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000) : null;
      const waitTime = resetDate ? Math.ceil((resetDate - Date.now()) / 60000) : 'unknown';
      throw new Error(`⚠️ GitHub API rate limit exceeded. Please try again in ${waitTime} minutes.`);
    }
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }
  return res.json();
}

function updateRateLimitUI(remaining, limit) {
  const badge = document.getElementById("gh-rate-limit-badge");
  const remEl = document.getElementById("gh-rate-remaining");
  const limEl = document.getElementById("gh-rate-limit");

  if (badge && remEl && limEl) {
    badge.style.display = "inline-block";
    remEl.textContent = remaining;
    limEl.textContent = limit;

    if (parseInt(remaining) < 5) {
      badge.style.background = "rgba(239, 68, 68, 0.15)";
      badge.style.color = "#ef4444";
    } else {
      badge.style.background = "rgba(99, 102, 241, 0.1)";
      badge.style.color = "#6366f1";
    }
  }
}

function renderRepos(repos) {
  const list = document.getElementById("gh-repo-list");
  if (!list) return;
  if (!repos || repos.length === 0) {
    list.innerHTML = '<div class="muted">No repositories found.</div>';
    return;
  }
  list.innerHTML = repos
    .map((r) => {
      const safeRepo = JSON.stringify({
        full_name: r.full_name,
        language: r.language,
        html_url: r.html_url
      }).replace(/"/g, "&quot;");

      return `
        <div class="repo-item">
            <div class="repo-name"><a href="${r.html_url}" target="_blank" rel="noopener" onclick='trackRepoView(${safeRepo})'>${escapeHtml(r.full_name)}</a></div>
            ${r.description ? `<div class="repo-desc">${escapeHtml(r.description)}</div>` : ""}
            <div class="repo-meta">
                <span>★ ${r.stargazers_count || 0}</span>
                <span>⑂ ${r.forks_count || 0}</span>
                ${r.language ? `<span>${r.language}</span>` : ""}
                <span>Updated ${timeAgo(r.updated_at)}</span>
                <span><a href="health.html?repo=${r.full_name}" style="text-decoration:none; color:inherit;" title="Check Sustainability">🩺 Health</a></span>
            </div>
        </div>
    `;
    })
    .join("");
}

function renderActivity(events) {
  const list = document.getElementById("gh-activity-list");
  if (!list) return;
  if (!events || events.length === 0) {
    list.innerHTML = '<li class="activity-item muted">No recent public activity.</li>';
    return;
  }
  list.innerHTML = events
    .map((ev) => {
      const type = ev.type || "Event";
      const repo = ev.repo?.name || "";
      const when = timeAgo(ev.created_at);
      const what = describeEvent(ev);
      return `<li class="activity-item"><div>${escapeHtml(what || type)}${repo ? ` in <a href="https://github.com/${repo}" target="_blank" rel="noopener">${escapeHtml(repo)}</a>` : ""}</div><div class="activity-time">${when}</div></li>`;
    })
    .join("");
}

function describeEvent(ev) {
  switch (ev.type) {
    case "PushEvent":
      return `Pushed ${ev.payload?.commits?.length || 0} commit(s)`;
    case "CreateEvent":
      return `Created ${ev.payload?.ref_type || "item"} ${ev.payload?.ref || ""}`;
    case "IssuesEvent":
      return `Issue ${ev.payload?.action} #${ev.payload?.issue?.number}`;
    case "PullRequestEvent":
      return `Pull request ${ev.payload?.action} #${ev.payload?.pull_request?.number}`;
    case "WatchEvent":
      return `Starred`;
    case "ForkEvent":
      return `Forked`;
    default:
      return ev.type;
  }
}

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  const units = [
    ["year", 365 * 24 * 3600],
    ["month", 30 * 24 * 3600],
    ["day", 24 * 3600],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [name, secs] of units) {
    const v = Math.floor(s / secs);
    if (v >= 1) return `${v} ${name}${v > 1 ? "s" : ""} ago`;
  }
  return "just now";
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str).replace(
    /[&<>"']/g,
    (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s])
  );
}

async function fetchContributionSvg(username, token) {
  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays { color contributionCount date }
            }
            colors
            totalContributions
          }
        }
      }
    }`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables: { login: username } }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error(json.errors?.[0]?.message || `GraphQL error ${res.status}`);
  }
  const cal = json.data.user.contributionsCollection.contributionCalendar;
  const cell = 10, gap = 2;
  const rows = 7, cols = cal.weeks.length;
  const width = cols * (cell + gap) + gap;
  const height = rows * (cell + gap) + gap + 20;
  let rects = "";
  cal.weeks.forEach((w, x) => {
    w.contributionDays.forEach((d, y) => {
      const cx = gap + x * (cell + gap);
      const cy = gap + y * (cell + gap);
      rects += `<rect x="${cx}" y="${cy}" width="${cell}" height="${cell}" rx="2" ry="2" fill="${d.color || "#ebedf0"}"><title>${d.date}: ${d.contributionCount} contributions</title></rect>`;
    });
  });
  const label = `<text x="${gap}" y="${height - 4}" font-size="10" fill="#666">Total: ${cal.totalContributions}</text>`;
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img">${rects}${label}</svg>`;
}

function renderEventHeatmap(events) {
  if (!Array.isArray(events) || events.length === 0)
    return '<div class="muted">No recent public activity.</div>';

  const today = new Date();
  const daysBack = 90;
  const start = new Date(today.getTime() - daysBack * 24 * 3600 * 1000);

  const toKey = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
  const counts = new Map();

  for (let i = 0; i <= daysBack; i++) {
    const d = new Date(start.getTime() + i * 24 * 3600 * 1000);
    counts.set(toKey(new Date(d.toISOString())), 0);
  }

  for (const ev of events) {
    if (!ev.created_at) continue;
    const d = new Date(ev.created_at);
    if (d < start || d > today) continue;
    const k = toKey(new Date(d.toISOString()));
    counts.set(k, (counts.get(k) || 0) + 1);
  }

  const cell = 10, gap = 2;
  const dates = Array.from(counts.keys()).sort();
  if (dates.length === 0) return '<div class="muted">No recent public activity.</div>';

  const firstDate = new Date(dates[0] + "T00:00:00Z");
  const offset = firstDate.getUTCDay();
  const totalDays = dates.length + offset;
  const cols = Math.ceil(totalDays / 7);

  const values = dates.map((d) => counts.get(d) || 0);
  const max = Math.max(1, ...values);
  const colors = ["#ebedf0", "#c6e48b", "#7bc96f", "#239a3b", "#196127"];
  const colorFor = (v) => {
    if (v <= 0) return colors[0];
    const idx = Math.min(4, Math.ceil((v / max) * 4));
    return colors[idx];
  };

  const width = cols * (cell + gap) + gap;
  const height = 7 * (cell + gap) + gap + 20;
  let rects = "";

  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < 7; y++) {
      const dayIndex = x * 7 + y - offset;
      if (dayIndex < 0 || dayIndex >= dates.length) continue;
      const d = dates[dayIndex];
      const v = counts.get(d) || 0;
      const cx = gap + x * (cell + gap);
      const cy = gap + y * (cell + gap);
      rects += `<rect x="${cx}" y="${cy}" width="${cell}" height="${cell}" rx="2" ry="2" fill="${colorFor(v)}"><title>${d}: ${v} event(s)</title></rect>`;
    }
  }
  const label = `<text x="${gap}" y="${height - 4}" font-size="10" fill="#666">Approx. last ${daysBack} days</text>`;
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img">${rects}${label}</svg>`;
}

// ===================== Mini 3D viewer (github.html) =====================
function initMiniViewer() {
  const canvas = document.getElementById("mini-3d-canvas");
  if (!canvas) return;
  if (typeof THREE === "undefined" || !THREE.GLTFLoader) {
    const loadingEl = canvas.parentElement?.querySelector(".mini-3d-loading");
    if (loadingEl) loadingEl.textContent = "3D unavailable";
    return;
  }

  const container = canvas.parentElement;
  const loadingEl = container?.querySelector(".mini-3d-loading");

  const miniRenderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  miniRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  miniRenderer.setClearColor(0x000000, 0);
  const miniScene = new THREE.Scene();
  const miniCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  miniCamera.position.set(2.2, 1.8, 2.2);
  miniCamera.lookAt(0, 0, 0);

  // size helper
  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    miniRenderer.setSize(w, h);
    miniCamera.aspect = w / h;
    miniCamera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  // Lighting
  miniScene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(3, 5, 2);
  miniScene.add(dir);
  const fill = new THREE.DirectionalLight(0x88aaff, 0.5);
  fill.position.set(-2, 1, -2);
  miniScene.add(fill);

  // Load model
  const loader = new THREE.GLTFLoader();
  loader.load(
    "assets/models/github.glb",
    (gltf) => {
      const model = gltf.scene;
      // Normalize size and center at origin
      centerAndScale(model, 3.0);
      // Ensure visibility: if materials are transparent or very dark, replace with a neutral white standard material
      model.traverse((child) => {
        if (child.isMesh) {
          const m = child.material;
          const needsReplace = !m || (m.transparent && (m.opacity == null || m.opacity < 0.2));
          if (needsReplace) {
            child.material = new THREE.MeshStandardMaterial({
              color: 0xffffff,
              metalness: 0.1,
              roughness: 0.7,
            });
          }
        }
      });

      // Create a pivot at origin so rotation is about a fixed axis
      const pivot = new THREE.Object3D();
      scene.add(pivot);
      pivot.add(model);

      // Extra centering pass to be safe
      const box = new THREE.Box3().setFromObject(model);
      const c = new THREE.Vector3();
      box.getCenter(c);
      model.position.sub(c); // ensure model mass center is at pivot

      if (loadingEl) loadingEl.style.display = "none";

      // Axis rotation (change axis vector as needed)
      const axis = new THREE.Vector3(0, 1, 0).normalize(); // Y-axis spin
      const speed = 0.012;

      function animate() {
        requestAnimationFrame(animate);
        pivot.rotateOnAxis(axis, speed);
        renderer.render(scene, camera);
      }
      // Reframe camera lightly to model bounds in the mini viewer
      const bbox = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      bbox.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const dist = maxDim * 1.8;
      camera.position.set(dist, dist * 0.8, dist);
      camera.lookAt(0, 0, 0);
      animate();
    },
    undefined,
    (err) => {
      console.warn("Mini viewer model load failed:", err);
      if (loadingEl) loadingEl.textContent = "3D failed to load";
    }
  );
}

const dots = document.querySelectorAll(".cursor-dot");

const historyLength = dots.length;
const mouseHistory = Array.from({ length: historyLength }, () => ({
  x: 0,
  y: 0,
}));

let mouseX = 0;
let mouseY = 0;

// Current visual positions (for smoothing)
const visualPositions = Array.from({ length: historyLength }, () => ({
  x: 0,
  y: 0,
}));

document.addEventListener("mousemove", (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

function animateCursorTrail() {
  // Add current mouse position to history
  mouseHistory.unshift({ x: mouseX, y: mouseY });
  mouseHistory.pop();

  dots.forEach((dot, index) => {
    const target = mouseHistory[index];
    const current = visualPositions[index];

    // Smooth easing (THIS controls speed)
    current.x += (target.x - current.x) * 0.18;
    current.y += (target.y - current.y) * 0.18;

    dot.style.left = current.x + "px";
    dot.style.top = current.y + "px";
  });

  requestAnimationFrame(animateCursorTrail);
}

animateCursorTrail();

//navbar
const menuIcon = document.querySelector(".menu-icon");
const menuCloseIcon = document.querySelector(".menu-close-icon");
const navMenu = document.querySelector(".nav-menu");

// Open Menu
menuIcon.addEventListener("click", () => {
  navMenu.classList.add("active");
  menuIcon.style.display = "none";
  menuCloseIcon.style.display = "block";
});

// Close Menu
menuCloseIcon.addEventListener("click", () => {
  navMenu.classList.remove("active");
  menuIcon.style.display = "block";
  menuCloseIcon.style.display = "none";
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 890) {
    navMenu.classList.remove("active");
    menuIcon.style.display = "none";
    menuCloseIcon.style.display = "none";
  } else {
    if (!navMenu.classList.contains("active")) {
      menuIcon.style.display = "block";
    }
  }
});


// ===================== Recommendation Engine =====================
const HISTORY_KEY = "xaytheon:view_history";

// Track a repository view
// Track a repository view
window.trackRepoView = async function (repo) {
  try {
    let history = [];

    // Check if user is logged in
    const isAuthed = window.XAYTHEON_AUTH && window.XAYTHEON_AUTH.isAuthenticated();

    if (isAuthed) {
      try {
        const res = await window.XAYTHEON_AUTH.authenticatedFetch(`${window.location.protocol === "https:" ? "https://your-api-domain.com/api/user" : "http://localhost:5000/api/user"}/history`);
        if (res.ok) {
          history = await res.json();
        }
      } catch (e) { console.warn("Failed to fetch fresh history", e); }
    }

    // If empty (network fail or not authed), try local storage
    if (history.length === 0) {
      history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    }

    // Remove if already exists (to move to top)
    const filtered = history.filter(h => h.full_name !== repo.full_name);

    // Add to top
    filtered.unshift({
      full_name: repo.full_name,
      language: repo.language,
      html_url: repo.html_url,
      visited_at: Date.now()
    });

    // Limit to 50
    if (filtered.length > 50) filtered.length = 50;

    // Save to LocalStorage (always as backup/cache)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));

    // Save to Backend if authed
    if (isAuthed) {
      await window.XAYTHEON_AUTH.authenticatedFetch(
        `${window.location.protocol === "https:" ? "https://your-api-domain.com/api/user" : "http://localhost:5000/api/user"}/history`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ history: filtered })
        }
      ).catch(e => console.warn("Failed to sync history to backend", e));

      // Auto-update recommendations
      initRecommendations();
    }

  } catch (e) {
    console.warn("Tracking failed", e);
  }
};

async function initRecommendations() {
  const recArea = document.getElementById("recommendations-area");
  const emptyArea = document.getElementById("rec-empty");
  const list = document.getElementById("rec-list");

  if (!recArea || !list) {
    return;
  }

  if (!window.XAYTHEON_AUTH || !window.XAYTHEON_AUTH.isAuthenticated()) {
    recArea.classList.add("hidden");
    if (emptyArea) emptyArea.classList.add("hidden");
    const authReq = document.querySelector("[data-requires-auth]");
    if (authReq) authReq.style.display = "none";
    return;
  } else {
    const authReq = document.querySelector("[data-requires-auth]");
    if (authReq) authReq.style.display = "block";
  }

  let history = [];
  let localHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");

  // Try to load from backend if authenticated and merge
  try {
    const res = await window.XAYTHEON_AUTH.authenticatedFetch(`${window.location.protocol === "https:" ? "https://your-api-domain.com/api/user" : "http://localhost:5000/api/user"}/history`);
    if (res.ok) {
      const remoteHistory = await res.json();

      // Merge Logic
      if (remoteHistory.length === 0 && localHistory.length > 0) {
        // Push local to backend
        history = localHistory;
        window.XAYTHEON_AUTH.authenticatedFetch(
          `${window.location.protocol === "https:" ? "https://your-api-domain.com/api/user" : "http://localhost:5000/api/user"}/history`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ history: localHistory })
          }
        );
      } else {
        // Intelligent Merge
        const map = new Map();
        remoteHistory.forEach(h => map.set(h.full_name, h));
        localHistory.forEach(h => {
          if (!map.has(h.full_name)) map.set(h.full_name, h);
        });
        history = Array.from(map.values()).sort((a, b) => (b.visited_at || 0) - (a.visited_at || 0)).slice(0, 50);
      }

      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } else {
      throw new Error("Backend failed");
    }
  } catch (e) {
    console.warn("Could not fetch remote history, falling back to local", e);
    history = localHistory;
  }

  // Track a search interest
  const SEARCH_HISTORY_KEY = "xaytheon:search_history";
  window.trackSearchInterest = function (topic, language) {
    if (!topic && !language) return;
    let history = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]");

    // Add to top
    history.unshift({
      topic: topic || "",
      language: language || "",
      ts: Date.now()
    });

    // Limit to 20
    if (history.length > 20) history.length = 20;

    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  };

  // Analyze history (clicks)
  const languages = {};
  const topics = {};

  history.forEach(h => {
    if (h.language) languages[h.language] = (languages[h.language] || 0) + 2; // Weight clicks higher
    // We don't strictly track topics in repo view history yet, but we could if we stored them.
  });

  // Analyze search history
  const searchHistory = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]");
  searchHistory.forEach(s => {
    if (s.language) languages[s.language] = (languages[s.language] || 0) + 1;
    if (s.topic) topics[s.topic] = (topics[s.topic] || 0) + 1;
  });

  const topLangs = Object.entries(languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(e => e[0]);

  const topTopics = Object.entries(topics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(e => e[0]);

  // Fallback query if no data
  let q = "";
  if (topLangs.length === 0 && topTopics.length === 0) {
    q = "stars:>1000";
    recArea.classList.remove("hidden");
    if (emptyArea) emptyArea.classList.add("hidden");
  } else {
    // Build complex query
    const parts = [];
    topLangs.forEach(l => parts.push(`language:${l}`));
    topTopics.forEach(t => parts.push(`topic:${t}`));
    q = parts.join(" ");
  }

  // Fetch recommendations
  recArea.classList.remove("hidden");
  emptyArea.classList.add("hidden");

  if (!list.hasChildNodes() || list.innerText.includes("Loading")) {
    list.innerHTML = '<div class="muted">Loading personal recommendations...</div>';
  }

  try {
    const encodedQ = encodeURIComponent(q);
    const url = `https://api.github.com/search/repositories?q=${encodedQ}&sort=stars&order=desc&per_page=20`;

    const data = await ghJson(url);

    // Client side filter
    const viewedNames = new Set(history.map(h => h.full_name));
    const recommendations = (data.items || [])
      .filter(r => !viewedNames.has(r.full_name))
      .slice(0, 6);

    if (recommendations.length === 0) {
      // Retry with broader query if specific failed
      if (q !== "stars:>500") {
        const fallbackUrl = `https://api.github.com/search/repositories?q=stars:>1000&sort=stars&order=desc&per_page=10`;
        const fallbackData = await ghJson(fallbackUrl);
        if (fallbackData && fallbackData.items) {
          renderRecommendationCards(fallbackData.items.slice(0, 6));
          return;
        }
      }

      // HARD FALLBACK
      const hardcoded = [
        { full_name: "facebook/react", name: "react", description: "Hardcoded Fallback 1", language: "JavaScript", stargazers_count: 200000, owner: { login: "facebook" }, html_url: "https://github.com/facebook/react" },
        { full_name: "vuejs/vue", name: "vue", description: "Hardcoded Fallback 2", language: "JavaScript", stargazers_count: 180000, owner: { login: "vuejs" }, html_url: "https://github.com/vuejs/vue" }
      ];
      renderRecommendationCards(hardcoded);
      return;
    }

    renderRecommendationCards(recommendations);

  } catch (e) {
    console.error("Recs failed", e);
    // HARD FALLBACK on error
    const hardcoded = [
      { full_name: "facebook/react", name: "react", description: "Error Fallback 1", language: "JavaScript", stargazers_count: 200000, owner: { login: "facebook" }, html_url: "https://github.com/facebook/react" },
      { full_name: "vuejs/vue", name: "vue", description: "Error Fallback 2", language: "JavaScript", stargazers_count: 180000, owner: { login: "vuejs" }, html_url: "https://github.com/vuejs/vue" }
    ];
    renderRecommendationCards(hardcoded);
  }
}

function renderRecommendationCards(repos) {
  const list = document.getElementById("rec-list");
  if (!list) return;
  list.innerHTML = repos.map(r => {
    const safeRepo = JSON.stringify({
      full_name: r.full_name,
      language: r.language,
      html_url: r.html_url
    }).replace(/"/g, "&quot;");

    return `
    <div class="card repo-card">
       <div class="repo-header">
         <div class="repo-name">
           <a href="${r.html_url}" target="_blank" onclick='trackRepoView(${safeRepo})'>${escapeHtml(r.name)}</a>
         </div>
         <span class="repo-lang">${r.language || ''}</span>
       </div>
       <div class="repo-desc">${escapeHtml(r.description || 'No description')}</div>
       <div class="repo-meta">
         <span>★ ${r.stargazers_count}</span>
         <span class="repo-owner">by ${escapeHtml(r.owner.login)}</span>
       </div>
    </div>
    `;
  }).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  // Wait a bit for auth to initialize before fetching recs
  setTimeout(initRecommendations, 1500);
});

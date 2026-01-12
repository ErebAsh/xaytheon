// Global variables
let scene, camera, renderer, controls;
let currentMesh; // for primitives
let currentModel; // for GLTF/GLB models
let autoRotationSpeed = 0.01;
let isAutoRotating = true;
let parallaxEnabled = true;
let targetOrbitOffset = { x: 0, y: 0 };
let currentOrbitOffset = { x: 0, y: 0 };

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
    // Get canvas element
    const canvas = document.getElementById('three-canvas');
    const container = document.querySelector('.canvas-container');
    
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
        canvas: canvas, 
        antialias: true,
        alpha: true // allow DOM/page background to show through
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Add lighting
    setupLighting();
    
    // Load model: allow page to specify a different model via data-model
    const modelPath = canvas && canvas.dataset.model ? canvas.dataset.model : 'assets/models/prism.glb';
    loadGltfFromUrl(modelPath, undefined, () => {
        console.warn('Falling back to primitive shape because prism.glb failed to load.');
        safeCreatePrimitiveFallback();
    });
    
    // Setup controls
    setupControls();
    
    // Setup event listeners
    setupEventListeners();
    
    // Hide loading screen
    // and announce completion
setTimeout(() => {
    const loader = document.getElementById('loading-screen');
    loader.classList.add('hidden');

    // Screen reader announcement
    const doneMsg = document.createElement('div');
    doneMsg.setAttribute('role', 'status');
    doneMsg.setAttribute('aria-live', 'polite');
    doneMsg.classList.add('sr-only'); // visually hidden
    doneMsg.textContent = 'XAYTHEON has finished loading.';
    document.body.appendChild(doneMsg);
}, 1000);

    
    // Start animation loop
    animate();


  // Create scene
  scene = new THREE.Scene();
  // Keep scene background transparent so the site stays white
  // renderer will composite over the white page background

  // Create camera
  camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
  camera.position.set(5, 5, 5);

  // Create renderer
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true, // allow DOM/page background to show through
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Add lighting
  setupLighting();


  // Setup controls
  setupControls();

  // Setup event listeners
  setupEventListeners();

  // Hide loading screen
  setTimeout(() => {
    document.getElementById("loading-screen").classList.add("hidden");
  }, 1000);

  // Start animation loop
  animate();
 main
}

// Setup lighting
function setupLighting() {
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

// Create a 3D shape
function createShape(shapeType) {
  // Remove existing mesh
  if (currentMesh) {
    scene.remove(currentMesh);
    currentMesh.geometry.dispose();
    currentMesh.material.dispose();
  }
  // Hide/remove model if present when switching to primitive
  if (currentModel) {
    scene.remove(currentModel);
    disposeObject(currentModel);
    currentModel = null;
  }

  // Create new geometry
  const geometry = shapes[shapeType]();

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
  // Guard optional controls if they exist in DOM
  const shapeSel = document.getElementById("shape-selector");
  if (shapeSel)
    shapeSel.addEventListener("change", (e) => createShape(e.target.value));

  const colorPicker = document.getElementById("color-picker");
  if (colorPicker)
    colorPicker.addEventListener("input", (e) => {
      if (currentMesh) currentMesh.material.color.set(e.target.value);
    });

  const wireframeToggle = document.getElementById("wireframe-toggle");
  if (wireframeToggle)
    wireframeToggle.addEventListener("change", (e) => {
      if (currentMesh) currentMesh.material.wireframe = e.target.checked;
    });

  const rotationSpeed = document.getElementById("rotation-speed");
  if (rotationSpeed)
    rotationSpeed.addEventListener("input", (e) => {
      autoRotationSpeed = parseFloat(e.target.value);
      isAutoRotating = autoRotationSpeed > 0;
    });

  const resetBtn = document.getElementById("reset-camera");
  if (resetBtn)
    resetBtn.addEventListener("click", () => {
      camera.position.set(5, 5, 5);
      controls.reset();
    });

  const fileInput = document.getElementById("model-file");
  if (fileInput) fileInput.addEventListener("change", handleModelUpload);

  const sampleBtn = document.getElementById("load-sample");
  if (sampleBtn)
    sampleBtn.addEventListener("click", () => {
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
  const aspectRatio = container.clientWidth / container.clientHeight;

  camera.aspect = aspectRatio;
  camera.updateProjectionMatrix();

  renderer.setSize(container.clientWidth, container.clientHeight);
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Auto rotation
  if (currentMesh && isAutoRotating) {
    currentMesh.rotation.x += autoRotationSpeed;
    currentMesh.rotation.y += autoRotationSpeed * 1.5;
  }

  // Update tweens
  if (typeof TWEEN !== "undefined") {
    TWEEN.update();
  }

  // Update controls
  // Parallax: subtly nudge controls target toward mouse-based offset
  if (parallaxEnabled && controls) {
    // ease offsets
    currentOrbitOffset.x += (targetOrbitOffset.x - currentOrbitOffset.x) * 0.05;
    currentOrbitOffset.y += (targetOrbitOffset.y - currentOrbitOffset.y) * 0.05;
    controls.target.set(currentOrbitOffset.x, currentOrbitOffset.y, 0);
  }
  controls.update();

  // Rotate the loaded model around its Y axis continuously
  if (currentModel && isAutoRotating) {
    currentModel.rotation.y += autoRotationSpeed;
  }

  // Render scene
  renderer.render(scene, camera);
}

// ---------- GLTF MODEL LOADING ----------
function handleModelUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  loadGltfFromUrl(url, () => URL.revokeObjectURL(url));
}

function loadGltfFromUrl(url, onDone, onError) {
  showLoading(true, "Loading Model...");
  const loader = new THREE.GLTFLoader();
  loader.load(
    url,
    (gltf) => {
      if (currentMesh) {
        scene.remove(currentMesh);
        currentMesh.geometry.dispose();
        currentMesh.material.dispose();
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

// Add some interactive effects
function addInteractiveEffects() {
  // Mouse interaction with the mesh
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function onMouseMove(event) {
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();

    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    if (currentMesh) {
      const intersects = raycaster.intersectObject(currentMesh);

      if (intersects.length > 0) {
        // Highlight effect on hover
        currentMesh.material.emissive.setHex(0x111111);
        canvas.style.cursor = "pointer";
      } else {
        currentMesh.material.emissive.setHex(0x000000);
        canvas.style.cursor = "default";
      }
    }
  }

  function onMouseClick(event) {
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();

    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    if (currentMesh) {
      const intersects = raycaster.intersectObject(currentMesh);

      if (intersects.length > 0) {
        // Add click animation
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

  // Add event listeners
  renderer.domElement.addEventListener("mousemove", onMouseMove);
  renderer.domElement.addEventListener("click", onMouseClick);

  // Parallax: track mouse position relative to viewport
  window.addEventListener("mousemove", (e) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1; // -1..1
    const ny = (e.clientY / window.innerHeight) * 2 - 1; // -1..1
    targetOrbitOffset.x = nx * 0.5; // subtle
    targetOrbitOffset.y = -ny * 0.3; // subtle
  });

  // Adjust canvas opacity slightly by scroll position for depth
  const canvas = renderer.domElement;
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
  };
  window.addEventListener("scroll", setOpacityByScroll);
  setOpacityByScroll();
}

// Initialize when page loads
document.addEventListener("DOMContentLoaded", () => {
  // Initialize theme first before anything else
  initTheme();

  // If the 3D canvas exists, we're on the home page; otherwise, dashboard-only page.
  const hasThree = !!document.getElementById("three-canvas");
  if (hasThree) {
    console.log("🎯 Initializing 3D Demo...");
    init();
    addInteractiveEffects();
    console.log("✅ 3D Demo ready!");
  }
  // Initialize GitHub dashboard UI if present on the page
  initGithubDashboard();
  // Initialize the mini 3D viewer on github.html if present
  initMiniViewer();
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

function saveTheme(theme) {
  localStorage.setItem("xaytheon:theme", theme);
}

/**
 * Save theme preference to localStorage
 * @param {string} theme - 'light' or 'dark'
 */
function saveTheme(theme) {
  localStorage.setItem("xaytheon:theme", theme);
}

/**
 * Update 3D canvas opacity based on theme
 * @param {string} theme - 'light' or 'dark'
 */
function updateCanvasForTheme(theme) {
  const canvas = document.getElementById("three-canvas");
  if (!canvas) return;
}

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
let dashboardState = "idle"; // idle | loading | success | error
let requestInFlight = false;

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

  get(key) {
    const raw = localStorage.getItem(this.prefix + key);
    if (!raw) return null;

    const entry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > this.TTL) {
      localStorage.removeItem(this.prefix + key);
      return null;
    }
    return entry.data;
  },

  clear() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(this.prefix))
      .forEach((k) => localStorage.removeItem(k));
  },
};

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

  document.getElementById("gh-clear").addEventListener("click", () => {
    if (requestInFlight) return;

    localStorage.removeItem("xaytheon:ghCreds");
    GITHUB_CACHE.clear();
    usernameInput.value = "";
    setDashboardState("idle", "Dashboard cleared.");
  });
}

// ---------------- LOAD DASHBOARD ----------------
async function loadGithubDashboard(username) {
  requestInFlight = true;
  setDashboardState("loading", "Loading GitHub dashboard…");

  const cacheKey = `dashboard:${username}`;
  const cached = GITHUB_CACHE.get(cacheKey);

  if (cached) {
    renderDashboardData(cached, username);
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
    renderDashboardData(data, username);
    setDashboardState("success", "Dashboard loaded successfully ✅");
  } catch (e) {
    setDashboardState(
      "error",
      e.message || "Failed to load GitHub data"
    );
  } finally {
    requestInFlight = false;
  }
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
}

async function ghJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "XAYTHEON-GitHub-Dashboard",
      ...headers,
    },
  });
  
  // Check for rate limiting
  if (res.status === 403 || res.status === 429) {
    const resetTime = res.headers.get('X-RateLimit-Reset');
    const remaining = res.headers.get('X-RateLimit-Remaining');
    
    if (remaining === '0' || res.status === 429) {
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
            <div class="repo-name"><a href="${r.html_url
        }" target="_blank" rel="noopener" onclick='trackRepoView(${safeRepo})'>${escapeHtml(
          r.full_name
        )}</a></div>
            ${r.description
          ? `<div class="repo-desc">${escapeHtml(r.description)}</div>`
          : ""
        }
            <div class="repo-meta">
                <span>★ ${r.stargazers_count || 0}</span>
                <span>⑂ ${r.forks_count || 0}</span>
                ${r.language ? `<span>${r.language}</span>` : ""}
                <span>Updated ${timeAgo(r.updated_at)}</span>
            </div>
        </div>
    `
    })
    .join("");
}

function renderActivity(events) {
  const list = document.getElementById("gh-activity-list");
  if (!list) return;
  if (!events || events.length === 0) {
    list.innerHTML =
      '<li class="activity-item muted">No recent public activity.</li>';
    return;
  }
  list.innerHTML = events
    .map((ev) => {
      const type = ev.type || "Event";
      const repo = ev.repo?.name || "";
      const when = timeAgo(ev.created_at);
      const what = describeEvent(ev);
      return `<li class="activity-item"><div>${escapeHtml(what || type)}${repo
        ? ` in <a href="https://github.com/${repo}" target="_blank" rel="noopener">${escapeHtml(
          repo
        )}</a>`
        : ""
        }</div><div class="activity-time">${when}</div></li>`;
    })
    .join("");
}

function describeEvent(ev) {
  switch (ev.type) {
    case "PushEvent":
      return `Pushed ${ev.payload?.commits?.length || 0} commit(s)`;
    case "CreateEvent":
      return `Created ${ev.payload?.ref_type || "item"} ${ev.payload?.ref || ""
        }`;
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
    (s) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
      s
    ])
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
  // Build a simple SVG calendar from the data (compact)
  const cal = json.data.user.contributionsCollection.contributionCalendar;
  const cell = 10,
    gap = 2;
  const rows = 7,
    cols = cal.weeks.length;
  const width = cols * (cell + gap) + gap;
  const height = rows * (cell + gap) + gap + 20;
  let rects = "";
  cal.weeks.forEach((w, x) => {
    w.contributionDays.forEach((d, y) => {
      const cx = gap + x * (cell + gap);
      const cy = gap + y * (cell + gap);
      rects += `<rect x="${cx}" y="${cy}" width="${cell}" height="${cell}" rx="2" ry="2" fill="${d.color || "#ebedf0"
        }">
                <title>${d.date}: ${d.contributionCount} contributions</title>
            </rect>`;
    });
  });
  const label = `<text x="${gap}" y="${height - 4
    }" font-size="10" fill="#666">Total: ${cal.totalContributions}</text>`;
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img">${rects}${label}</svg>`;
}

// Build an approximate heatmap from public events (tokenless fallback)
function renderEventHeatmap(events) {
  if (!Array.isArray(events) || events.length === 0)
    return '<div class="muted">No recent public activity.</div>';

  // Count events per day for the past ~90 days (limited by API)
  const today = new Date();
  const daysBack = 90;
  const start = new Date(today.getTime() - daysBack * 24 * 3600 * 1000);

  // Normalize to midnight UTC for consistency
  const toKey = (d) =>
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
      .toISOString()
      .slice(0, 10);
  const counts = new Map();

  // Seed zero counts for all days in range
  for (let i = 0; i <= daysBack; i++) {
    const d = new Date(start.getTime() + i * 24 * 3600 * 1000);
    counts.set(toKey(new Date(d.toISOString())), 0);
  }

  // Tally events by created_at date
  for (const ev of events) {
    if (!ev.created_at) continue;
    const d = new Date(ev.created_at);
    if (d < start || d > today) continue;
    const k = toKey(new Date(d.toISOString()));
    counts.set(k, (counts.get(k) || 0) + 1);
  }

  // Prepare grid data by weeks (columns) and weekdays (rows)
  const cell = 10,
    gap = 2;
  const dates = Array.from(counts.keys()).sort();
  if (dates.length === 0)
    return '<div class="muted">No recent public activity.</div>';

  // Align start to Sunday for calendar style
  const firstDate = new Date(dates[0] + "T00:00:00Z");
  const offset = firstDate.getUTCDay(); // 0=Sun
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

  // Iterate by column/week
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < 7; y++) {
      const dayIndex = x * 7 + y - offset;
      if (dayIndex < 0 || dayIndex >= dates.length) continue;
      const d = dates[dayIndex];
      const v = counts.get(d) || 0;
      const cx = gap + x * (cell + gap);
      const cy = gap + y * (cell + gap);
      rects += `<rect x="${cx}" y="${cy}" width="${cell}" height="${cell}" rx="2" ry="2" fill="${colorFor(
        v
      )}">
                <title>${d}: ${v} event(s)</title>
            </rect>`;
    }
  }
  const label = `<text x="${gap}" y="${height - 4
    }" font-size="10" fill="#666">Approx. last ${daysBack} days</text>`;
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img">${rects}${label}</svg>`;
}

// ===================== Mini 3D viewer (github.html) =====================
function initMiniViewer() {
  const canvas = document.getElementById("mini-3d-canvas");
  if (!canvas) return;
  // If libs missing, show a friendly message instead of hanging
  if (typeof THREE === "undefined" || !THREE.GLTFLoader) {
    const loadingEl = canvas.parentElement?.querySelector(".mini-3d-loading");
    if (loadingEl) loadingEl.textContent = "3D unavailable";
    return;
  }

  const container = canvas.parentElement;
  const loadingEl = container?.querySelector(".mini-3d-loading");

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0); // transparent
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(2.2, 1.8, 2.2);
  camera.lookAt(0, 0, 0);

  // size helper
  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(3, 5, 2);
  scene.add(dir);
  const fill = new THREE.DirectionalLight(0x88aaff, 0.5);
  fill.position.set(-2, 1, -2);
  scene.add(fill);

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
          const needsReplace =
            !m || (m.transparent && (m.opacity == null || m.opacity < 0.2));
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

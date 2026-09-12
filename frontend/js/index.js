import { motion, animate, inView, stagger } from 'https://cdn.jsdelivr.net/npm/framer-motion@11.0.8/+esm';

/* ================================================================
   BASIC SETUP
   ================================================================ */
document.getElementById("year").textContent = new Date().getFullYear();

window.scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
window.toggleMenu = () => document.getElementById("navLinks").classList.toggle("open");

document.querySelectorAll(".nav-links a").forEach(link => {
  link.addEventListener("click", () => {
    document.getElementById("navLinks").classList.remove("open");
  });
});

const navbar = document.getElementById("navbar");
window.addEventListener("scroll", () => {
  navbar.classList.toggle("scrolled", window.scrollY > 30);
});

/* ================================================================
   CUSTOM CURSOR (with Framer Motion spring for the ring)
   ================================================================ */
const cursorDot = document.getElementById("cursorDot");
const cursorRing = document.getElementById("cursorRing");

if (window.matchMedia('(pointer: fine)').matches) {
  let mouseX = 0, mouseY = 0, ringX = 0, ringY = 0;

  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursorDot.style.left = mouseX + "px";
    cursorDot.style.top = mouseY + "px";
  });

  // Smooth spring-like follow for ring
  function animateRing() {
    ringX += (mouseX - ringX) * 0.18;
    ringY += (mouseY - ringY) * 0.18;
    cursorRing.style.left = ringX + "px";
    cursorRing.style.top = ringY + "px";
    requestAnimationFrame(animateRing);
  }
  animateRing();

  document.querySelectorAll("a, button, .role-card, .feature, .stat-item, .floating-card").forEach(el => {
    el.addEventListener("mouseenter", () => cursorRing.classList.add("hovering"));
    el.addEventListener("mouseleave", () => cursorRing.classList.remove("hovering"));
  });
}

/* ================================================================
   THREE.JS 3D BACKGROUND
   ================================================================ */
(function initThree() {
  const canvas = document.getElementById("bg-canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 8;

  const particlesCount = 900;
  const positions = new Float32Array(particlesCount * 3);
  const colors = new Float32Array(particlesCount * 3);
  const colorChoices = [
    new THREE.Color(0x6366f1),
    new THREE.Color(0xa855f7),
    new THREE.Color(0x22d3ee),
    new THREE.Color(0x818cf8)
  ];

  for (let i = 0; i < particlesCount; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 30;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 30;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 30;

    const c = colorChoices[Math.floor(Math.random() * colorChoices.length)];
    colors[i * 3]     = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const createCircleTexture = () => {
    const size = 64;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.4, "rgba(255,255,255,0.6)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  };

  const particleMat = new THREE.PointsMaterial({
    size: 0.14,
    map: createCircleTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  const icoGeo = new THREE.IcosahedronGeometry(2.2, 1);
  const icoMat = new THREE.MeshBasicMaterial({
    color: 0x6366f1, wireframe: true, transparent: true, opacity: 0.12
  });
  const ico = new THREE.Mesh(icoGeo, icoMat);
  ico.position.set(4, -0.5, -3);
  scene.add(ico);

  const torusGeo = new THREE.TorusKnotGeometry(1.1, 0.3, 90, 12);
  const torusMat = new THREE.MeshBasicMaterial({
    color: 0xa855f7, wireframe: true, transparent: true, opacity: 0.14
  });
  const torus = new THREE.Mesh(torusGeo, torusMat);
  torus.position.set(-5, 1.5, -5);
  scene.add(torus);

  const octGeo = new THREE.OctahedronGeometry(1.2, 0);
  const octMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.15
  });
  const oct = new THREE.Mesh(octGeo, octMat);
  oct.position.set(-3.5, -2.5, -4);
  scene.add(oct);

  let tMouseX = 0, tMouseY = 0;
  window.addEventListener("mousemove", (e) => {
    tMouseX = (e.clientX / window.innerWidth) * 2 - 1;
    tMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  const clock = new THREE.Clock();
  function animateScene() {
    requestAnimationFrame(animateScene);
    const t = clock.getElapsedTime();

    particles.rotation.y = t * 0.025;
    particles.rotation.x = Math.sin(t * 0.1) * 0.08;

    ico.rotation.x = t * 0.15;
    ico.rotation.y = t * 0.2;
    torus.rotation.x = t * 0.2;
    torus.rotation.y = t * 0.15;
    oct.rotation.x = -t * 0.25;
    oct.rotation.z = t * 0.18;

    camera.position.x += (tMouseX * 1.2 - camera.position.x) * 0.03;
    camera.position.y += (tMouseY * 1.2 - camera.position.y) * 0.03;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
  }
  animateScene();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();

/* ================================================================
   FRAMER MOTION — HERO ENTRANCE
   ================================================================ */
const heroBadge = document.getElementById("heroBadge");
const heroTitle = document.getElementById("heroTitle");
const heroPara = document.getElementById("heroPara");
const heroActions = document.getElementById("heroActions");

// Initial hidden state
[heroBadge, heroTitle, heroPara, heroActions].forEach(el => {
  el.style.opacity = "0";
  el.style.transform = "translateY(28px)";
});

// Animate with Framer Motion stagger
animate(heroBadge, { opacity: 1, y: 0 }, { duration: 0.7, ease: [0.22, 1, 0.36, 1] });
animate(heroTitle, { opacity: 1, y: 0 }, { duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] });
animate(heroPara, { opacity: 1, y: 0 }, { duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] });
animate(heroActions, { opacity: 1, y: 0 }, { duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] });

/* ================================================================
   FRAMER MOTION — FLOATING CARDS (continuous float + hover)
   ================================================================ */
document.querySelectorAll(".floating-card").forEach((card, i) => {
  card.style.opacity = "0";
  card.style.transform = "translateY(20px)";

  // Entrance
  animate(card, { opacity: 1, y: 0 }, {
    duration: 0.8,
    delay: 0.4 + i * 0.15,
    ease: [0.22, 1, 0.36, 1]
  });

  // Continuous float animation
  const floatY = [-14, 0, -14];
  animate(card,
    { transform: [
      `translateY(0px) translateZ(40px)`,
      `translateY(-18px) translateZ(55px)`,
      `translateY(0px) translateZ(40px)`
    ]},
    { duration: 6 + i * 0.8, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }
  );
});

/* ================================================================
   FRAMER MOTION — HERO PARALLAX ON MOUSE
   ================================================================ */
(function heroParallax() {
  const heroVisual = document.getElementById("heroVisual");
  const cards = document.querySelectorAll(".floating-card");
  if (!heroVisual || !window.matchMedia('(pointer: fine)').matches) return;

  let currentX = 0, currentY = 0;
  let targetX = 0, targetY = 0;

  heroVisual.addEventListener("mousemove", (e) => {
    const rect = heroVisual.getBoundingClientRect();
    targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
  });

  heroVisual.addEventListener("mouseleave", () => {
    targetX = 0;
    targetY = 0;
  });

  function lerp() {
    currentX += (targetX - currentX) * 0.08;
    currentY += (targetY - currentY) * 0.08;

    cards.forEach((card) => {
      const depth = parseFloat(card.dataset.depth) || 1;
      const moveX = currentX * depth * 14;
      const moveY = currentY * depth * 14;
      const rotY = currentX * depth * 8;
      const rotX = -currentY * depth * 8;
      const tz = 40 + depth * 10;
      card.style.transform = `translate(${moveX}px, ${moveY}px) translateZ(${tz}px) rotateY(${rotY}deg) rotateX(${rotX}deg)`;
    });
    requestAnimationFrame(lerp);
  }
  lerp();
})();

/* ================================================================
   FRAMER MOTION — SECTION HEADERS (scroll-triggered)
   ================================================================ */
const sectionHeaders = document.querySelectorAll(".section-header");
sectionHeaders.forEach(header => {
  header.style.opacity = "0";
  header.style.transform = "translateY(36px)";
  inView(header, () => {
    animate(header, { opacity: 1, y: 0 }, { duration: 0.8, ease: [0.22, 1, 0.36, 1] });
  }, { margin: "0px 0px -80px 0px" });
});

/* ================================================================
   FRAMER MOTION — ROLE CARDS (stagger + 3D tilt)
   ================================================================ */
const roleCards = document.querySelectorAll(".role-card");
roleCards.forEach(card => {
  card.style.opacity = "0";
  card.style.transform = "translateY(40px) scale(0.97)";
});

inView("#rolesGrid", () => {
  roleCards.forEach((card, i) => {
    animate(card,
      { opacity: 1, y: 0, scale: 1 },
      { duration: 0.8, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }
    );
  });
}, { margin: "0px 0px -60px 0px" });

// 3D tilt on hover using Framer Motion
roleCards.forEach(card => {
  card.addEventListener("mousemove", (e) => {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    animate(card, {
      rotateY: x * 8,
      rotateX: -y * 8,
      y: -10,
      scale: 1.01
    }, { duration: 0.3, ease: "easeOut" });
  });

  card.addEventListener("mouseleave", () => {
    animate(card, {
      rotateY: 0,
      rotateX: 0,
      y: 0,
      scale: 1
    }, { duration: 0.5, ease: [0.22, 1, 0.36, 1] });
  });
});

/* ================================================================
   FRAMER MOTION — FEATURE CARDS (stagger + 3D tilt)
   ================================================================ */
const featureCards = document.querySelectorAll(".feature");
featureCards.forEach(card => {
  card.style.opacity = "0";
  card.style.transform = "translateY(36px) scale(0.97)";
});

inView("#featuresGrid", () => {
  featureCards.forEach((card, i) => {
    animate(card,
      { opacity: 1, y: 0, scale: 1 },
      { duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }
    );
  });
}, { margin: "0px 0px -60px 0px" });

featureCards.forEach(card => {
  card.addEventListener("mousemove", (e) => {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    animate(card, {
      rotateY: x * 6,
      rotateX: -y * 6,
      y: -8,
      scale: 1.02
    }, { duration: 0.3, ease: "easeOut" });
  });

  card.addEventListener("mouseleave", () => {
    animate(card, {
      rotateY: 0,
      rotateX: 0,
      y: 0,
      scale: 1
    }, { duration: 0.5, ease: [0.22, 1, 0.36, 1] });
  });
});

/* ================================================================
   FRAMER MOTION — STATS (stagger + counter)
   ================================================================ */
const statItems = document.querySelectorAll(".stat-item");
statItems.forEach(item => {
  item.style.opacity = "0";
  item.style.transform = "translateY(30px) scale(0.96)";
});

inView("#stats", () => {
  statItems.forEach((item, i) => {
    animate(item,
      { opacity: 1, y: 0, scale: 1 },
      { duration: 0.7, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }
    );
  });

  // Counters
  document.querySelectorAll(".stat-num").forEach(el => {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || "";
    const decimals = parseInt(el.dataset.decimals || "0", 10);

    animate(0, target, {
      duration: 1.8,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        let display;
        if (decimals > 0) {
          display = latest.toFixed(decimals);
        } else if (target >= 1000) {
          display = Math.floor(latest / 1000) + "K";
        } else {
          display = Math.floor(latest).toString();
        }
        el.textContent = display + suffix;
      },
      onComplete: () => {
        if (decimals > 0) el.textContent = target.toFixed(decimals) + suffix;
        else if (target >= 1000) el.textContent = (target / 1000) + "K" + suffix;
        else el.textContent = target + suffix;
      }
    });
  });
}, { margin: "0px 0px -60px 0px" });

// Hover lift for stat items
statItems.forEach(item => {
  item.addEventListener("mouseenter", () => {
    animate(item, { y: -8, scale: 1.03 }, { duration: 0.3, ease: "easeOut" });
  });
  item.addEventListener("mouseleave", () => {
    animate(item, { y: 0, scale: 1 }, { duration: 0.5, ease: [0.22, 1, 0.36, 1] });
  });
});

/* ================================================================
   FRAMER MOTION — CTA ENTRANCE
   ================================================================ */
const cta = document.getElementById("cta");
cta.style.opacity = "0";
cta.style.transform = "translateY(40px) scale(0.97)";

inView(cta, () => {
  animate(cta,
    { opacity: 1, y: 0, scale: 1 },
    { duration: 0.9, ease: [0.22, 1, 0.36, 1] }
  );
}, { margin: "0px 0px -80px 0px" });

/* ================================================================
   FRAMER MOTION — CONTINUOUS BACKGROUND AURORA DRIFT
   ================================================================ */
document.querySelectorAll(".aurora").forEach((aurora, i) => {
  animate(aurora,
    {
      x: [0, 40 + i * 15, -30 + i * 10, 0],
      y: [0, -30 - i * 10, 40 + i * 12, 0],
      scale: [1, 1.12, 0.95, 1]
    },
    {
      duration: 18 + i * 3,
      repeat: Infinity,
      ease: "easeInOut",
      delay: i * 2
    }
  );
});

/* ================================================================
   FRAMER MOTION — LOGO MARK ROTATION
   ================================================================ */
document.querySelectorAll(".logo-mark").forEach(mark => {
  animate(mark, { rotate: 360 }, { duration: 8, repeat: Infinity, ease: "linear" });
});

/* ================================================================
   FRAMER MOTION — LIVE DOT PULSE
   ================================================================ */
document.querySelectorAll(".live-dot").forEach(dot => {
  animate(dot, { scale: [1, 0.5, 1], opacity: [1, 0.5, 1] },
    { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
  );
});

/* ================================================================
   FRAMER MOTION — ORB RINGS ROTATION
   ================================================================ */
const rings = document.querySelectorAll(".orb-ring");
if (rings[0]) animate(rings[0], { rotate: 360 }, { duration: 24, repeat: Infinity, ease: "linear" });
if (rings[1]) animate(rings[1], { rotate: -360 }, { duration: 36, repeat: Infinity, ease: "linear" });

/* ================================================================
   FRAMER MOTION — ORB PULSE
   ================================================================ */
const orb = document.querySelector(".orb");
if (orb) {
  animate(orb, { scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] },
    { duration: 6, repeat: Infinity, ease: "easeInOut" }
  );
}

/* ================================================================
   FRAMER MOTION — NAV LINK HOVER
   ================================================================ */
document.querySelectorAll(".nav-links a").forEach(link => {
  link.addEventListener("mouseenter", () => {
    animate(link, { color: "#ffffff" }, { duration: 0.2 });
  });
  link.addEventListener("mouseleave", () => {
    animate(link, { color: "#8b9bc7" }, { duration: 0.3 });
  });
});

/* ================================================================
   FRAMER MOTION — BUTTON HOVER LIFT
   ================================================================ */
document.querySelectorAll(".btn-primary").forEach(btn => {
  btn.addEventListener("mouseenter", () => {
    animate(btn, { y: -2, scale: 1.02 }, { duration: 0.25, ease: "easeOut" });
  });
  btn.addEventListener("mouseleave", () => {
    animate(btn, { y: 0, scale: 1 }, { duration: 0.4, ease: [0.22, 1, 0.36, 1] });
  });
});

document.querySelectorAll(".btn-ghost").forEach(btn => {
  btn.addEventListener("mouseenter", () => {
    animate(btn, { y: -1 }, { duration: 0.25, ease: "easeOut" });
  });
  btn.addEventListener("mouseleave", () => {
    animate(btn, { y: 0 }, { duration: 0.4, ease: [0.22, 1, 0.36, 1] });
  });
});

/* ================================================================
   FRAMER MOTION — FLOATING CARD HOVER LIFT
   ================================================================ */
document.querySelectorAll(".floating-card").forEach(card => {
  card.addEventListener("mouseenter", () => {
    animate(card, { scale: 1.05 }, { duration: 0.3, ease: "easeOut" });
  });
  card.addEventListener("mouseleave", () => {
    animate(card, { scale: 1 }, { duration: 0.4, ease: [0.22, 1, 0.36, 1] });
  });
});

/* ================================================================
   FRAMER MOTION — CTA GLOW ROTATION (via CSS is fine, but we
   can add a subtle pulse with Framer Motion)
   ================================================================ */
animate(".cta", { boxShadow: [
  "0 40px 80px -30px rgba(99, 102, 241, 0.5)",
  "0 40px 80px -25px rgba(139, 92, 246, 0.7)",
  "0 40px 80px -30px rgba(99, 102, 241, 0.5)"
]}, { duration: 4, repeat: Infinity, ease: "easeInOut" });

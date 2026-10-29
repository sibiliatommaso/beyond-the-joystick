/* ==========================================================================
   Homepage rover — Beyond the Joystick

   Come funziona (in breve):
   - Tutto e' una funzione pura dello scroll:  pose(s) -> {x, y, scale, rot}.
   - Il rover e' UN elemento position:fixed in <body>, mosso solo con transform
     (niente left/top/width => niente layout, movimento fluido).
   - La rotta disegnata e i checkpoint sono ricavati campionando la STESSA
     funzione pose(s): rover e checkpoint coincidono per costruzione.
   - Il rover non passa mai sopra il testo:
       * hero      -> sta nella colonna destra riservata dal CSS;
       * desktop   -> viaggia nel margine destro (gutter) fuori dai .container;
       * schermi stretti (gutter troppo piccolo) -> viaggia su una barra in basso.
   ========================================================================== */
(() => {
  "use strict";

  const BASE_W = 520;        // larghezza CSS del rover (poi scalato con transform)
  const GROUND = 0.40;       // distanza centro -> linea sotto le ruote (frazione dell'altezza)
  const ANCHOR = 0.5;        // altezza (frazione del viewport) a cui viaggia il rover
  const STEP = 16;           // passo di campionamento della rotta (px di scroll)
  const WAVE = 170;          // lunghezza d'onda dell'ondulazione laterale
  const GAP = 120;           // distanza minima tra due checkpoint (px di scroll)
  const TRACK_LINE = 16;     // distanza della linea della barra dal fondo (px)
  const TRACK_PAD = 30;      // margine laterale della barra (px)
  const COMPACT_W = 60;      // larghezza del rover sulla barra (px)
  const MIN_LANE = 44;       // sotto questa larghezza il gutter e' troppo stretto
  const SVG_NS = "http://www.w3.org/2000/svg";

  const rover = document.querySelector("[data-home-rover]");
  const hero = document.querySelector(".hero--rover");
  if (!rover || !hero) return;

  const main = hero.closest("main") || hero.parentElement;
  const heroContent = hero.querySelector(".hero__content");
  if (!main || !heroContent) return;

  const route = main.querySelector("[data-home-rover-route]");
  const glowEl = route && route.querySelector("[data-home-rover-glow]");
  const lineEl = route && route.querySelector("[data-home-rover-path]");
  const doneEl = route && route.querySelector("[data-home-rover-done]");
  const cpGroup = route && route.querySelector("[data-home-rover-checkpoints]");

  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);

  // Fuori da <main>: nessun contesto di sovrapposizione delle sezioni puo'
  // nasconderlo (era questo il motivo per cui spariva dietro Labs e Support).
  document.body.appendChild(rover);
  main.classList.add("home-rover-route-host");

  let G = null;              // geometria misurata
  let track = null;          // barra inferiore (solo schermi stretti)
  let trackDone = null;
  let trackDots = [];
  let cpEls = [];
  let routeLen = [];         // lunghezze cumulate della rotta
  let routeS = [];           // valori di scroll dei campioni
  let renderRaf = 0;
  let rebuildRaf = 0;
  let reachedCount = -1;

  /* ------------------------------------------------------------------ */
  /* POSA DEL ROVER                                                      */
  /* ------------------------------------------------------------------ */

  function trackX(s) {
    const xs = G.dotX;
    const ss = G.sK;
    if (s <= ss[0]) return xs[0];
    for (let k = 1; k < ss.length; k += 1) {
      if (s <= ss[k]) return lerp(xs[k - 1], xs[k], (s - ss[k - 1]) / (ss[k] - ss[k - 1]));
    }
    return xs[xs.length - 1];
  }

  const ground = (scale) => scale * G.H0 * GROUND;

  // Posa in coordinate viewport per uno scroll s.
  function pose(s) {
    const heroScale = G.heroW / BASE_W;
    const hero = { x: G.heroX, y: G.heroY - s, scale: heroScale, rot: 0, op: 1 };
    const t = G.still ? 0 : clamp(s / G.blendLen, 0, 1);
    if (t === 0) return hero;

    if (G.compact) {
      // Hero: il rover esce con la hero sfumando; poi compare sulla barra.
      if (t < 0.45) {
        const u = ease(t / 0.45);
        hero.scale = heroScale * (1 - 0.15 * u);
        hero.op = 1 - u;
        return hero;
      }
      const u = ease(clamp((t - 0.45) / 0.4, 0, 1));
      const sc = COMPACT_W / BASE_W;
      return {
        x: trackX(s),
        y: G.vh - TRACK_LINE - ground(sc) + (1 - u) * 24,
        scale: sc,
        rot: 0,
        op: u
      };
    }

    // Desktop: dalla hero al margine destro, rimpicciolendosi.
    const e = ease(t);
    const sc = G.laneW / BASE_W;
    const ly = G.vh * ANCHOR;
    const yDoc = s + ly - G.mainTop;
    const lx = G.laneCx + G.amp * Math.sin(yDoc / WAVE);
    const tilt = clamp(Math.atan((G.amp * Math.cos(yDoc / WAVE)) / WAVE) * 57.2958, -8, 8);
    return {
      x: lerp(hero.x, lx, e),
      y: lerp(hero.y, ly, e),
      scale: lerp(heroScale, sc, e),
      rot: tilt * e,
      op: 1
    };
  }

  /* ------------------------------------------------------------------ */
  /* MISURE                                                              */
  /* ------------------------------------------------------------------ */

  function measure() {
    const sy = window.scrollY;
    const vw = root.clientWidth;
    const vh = window.innerHeight;
    const still = reduce.matches;

    root.classList.add("home-rover-ready");
    const H0 = rover.offsetHeight || BASE_W * 0.69;

    const mr = main.getBoundingClientRect();
    const hr = hero.getBoundingClientRect();
    const cr = heroContent.getBoundingClientRect();
    const cs = getComputedStyle(heroContent);
    const padR = parseFloat(cs.paddingRight) || 0;
    const padB = parseFloat(cs.paddingBottom) || 0;

    // Posa nella hero: dentro lo spazio che il CSS riserva al rover.
    let heroW;
    let heroX;
    let heroY;
    if (padR >= 120) {
      heroW = clamp(padR - 24, 160, BASE_W);
      heroX = cr.right - padR / 2;
      heroY = cr.top + sy + cr.height / 2;
    } else {
      heroW = clamp(Math.min(230, vw - 48, ((padB - 16) * BASE_W) / H0), 120, BASE_W);
      heroX = cr.left + cr.width / 2;
      heroY = cr.bottom + sy - padB / 2;
    }

    const sections = Array.from(main.querySelectorAll(":scope > section.section"));
    const probe = (sections[0] && sections[0].querySelector(".container")) || heroContent;
    const pr = probe.getBoundingClientRect();

    const gutter = Math.max(0, Math.min(pr.left, vw - pr.right));
    const laneW = Math.min(150, gutter * 0.75);
    const compact = !still && laneW < MIN_LANE;
    root.classList.toggle("home-rover-compact", compact);

    const maxScroll = Math.max(1, root.scrollHeight - vh);
    const firstTop = pr.top + sy;
    const blendLen = clamp(firstTop - vh * ANCHOR - 60, 200, 700);

    // Un checkpoint per la hero + uno per ogni sezione (centrato sul suo titolo).
    const titles = sections
      .map((sec) => sec.querySelector("h2"))
      .filter(Boolean)
      .map((h) => {
        const r = h.getBoundingClientRect();
        return r.top + sy + r.height / 2;
      });
    const raw = [compact ? blendLen * 0.85 : 0].concat(titles.map((c) => c - vh * ANCHOR));
    const sK = raw.slice();
    const n = sK.length;
    for (let k = n - 1; k >= 1; k -= 1) sK[k] = Math.min(sK[k], maxScroll - (n - 1 - k) * GAP);
    for (let k = 1; k < n; k += 1) sK[k] = Math.max(sK[k], sK[k - 1] + GAP);

    const trackL = TRACK_PAD;
    const trackR = vw - TRACK_PAD;
    const dotX = sK.map((_, k) => trackL + (k / Math.max(1, n - 1)) * (trackR - trackL));

    G = {
      still, compact, vw, vh, H0, maxScroll, blendLen, sK, dotX, trackL, trackR,
      heroW, heroX, heroY,
      mainLeft: mr.left,
      mainTop: mr.top + sy,
      mainW: mr.width,
      mainH: main.offsetHeight,
      laneW: compact ? COMPACT_W : laneW,
      laneCx: pr.right + (vw - pr.right) / 2,
      amp: clamp((gutter - laneW) / 2 - 6, 0, 22)
    };
  }

  /* ------------------------------------------------------------------ */
  /* ROTTA, CHECKPOINT E BARRA                                           */
  /* ------------------------------------------------------------------ */

  function svgEl(name, attrs) {
    const el = document.createElementNS(SVG_NS, name);
    Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]));
    return el;
  }

  function clearRoute() {
    [glowEl, lineEl, doneEl].forEach((p) => p && p.setAttribute("d", ""));
    if (cpGroup) cpGroup.textContent = "";
    cpEls = [];
    routeLen = [];
    routeS = [];
    if (route) route.style.display = "none";
  }

  function buildRoute() {
    if (!route || !lineEl || G.compact || G.still) {
      clearRoute();
      return;
    }
    route.style.display = "block";
    route.style.width = `${G.mainW}px`;
    route.style.height = `${G.mainH}px`;
    route.setAttribute("viewBox", `0 0 ${G.mainW} ${G.mainH}`);

    // La rotta e' la traiettoria delle RUOTE: campiono pose(s).
    const pts = [];
    routeS = [];
    routeLen = [];
    let total = 0;
    for (let s = 0; ; s += STEP) {
      const ss = Math.min(s, G.maxScroll);
      const p = pose(ss);
      const x = p.x - G.mainLeft;
      const y = ss + p.y + ground(p.scale) - G.mainTop;
      if (pts.length) {
        const q = pts[pts.length - 1];
        total += Math.hypot(x - q[0], y - q[1]);
      }
      pts.push([x, y]);
      routeS.push(ss);
      routeLen.push(total);
      if (ss >= G.maxScroll) break;
    }
    const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
    [glowEl, lineEl, doneEl].forEach((p) => p && p.setAttribute("d", d));
    if (doneEl) doneEl.style.strokeDasharray = `0 ${total + 1000}`;
    G.routeTotal = total;

    // Checkpoint: posizione = pose(s_k), cioe' dove sara' il rover a quello scroll.
    cpGroup.textContent = "";
    cpEls = G.sK.map((sk, k) => {
      const p = pose(sk);
      const x = p.x - G.mainLeft;
      const y = sk + p.y + ground(p.scale) - G.mainTop;
      const g = svgEl("g", { class: "home-rover-route__checkpoint", transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` });
      g.appendChild(svgEl("circle", { class: "home-rover-route__checkpoint-ring", r: 12 }));
      const label = svgEl("text", { class: "home-rover-route__checkpoint-number", x: 0, y: 0, "text-anchor": "middle" });
      label.textContent = String(k + 1);
      g.appendChild(label);
      cpGroup.appendChild(g);
      return g;
    });
  }

  function buildTrack() {
    if (!G.compact) {
      if (track) track.style.display = "none";
      trackDots = [];
      return;
    }
    if (!track) {
      track = document.createElement("div");
      track.className = "home-rover-track";
      track.setAttribute("aria-hidden", "true");
      track.innerHTML = '<div class="home-rover-track__line"></div><div class="home-rover-track__done"></div>';
      document.body.appendChild(track);
      trackDone = track.querySelector(".home-rover-track__done");
    }
    track.style.display = "block";
    track.style.setProperty("--track-pad", `${G.trackL}px`);
    trackDots.forEach((d) => d.remove());
    trackDots = G.dotX.map((x) => {
      const dot = document.createElement("span");
      dot.className = "home-rover-track__dot";
      dot.style.left = `${x}px`;
      track.appendChild(dot);
      return dot;
    });
  }

  /* ------------------------------------------------------------------ */
  /* RENDER (ad ogni frame di scroll)                                    */
  /* ------------------------------------------------------------------ */

  function render() {
    renderRaf = 0;
    if (!G) return;
    const s = clamp(window.scrollY, 0, G.maxScroll);
    const p = pose(s);

    rover.style.opacity = p.op.toFixed(3);
    rover.style.transform =
      `translate3d(${(p.x - BASE_W / 2).toFixed(2)}px, ${(p.y - G.H0 / 2).toFixed(2)}px, 0) ` +
      `rotate(${p.rot.toFixed(2)}deg) scale(${p.scale.toFixed(4)})`;

    // Checkpoint raggiunti
    let reached = 0;
    for (let k = 0; k < G.sK.length; k += 1) if (s >= G.sK[k] - 2) reached = k + 1;
    if (reached !== reachedCount) {
      reachedCount = reached;
      cpEls.forEach((el, k) => el.classList.toggle("is-reached", k < reached));
      trackDots.forEach((el, k) => el.classList.toggle("is-reached", k < reached));
    }

    // Tratto percorso sulla rotta
    if (doneEl && routeS.length > 1 && G.routeTotal) {
      const i = Math.min(routeS.length - 2, Math.floor(s / STEP));
      const span = routeS[i + 1] - routeS[i] || 1;
      const len = lerp(routeLen[i], routeLen[i + 1], clamp((s - routeS[i]) / span, 0, 1));
      doneEl.style.strokeDasharray = `${len.toFixed(1)} ${G.routeTotal + 1000}`;
    }

    // Barra inferiore (schermi stretti)
    if (G.compact && track) {
      const t = clamp(s / G.blendLen, 0, 1);
      track.style.opacity = ease(clamp((t - 0.45) / 0.4, 0, 1)).toFixed(3);
      const w = G.trackR - G.trackL;
      trackDone.style.transform = `scaleX(${clamp((trackX(s) - G.trackL) / w, 0, 1).toFixed(4)})`;
    }
  }

  function scheduleRender() {
    if (!renderRaf) renderRaf = window.requestAnimationFrame(render);
  }

  function rebuild() {
    rebuildRaf = 0;
    measure();
    buildRoute();
    buildTrack();
    reachedCount = -1;
    render();
  }

  function scheduleRebuild() {
    if (!rebuildRaf) rebuildRaf = window.requestAnimationFrame(rebuild);
  }

  /* ------------------------------------------------------------------ */
  /* AVVIO                                                               */
  /* ------------------------------------------------------------------ */

  rebuild();

  window.addEventListener("scroll", scheduleRender, { passive: true });
  window.addEventListener("resize", scheduleRebuild, { passive: true });
  window.addEventListener("load", scheduleRebuild, { once: true });

  // Font, immagini e slider cambiano l'altezza della pagina: ricalcolo la rotta.
  if ("ResizeObserver" in window) new ResizeObserver(scheduleRebuild).observe(main);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleRebuild);
  const img = rover.querySelector("img");
  if (img && !img.complete) img.addEventListener("load", scheduleRebuild, { once: true });

  if (typeof reduce.addEventListener === "function") reduce.addEventListener("change", scheduleRebuild);
})();

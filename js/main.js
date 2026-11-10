/* main.js — host WebGL2 del Auditor 3D (v1). JavaScript puro, sin frameworks.
 * Modelos: OBJ locales (models/) leídos con obj.js (sin librerías ni CDN).
 *
 * Pasadas por frame:
 *   1. Escena -> FBO con MRT: color lineal (RGBA16F) + ID (RGBA8). Blinn-Phong.
 *   2. Quad NDC con daltonizador.frag del Proyecto 1 (uInputLinear = 1) -> pantalla.
 *   3. Quad NDC con heatmap.frag (blend) -> pantalla.
 * Auditoria (CPU, cuando algo cambia): readPixels de color e ID, promedio por
 * objeto y anillo de fondo adyacente, metricas con audit-core.js.
 * Picking: readPixels de 1 px en el buffer de IDs.
 */
(function () {
  'use strict';
  const A = window.AUDIT, M = window.DALTON_MACHADO, S = window.SCENE, OBJ = window.OBJ;
  const $ = (id) => document.getElementById(id);
  const canvas = $('gl');
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false });
  if (!gl) { $('error').textContent = 'Este navegador no soporta WebGL2.'; return; }
  const floatOK = !!gl.getExtension('EXT_color_buffer_float');

  // ---------------- estado ----------------
  const state = {
    view: 'sim', type: 2, sev: 1.0,
    az: 60, el: 35, light: 'blanca', ambient: 0.2, intensity: 0.8,
    heat: 1, selected: 0, // heat: 0 apagado, 1 contorno, 2 patrón
    yaw: 0.0, pitch: 0.18, radius: 9.5, target: [0, 1.4, -0.6],
    dirty: true, lastAudit: 0
  };
  const albedo = {}; // id -> albedo lineal actual (puede cambiar con "Aplicar sugerencia")
  S.OBJECTS.forEach((o) => { albedo[o.id] = A.hexToLin(o.hex); });
  let audit = {}; // id -> resultados
  let confusions = {}; // id -> [{ other, dE, dEn }] para el tipo actual
  const isFig = (id) => { const o = S.byId(Number(id)); return o && o.role === 'figura'; };

  // ---------------- mat4 (column-major) ----------------
  const m4 = {
    mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
    persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2), o = new Float32Array(16); o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o; },
    lookAt(e, c, up) {
      const z = A.norm([e[0] - c[0], e[1] - c[1], e[2] - c[2]]);
      const x = A.norm([up[1] * z[2] - up[2] * z[1], up[2] * z[0] - up[0] * z[2], up[0] * z[1] - up[1] * z[0]]);
      const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
      return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -A.dot(x, e), -A.dot(y, e), -A.dot(z, e), 1]);
    },
    ts(t, s) { return new Float32Array([s[0], 0, 0, 0, 0, s[1], 0, 0, 0, 0, s[2], 0, t[0], t[1], t[2], 1]); }
  };

  // ---------------- shaders ----------------
  async function src(path) { const r = await fetch(path); if (!r.ok) throw new Error(path); return r.text(); }
  function program(vs, fs) {
    const mk = (type, s) => { const sh = gl.createShader(type); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const loc = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i); loc[u.name] = gl.getUniformLocation(p, u.name); }
    return { p, loc };
  }

  // ---------------- geometria ----------------
  // VAO no indexado a partir de las posiciones y normales del OBJ.
  function meshVAO(mesh) {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, mesh.pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const nb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nb); gl.bufferData(gl.ARRAY_BUFFER, mesh.nor, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return { vao, count: mesh.count };
  }
  function quadVAO() {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
    gl.bindVertexArray(null);
    return vao;
  }

  // ---------------- FBO con MRT ----------------
  let fbo = null, texColor = null, texId = null, depth = null, W = 0, H = 0;
  function tex(internal, format, type, w, h) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr)), h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (w === W && h === H && fbo) return;
    W = w; H = h; canvas.width = w; canvas.height = h;
    [texColor, texId].forEach((t) => t && gl.deleteTexture(t));
    if (depth) gl.deleteRenderbuffer(depth);
    if (fbo) gl.deleteFramebuffer(fbo);
    texColor = floatOK ? tex(gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, W, H) : tex(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, W, H);
    texId = tex(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, W, H);
    depth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, W, H);
    fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texColor, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, texId, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) $('error').textContent = 'FBO incompleto.';
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    state.dirty = true;
  }

  // Textura 256x1 con el estado de cada objeto para el mapa de calor.
  let texStatus = null;
  const statusData = new Uint8Array(256 * 4);
  // 0 bien, 1 aviso WCAG, 2 falla contra el fondo, 3 se confunde con otro objeto.
  function uploadStatus() {
    statusData.fill(0);
    computeConfusions();
    Object.keys(audit).forEach((id) => {
      if (!isFig(id)) return;
      let st = audit[id].status[state.type];
      if (st < 2 && confusions[id] && confusions[id].length) st = 3;
      statusData[id * 4] = st;
    });
    if (!texStatus) texStatus = tex(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, 256, 1);
    gl.bindTexture(gl.TEXTURE_2D, texStatus);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RGBA, gl.UNSIGNED_BYTE, statusData);
  }

  // ---------------- camara y luz ----------------
  function eye() {
    const r = state.radius, cy = Math.cos(state.pitch);
    return [state.target[0] + r * cy * Math.sin(state.yaw), state.target[1] + r * Math.sin(state.pitch), state.target[2] + r * cy * Math.cos(state.yaw)];
  }
  function lightNow() {
    return { dir: A.lightDir(state.az, state.el), color: S.LIGHTS[state.light].color, ambient: state.ambient, intensity: state.intensity };
  }

  // ---------------- render ----------------
  let P = {}, meshes = {}, quad;
  const IDENTITY4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  function render() {
    resize();
    const e = eye(), light = lightNow();
    const vp = m4.mul(m4.persp(50 * Math.PI / 180, W / H, 0.1, 100), m4.lookAt(e, state.target, [0, 1, 0]));

    // Pasada 1: escena -> FBO (color lineal + ID)
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, W, H);
    gl.clearBufferfv(gl.COLOR, 0, [0.02, 0.02, 0.03, 1]);
    gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 1]);
    gl.clearBufferfv(gl.DEPTH, 0, [1.0]);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    const ps = P.scene; gl.useProgram(ps.p);
    gl.uniformMatrix4fv(ps.loc.uViewProj, false, vp);
    gl.uniform3fv(ps.loc.uLightDir, light.dir);
    gl.uniform3fv(ps.loc.uLightColor, light.color);
    gl.uniform1f(ps.loc.uAmbient, light.ambient);
    gl.uniform1f(ps.loc.uIntensity, light.intensity);
    gl.uniform3fv(ps.loc.uEye, e);
    gl.uniformMatrix4fv(ps.loc.uModel, false, IDENTITY4); // los OBJ vienen en coordenadas de mundo
    S.OBJECTS.forEach((o) => {
      const mesh = meshes[o.id]; if (!mesh) return;
      gl.bindVertexArray(mesh.vao);
      gl.uniform3fv(ps.loc.uKd, albedo[o.id]);
      gl.uniform1f(ps.loc.uKs, o.ks);
      gl.uniform1f(ps.loc.uShininess, o.sh);
      gl.uniform1f(ps.loc.uId, o.id);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    });

    // Auditoria con los buffers recien dibujados (si algo cambio).
    const now = performance.now();
    if (state.dirty && now - state.lastAudit > 200) { runAudit(); state.lastAudit = now; state.dirty = false; }

    // Pasada 2: simulacion (Proyecto 1) -> pantalla
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.disable(gl.DEPTH_TEST);
    const pd = P.dalton; gl.useProgram(pd.p);
    const t = state.view === 'sim' ? state.type : 0;
    const sp = M.simParams(t, state.sev);
    gl.uniformMatrix3fv(pd.loc.uSim, false, M.toColumnMajor(sp.m1));
    gl.uniformMatrix3fv(pd.loc.uSim2, false, M.toColumnMajor(sp.m2));
    gl.uniform3fv(pd.loc.uPlane, sp.n);
    gl.uniform1f(pd.loc.uInputLinear, 1.0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texColor);
    gl.uniform1i(pd.loc.uTexture, 0);
    gl.bindVertexArray(quad);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Pasada 3: mapa de calor + seleccion
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const ph = P.heat; gl.useProgram(ph.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texId); gl.uniform1i(ph.loc.uIds, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texStatus); gl.uniform1i(ph.loc.uStatus, 1);
    gl.uniform1f(ph.loc.uSelected, state.selected);
    gl.uniform1f(ph.loc.uMode, state.heat);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }

  // ---------------- auditoria por objeto ----------------
  // Interior: promedio del color lineal de los pixeles del objeto.
  // Fondo adyacente (WCAG 1.4.11 "adjacent colors"): pixeles de OTROS objetos a
  // RING px en 8 direcciones de cada pixel del objeto. v1: Jump Flooding en GPU.
  // Por linealidad, sim(promedio) = promedio(sim) en Machado (Proposicion 1).
  const RING = 6;
  function runAudit() {
    const t0 = performance.now();
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo);
    gl.readBuffer(gl.COLOR_ATTACHMENT1);
    const ids = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, ids);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    let col;
    if (floatOK) { col = new Float32Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.FLOAT, col); }
    else { const b = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b); col = Float32Array.from(b, (x) => x / 255); }
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);

    const acc = {}; // id -> {n, c[3], rn, r[3], nb{}}
    const get = (id) => acc[id] || (acc[id] = { n: 0, c: [0, 0, 0], rn: 0, r: [0, 0, 0], nb: {} });
    const step = W * H > 900000 ? 2 : 1;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].map(([x, y]) => [x * RING, y * RING]);
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        const i = y * W + x, id = ids[i * 4];
        if (!id) continue;
        const a = get(id);
        a.n++; a.c[0] += col[i * 4]; a.c[1] += col[i * 4 + 1]; a.c[2] += col[i * 4 + 2];
        for (const [dx, dy] of dirs) {
          const X = x + dx, Y = y + dy;
          if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const j = Y * W + X, jd = ids[j * 4];
          if (!jd || jd === id) continue;
          a.rn++; a.r[0] += col[j * 4]; a.r[1] += col[j * 4 + 1]; a.r[2] += col[j * 4 + 2];
          a.nb[jd] = (a.nb[jd] || 0) + 1;
        }
      }
    }
    const res = {};
    Object.keys(acc).forEach((k) => {
      const a = acc[k]; if (!a.rn || a.n < 20) return;
      const obj = A.scl(a.c, 1 / a.n), bg = A.scl(a.r, 1 / a.rn);
      const metrics = A.pairMetrics(A.clamp01(obj), A.clamp01(bg), state.sev);
      const mainBg = Object.keys(a.nb).sort((p, q) => a.nb[q] - a.nb[p])[0];
      res[k] = { obj, bg, metrics, status: metrics.map(A.status), mainBg: Number(mainBg), px: a.n * step * step };
    });
    audit = res;
    uploadStatus();
    $('auditMs').textContent = (performance.now() - t0).toFixed(0) + ' ms';
    updateHUD();
  }

  // ---------------- confusión entre objetos ----------------
  // Dos figuras se confunden si en visión normal se separan (ΔE ≥ 0.10) y en el
  // tipo simulado no (ΔE < τ). Es la confusión de un mapa de rutas: el problema
  // no es contra el fondo sino entre objetos que deben distinguirse entre sí.
  const TAU_PAIR_NORMAL = 0.10;
  function computeConfusions() {
    confusions = {};
    const ids = Object.keys(audit).filter(isFig);
    const t = state.type;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = A.clamp01(audit[ids[i]].obj), b = A.clamp01(audit[ids[j]].obj);
        const dEn = A.dEok(a, b);
        if (dEn < TAU_PAIR_NORMAL || t === 0) continue;
        const dE = A.dEok(A.simulate(t, state.sev, a), A.simulate(t, state.sev, b));
        if (dE >= A.TH.TAU_DE) continue;
        (confusions[ids[i]] = confusions[ids[i]] || []).push({ other: Number(ids[j]), dE, dEn });
        (confusions[ids[j]] = confusions[ids[j]] || []).push({ other: Number(ids[i]), dE, dEn });
      }
    }
  }

  // ---------------- picking ----------------
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((clientX - r.left) * W / r.width), y = H - 1 - Math.floor((clientY - r.top) * H / r.height);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo);
    gl.readBuffer(gl.COLOR_ATTACHMENT1);
    const px = new Uint8Array(4);
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    state.selected = px[0] === state.selected ? 0 : px[0]; // clic sobre el mismo objeto = deseleccionar
    updateHUD();
  }

  // ---------------- HUD ----------------
  const LABEL = ['Bien', 'Aviso: WCAG < 3:1', 'Falla: no distinguible', 'Se confunde con otro objeto'];
  const ICON = ['✔', '⚠', '✖', '≈'];
  const stOf = (id) => statusData[id * 4];
  function updateHUD() {
    // Lista de objetos ordenada por gravedad para el tipo actual.
    const rank = [0, 1, 3, 2]; // falla > confusión > aviso > bien
    const rows = Object.keys(audit).filter(isFig).map((id) => ({ id: Number(id), a: audit[id] }))
      .sort((p, q) => rank[stOf(q.id)] - rank[stOf(p.id)] || p.a.metrics[state.type].dE - q.a.metrics[state.type].dE);
    $('list').innerHTML = rows.map(({ id, a }) => {
      const m = a.metrics[state.type], st = stOf(id);
      return `<li><button data-id="${id}" class="st${st}${id === state.selected ? ' sel' : ''}">${ICON[st]} ${S.byId(id).name}<span>ΔE ${m.dE.toFixed(3)} · ${m.wcag.toFixed(2)}:1</span></button></li>`;
    }).join('');
    const nFail = rows.filter((r) => stOf(r.id) === 2).length;
    const nPairs = Object.values(confusions).reduce((n, l) => n + l.length, 0) / 2;
    $('summary').textContent = `${A.TYPES[state.type]}: ${nFail} de ${rows.length} objetos no se distinguen de su fondo · ${nPairs} pares se confunden entre sí`;

    const box = $('detail');
    const a = audit[state.selected], o = S.byId(state.selected);
    if (o && o.role !== 'figura') { box.innerHTML = `<h3>${o.name}</h3><p>Superficie de fondo: no se audita como figura, pero sirve de fondo a las demás.</p>`; return; }
    if (!o) { box.innerHTML = '<p>Haz clic en un objeto de la escena.</p>'; return; }
    if (!a) { box.innerHTML = `<h3>${o.name}</h3><p>Sin fondo visible desde esta camara.</p>`; return; }
    const bgName = S.byId(a.mainBg) ? S.byId(a.mainBg).name : '—';
    let html = `<h3>${o.name}</h3><p class="muted">Fondo adyacente principal: ${bgName}</p>`;
    html += `<div class="sw"><span style="background:${A.linToHex(A.clamp01(a.obj))}"></span>objeto <span style="background:${A.linToHex(A.clamp01(a.bg))}"></span>fondo (render)</div>`;
    html += '<table><tr><th>Visión</th><th>ΔE OKLab</th><th>WCAG</th><th>Estado</th></tr>';
    a.metrics.forEach((m, t) => { html += `<tr${t === state.type ? ' class="cur"' : ''}><td>${m.type}</td><td>${m.dE.toFixed(3)}</td><td>${m.wcag.toFixed(2)}:1</td><td>${ICON[a.status[t]]} ${LABEL[a.status[t]]}</td></tr>`; });
    html += '</table>';
    const conf = confusions[o.id] || [];
    if (conf.length) {
      html += `<p class="conf">≈ En ${A.TYPES[state.type]} se confunde con: ` + conf.map((c) => `<button class="link" data-id="${c.other}">${S.byId(c.other).name}</button> (ΔE ${c.dE.toFixed(3)}; normal ${c.dEn.toFixed(3)})`).join(', ') + '. Si la forma es distinta, la forma los separa.</p>';
    }
    const worst = Math.max(a.status[1], a.status[2], a.status[3]);
    if (worst > 0) {
      const sug = A.suggest(albedo[o.id], A.clamp01(a.obj), A.clamp01(a.bg), state.sev);
      if (sug) {
        html += `<p class="sug">Sugerencia (mismo tono${sug.dh ? ' ajustado' : ''}, pasa en los tres tipos con esta luz): <span class="chip" style="background:${sug.hex}"></span> <code>${sug.hex}</code> <button id="apply" data-hex="${sug.hex}">Aplicar</button></p>`;
      } else html += '<p class="sug">Sin sugerencia que pase cambiando solo este objeto. Revisa el color del fondo.</p>';
    } else html += '<p class="sug">Pasa en los tres tipos con esta luz.</p>';
    html += `<p class="muted">Albedo original ${o.hex} · actual ${A.linToHex(albedo[o.id])} <button id="reset">Restaurar</button></p>`;
    box.innerHTML = html;
    const ap = $('apply'); if (ap) ap.onclick = () => { albedo[o.id] = A.hexToLin(ap.dataset.hex); state.dirty = true; };
    $('reset').onclick = () => { albedo[o.id] = A.hexToLin(o.hex); state.dirty = true; };
    box.querySelectorAll('button.link').forEach((b) => { b.onclick = () => { state.selected = Number(b.dataset.id); updateHUD(); }; });
  }

  // ---------------- controles ----------------
  function bind() {
    const set = (id, key, parse, out) => {
      const el = $(id);
      const f = () => { state[key] = parse(el.value); if (out) $(out).textContent = el.value; state.dirty = true; if (key === 'type') { uploadStatus(); updateHUD(); } };
      el.addEventListener('input', f); f();
    };
    set('type', 'type', Number); set('sev', 'sev', Number, 'sevV');
    set('az', 'az', Number, 'azV'); set('el', 'el', Number, 'elV');
    set('light', 'light', String); set('view', 'view', String);
    $('heat').addEventListener('input', (e) => { state.heat = Number(e.target.value); });
    // Clic en el recuadro del objeto ya seleccionado = deseleccionar.
    $('list').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const id = Number(b.dataset.id);
      state.selected = state.selected === id ? 0 : id;
      updateHUD();
    });
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === 'f' || e.key === 'F') { $('view').value = state.view === 'sim' ? 'orig' : 'sim'; $('view').dispatchEvent(new Event('input')); }
      if (e.key === 'h' || e.key === 'H') { $('heat').value = String((state.heat + 1) % 3); state.heat = Number($('heat').value); }
    });
    // Orbita: arrastrar. Clic sin arrastre: picking.
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      if (drag.moved) {
        state.yaw -= dx * 0.005; state.pitch = Math.min(1.3, Math.max(-0.1, state.pitch + dy * 0.005));
        drag.x = e.clientX; drag.y = e.clientY; state.dirty = true;
      }
    });
    canvas.addEventListener('pointerup', (e) => { if (drag && !drag.moved) pick(e.clientX, e.clientY); drag = null; });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); state.radius = Math.min(20, Math.max(4, state.radius * (1 + Math.sign(e.deltaY) * 0.08))); state.dirty = true; }, { passive: false });
    window.addEventListener('resize', () => { state.dirty = true; });
  }

  // ---------------- arranque ----------------
  let frames = 0, tFps = performance.now();
  function loop() {
    render();
    frames++;
    const now = performance.now();
    if (now - tFps > 1000) { $('fps').textContent = `${frames} fps · ${W}×${H}${floatOK ? '' : ' · sin RGBA16F'}`; frames = 0; tFps = now; }
    requestAnimationFrame(loop);
  }
  (async function init() {
    try {
      const [sv, sf, dv, df, hf] = await Promise.all(['shaders/escena.vert', 'shaders/escena.frag', 'shaders/daltonizador.vert', 'shaders/daltonizador.frag', 'shaders/heatmap.frag'].map(src));
      P.scene = program(sv, sf); P.dalton = program(dv, df); P.heat = program(dv, hf);
      // Modelos OBJ locales: un VAO por objeto auditable (nombre "o" = campo part).
      const files = [...new Set(S.OBJECTS.map((o) => o.model))];
      const parsed = {};
      await Promise.all(files.map(async (f) => { parsed[f] = OBJ.parseOBJ(await src('models/' + f + '.obj')); }));
      S.OBJECTS.forEach((o) => {
        const part = parsed[o.model][o.part];
        if (part) meshes[o.id] = meshVAO(part); else console.warn('Falta la parte', o.part, 'en', o.model);
      });
      quad = quadVAO();
      resize(); uploadStatus(); bind();
      requestAnimationFrame(loop);
    } catch (err) {
      $('error').textContent = 'Error: ' + err.message + ' (abre con un servidor local, ver README).';
      console.error(err);
    }
  })();
})();

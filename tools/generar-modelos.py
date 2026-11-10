"""tools/generar-modelos.py
Genera los modelos 3D de la escena (andén de TransMilenio) como archivos OBJ
en models/. Cada pieza auditable es un objeto OBJ ("o nombre") con normales
("vn") y caras trianguladas. Coordenadas ya en el mundo (y arriba, cámara a -z).

Por qué un generador y no un motor: los requisitos del curso piden WebGL2 sin
frameworks y sin librerías por CDN. Un OBJ es texto plano que main.js lee con
su propio parser (obj.js). Cualquier modelo exportado desde Blender
(File > Export > Wavefront OBJ, "Forward -Z, Up Y", con normales y
triangulado) entra por el mismo camino: basta con que el nombre del objeto
coincida con el campo "part" de scene.js.

Ejecutar: python3 tools/generar-modelos.py
"""
import math
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'models')


class Mesh:
    def __init__(self):
        self.parts = {}  # nombre -> (pos, nor, tris)

    def part(self, name):
        if name not in self.parts:
            self.parts[name] = ([], [], [])
        return self.parts[name]

    def tri(self, name, a, b, c):
        """a, b, c: (pos, normal). Orden antihorario visto desde afuera."""
        P, N, T = self.part(name)
        base = len(P)
        for p, n in (a, b, c):
            P.append(p)
            N.append(n)
        T.append((base, base + 1, base + 2))

    def write(self, fname):
        """Escribe OBJ con vertices y normales compartidos (indices v//vn)."""
        os.makedirs(OUT, exist_ok=True)
        path = os.path.join(OUT, fname)
        vidx, nidx = {}, {}
        vlines, nlines, body = [], [], []

        def key(t):
            return tuple(round(x, 4) + 0.0 for x in t)

        def iv(p):
            k = key(p)
            if k not in vidx:
                vidx[k] = len(vidx) + 1
                vlines.append('v %.4f %.4f %.4f' % k)
            return vidx[k]

        def inn(n):
            k = key(n)
            if k not in nidx:
                nidx[k] = len(nidx) + 1
                nlines.append('vn %.4f %.4f %.4f' % k)
            return nidx[k]
        for name, (P, N, T) in self.parts.items():
            body.append('o ' + name)
            for tri in T:
                body.append('f ' + ' '.join('%d//%d' % (iv(P[i]), inn(N[i])) for i in tri))
        with open(path, 'w') as f:
            f.write('# Auditor 3D - generado por tools/generar-modelos.py\n')
            f.write('\n'.join(vlines + nlines + body) + '\n')
        tris = sum(len(T) for _, _, T in self.parts.values())
        print(f'{fname}: {len(self.parts)} objetos, {tris} triangulos, {len(vidx)} vertices')


def norm(v):
    l = math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2) or 1.0
    return (v[0] / l, v[1] / l, v[2] / l)


def add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def scl(a, k):
    return (a[0] * k, a[1] * k, a[2] * k)


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


FACES = [  # normal, u, v con u x v = normal
    ((1, 0, 0), (0, 0, -1), (0, 1, 0)), ((-1, 0, 0), (0, 0, 1), (0, 1, 0)),
    ((0, 1, 0), (1, 0, 0), (0, 0, -1)), ((0, -1, 0), (1, 0, 0), (0, 0, 1)),
    ((0, 0, 1), (1, 0, 0), (0, 1, 0)), ((0, 0, -1), (-1, 0, 0), (0, 1, 0)),
]


def rbox(m, name, c, size, r=0.0, n=4):
    """Caja con aristas redondeadas de radio r (r = 0: caja normal)."""
    h = (size[0] / 2, size[1] / 2, size[2] / 2)
    r = min(r, *h)
    inner = (h[0] - r, h[1] - r, h[2] - r)
    seg = n if r > 0 else 1

    def vert(p):
        # p en la caja [-h, h]; se proyecta al "núcleo" y se infla con r.
        q = tuple(max(-inner[i], min(inner[i], p[i])) for i in range(3))
        d = (p[0] - q[0], p[1] - q[1], p[2] - q[2])
        if r > 0 and (abs(d[0]) + abs(d[1]) + abs(d[2])) > 1e-9:
            nn = norm(d)
            pos = add(q, scl(nn, r))
        else:
            nn = None
            pos = p
        return add(c, pos), nn

    for N, U, V in FACES:
        # coordenadas en la cara: núcleo plano + franjas de borde redondeadas
        ext_u = sum(abs(U[i]) * h[i] for i in range(3))
        ext_v = sum(abs(V[i]) * h[i] for i in range(3))
        ext_n = sum(abs(N[i]) * h[i] for i in range(3))
        in_u = sum(abs(U[i]) * inner[i] for i in range(3))
        in_v = sum(abs(V[i]) * inner[i] for i in range(3))

        def ticks(ext, inn):
            if seg == 1:
                return [-ext, ext]
            t = [-ext + (ext - inn) * k / seg for k in range(seg)]
            t += [-inn, inn] if inn > 1e-9 else [0.0]
            t += [inn + (ext - inn) * k / seg for k in range(1, seg + 1)]
            return t

        tu, tv = ticks(ext_u, in_u), ticks(ext_v, in_v)
        grid = []
        for a in tu:
            row = []
            for b in tv:
                p = add(add(scl(N, ext_n), scl(U, a)), scl(V, b))
                pos, nn = vert(p)
                row.append((pos, nn or N))
            grid.append(row)
        for i in range(len(tu) - 1):
            for j in range(len(tv) - 1):
                A, B, C, D = grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]
                m.tri(name, A, B, C)
                m.tri(name, A, C, D)


def prism(m, name, c, radius, depth, axis, segs, start=0.0, bevel=0.0):
    """Prisma regular (cilindro si segs es alto). axis: 'x', 'y' o 'z'.
    La cara frontal mira hacia +axis. bevel achica la tapa frontal."""
    ax = {'x': (1, 0, 0), 'y': (0, 1, 0), 'z': (0, 0, 1)}[axis]
    u = {'x': (0, 0, -1), 'y': (1, 0, 0), 'z': (1, 0, 0)}[axis]
    v = cross(ax, u)
    smooth = segs >= 12
    ring = []
    for k in range(segs):
        t = start + 2 * math.pi * k / segs
        ring.append((math.cos(t), math.sin(t)))
    front = add(c, scl(ax, depth / 2))
    back = add(c, scl(ax, -depth / 2))
    rf = radius - bevel

    def P(base, rr, cs):
        return add(base, add(scl(u, rr * cs[0]), scl(v, rr * cs[1])))
    for k in range(segs):
        a, b = ring[k], ring[(k + 1) % segs]
        # lateral
        if smooth:
            na, nb = norm(add(scl(u, a[0]), scl(v, a[1]))), norm(add(scl(u, b[0]), scl(v, b[1])))
        else:
            mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            na = nb = norm(add(scl(u, mid[0]), scl(v, mid[1])))
        top = add(back, scl(ax, depth - bevel)) if bevel else front
        m.tri(name, (P(back, radius, a), na), (P(back, radius, b), nb), (P(top, radius, b), nb))
        m.tri(name, (P(back, radius, a), na), (P(top, radius, b), nb), (P(top, radius, a), na))
        if bevel:
            nba = norm(add(na, ax)); nbb = norm(add(nb, ax))
            m.tri(name, (P(top, radius, a), nba), (P(top, radius, b), nbb), (P(front, rf, b), nbb))
            m.tri(name, (P(top, radius, a), nba), (P(front, rf, b), nbb), (P(front, rf, a), nba))
        # tapas
        m.tri(name, (front, ax), (P(front, rf, a), ax), (P(front, rf, b), ax))
        nax = scl(ax, -1)
        m.tri(name, (back, nax), (P(back, radius, b), nax), (P(back, radius, a), nax))


def dome(m, name, c, r, segs=6, rings=2):
    """Domo (media esfera) apoyado en y = c.y. Para la franja podotáctil."""
    def pt(i, k):
        phi = (math.pi / 2) * i / rings
        th = 2 * math.pi * k / segs
        n = (math.cos(phi) * math.cos(th), math.sin(phi), math.cos(phi) * math.sin(th))
        return add(c, scl(n, r)), n
    for i in range(rings):
        for k in range(segs):
            a, b, cc, d = pt(i, k), pt(i, k + 1), pt(i + 1, k + 1), pt(i + 1, k)
            m.tri(name, a, cc, b)
            m.tri(name, a, d, cc)


def letter(m, name, bitmap, origin, cell, depth):
    """Letra de pixeles (7 filas x 5 columnas) hecha con cajas; corridas horizontales."""
    rows = len(bitmap)
    for r, line in enumerate(bitmap):
        c = 0
        while c < len(line):
            if line[c] == '1':
                c0 = c
                while c < len(line) and line[c] == '1':
                    c += 1
                w = (c - c0) * cell
                x = origin[0] + c0 * cell + w / 2
                y = origin[1] + (rows - 1 - r) * cell + cell / 2
                rbox(m, name, (x, y, origin[2] + depth / 2), (w, cell, depth), 0)
            else:
                c += 1


LETTERS = {
    'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
    'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
}


def anden():
    m = Mesh()
    rbox(m, 'piso', (0, -0.05, 0), (14, 0.1, 10), 0)
    rbox(m, 'borde_anden', (0, 0.0, 2.55), (14, 0.12, 0.3), 0.03, 2)
    rbox(m, 'pared', (0, 2.2, -3.1), (14, 4.4, 0.2), 0)
    rbox(m, 'techo', (0, 4.45, -1.35), (14, 0.15, 3.7), 0.04, 2)
    for x in (-6.2, -0.35, 5.6):
        prism(m, 'columnas', (x, 2.2, -2.7), 0.14, 4.4, 'y', 20)
    # Franja podotáctil: base + domos en retícula.
    rbox(m, 'franja_podotactil', (1.4, 0.005, 1.6), (9.2, 0.01, 0.45), 0)
    nx, nz, sp = 122, 6, 0.075
    for i in range(nx):
        for k in range(nz):
            x = -3.2 + 0.025 + sp / 2 + i * sp
            z = 1.6 - 0.225 + sp / 2 + k * sp
            dome(m, 'franja_podotactil', (x, 0.01, z), 0.022)
    m.write('anden.obj')


def senales():
    m = Mesh()
    for name, x, ch in (('senal_roja', -3.0, 'H'), ('senal_verde', -1.2, 'B')):
        rbox(m, name, (x, 2.9, -2.96), (1.4, 0.75, 0.08), 0.05, 3)
        cell = 0.075
        letter(m, 'letra_' + name.split('_')[1], LETTERS[ch], (x - 2.5 * cell, 2.9 - 3.5 * cell, -2.92), cell, 0.025)
    # Mapa de troncales: panel blanco, 6 líneas con un marcador de forma distinta.
    rbox(m, 'mapa_panel', (0.8, 2.75, -2.96), (2.0, 1.35, 0.06), 0.04, 3)
    shapes = [(24, 0.0), (4, math.pi / 4), (3, math.pi / 2), (4, 0.0), (6, 0.0), (0, 0.0)]
    for i in range(6):
        y = 3.27 - i * 0.205
        name = 'ruta_%d' % (i + 1)
        rbox(m, name, (0.95, y, -2.92), (1.35, 0.06, 0.02), 0.01, 1)
        segs, st = shapes[i]
        if segs:
            prism(m, name, (0.12, y, -2.915), 0.075, 0.03, 'z', segs, st, 0.006)
        else:  # cruz
            rbox(m, name, (0.12, y, -2.915), (0.15, 0.045, 0.03), 0.005, 1)
            rbox(m, name, (0.12, y, -2.915), (0.045, 0.15, 0.03), 0.005, 1)
    # Panel de ayuda y botón de emergencia.
    rbox(m, 'panel_ayuda', (2.9, 1.5, -2.95), (1.0, 1.2, 0.1), 0.05, 3)
    prism(m, 'boton_emergencia', (2.9, 1.5, -2.86), 0.17, 0.09, 'z', 32, 0, 0.03)
    m.write('senales.obj')


def bus():
    m = Mesh()
    cx, z0 = -4.6, -0.4
    rbox(m, 'bus_carroceria', (cx, 1.65, z0), (2.5, 2.9, 9.0), 0.28, 4)
    # ventanas en el costado +x y el frente +z
    for k in range(5):
        z = z0 - 3.4 + k * 1.15 if k < 3 else z0 + 2.3 + (k - 3) * 1.2
        rbox(m, 'bus_ventanas', (cx + 1.255, 2.25, z), (0.03, 0.95, 1.0), 0.02, 1)
    rbox(m, 'bus_ventanas', (cx, 2.15, z0 + 4.505), (2.0, 1.2, 0.03), 0.03, 1)
    # puerta lateral (lado del andén)
    rbox(m, 'bus_puerta', (cx + 1.255, 1.35, z0 + 1.15), (0.03, 2.3, 1.1), 0.02, 1)
    # ruedas
    for z in (z0 - 3.0, z0 + 2.9):
        for sx in (-1, 1):
            prism(m, 'bus_ruedas', (cx + sx * 1.1, 0.5, z), 0.5, 0.35, 'x', 24, 0, 0.05)
    m.write('bus.obj')


def banca():
    m = Mesh()
    rbox(m, 'banca_asiento', (0.0, 0.47, -2.3), (2.2, 0.08, 0.5), 0.03, 2)
    rbox(m, 'banca_asiento', (0.0, 0.8, -2.52), (2.2, 0.5, 0.06), 0.03, 2)
    for x in (-0.9, 0.9):
        for z in (-2.12, -2.5):
            prism(m, 'banca_patas', (x, 0.22, z), 0.035, 0.44, 'y', 12)
    m.write('banca.obj')


if __name__ == '__main__':
    anden(); senales(); bus(); banca()

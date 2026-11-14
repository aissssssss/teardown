"""GPU renderer for the VJ scenes: reads the GLSL straight out of our .html pages, draws every frame on the GPU with
moderngl (EGL, no browser), pipes the frames to ffmpeg, joins the segments with crossfades and adds the track.

    python vjrender.py --repo /path/to/teardown --track track.mp4 --out show.mp4 [--fps 60] [--scale 1.0]

The timeline is the DnB show (172.2 BPM, cuts on 8-bar phrases). Edit SEGMENTS to cut a different show.
"""
import argparse
import math
import os
import re
import subprocess

import moderngl
import numpy as np

W, H = 1080, 1920
BPM, T0 = 172.2, 0.209


def ss(a, b, x):
    u = min(1.0, max(0.0, (x - a) / (b - a)))
    return u * u * (3 - 2 * u)


# per-page uniforms, mirroring each page's own JavaScript draw()
def u_show(t):
    fl = (math.exp(-(t - 44.8) * 2.5) if t >= 44.8 else 0) + (math.exp(-(t - 89.4) * 2.5) if t >= 89.4 else 0)
    return {'T': t, 'B': (t - T0) * BPM / 60, 'CAM': ss(13, 22, t) * (1 - ss(89.2, 89.4, t)), 'FL': min(1.0, fl), 'S': 0}


def u_dots(t):
    return {'T': t, 'B': (t - T0) * BPM / 60, 'S': 1, 'CAM': 0.0, 'FL': 0.0}


def u_lib(scene):
    def f(t):
        return {'T': t, 'B': (t - T0) * BPM / 60, 'SA': float(scene), 'SB': float(scene), 'MIXK': 0.0}
    return f


def u_kifs(t):
    return {'T': t, 'B': (t - T0) * BPM / 60}


# page, start, end (song seconds), transition into it, uniforms
SEGMENTS = [
    ('vj/dnb/show-v2.html', 0.0, 22.5, None, u_show),
    ('vj/dnb/dots2.html', 22.5, 33.66, 'dissolve', u_dots),
    ('vj/dnb/lib-0.html', 33.66, 44.8, 'dissolve', u_lib(0)),
    ('vj/dnb/show-v2.html', 44.8, 55.95, 'fadewhite', u_show),
    ('vj/dnb/lib-2.html', 55.95, 67.1, 'dissolve', u_lib(2)),
    ('vj/dnb/lib-3.html', 67.1, 78.25, 'dissolve', u_lib(3)),
    ('vj/dnb/lib-1.html', 78.25, 83.8, 'dissolve', u_lib(1)),
    ('vj/dnb/kifs.html', 83.8, 89.4, 'dissolve', u_kifs),
    ('vj/dnb/show-v2.html', 89.4, 105.2, 'fadewhite', u_show),
]
XF = 1.4  # crossfade seconds


def shader_from_html(path):
    """The fragment shader is the JS template literal `const FRAG = `...``; ${NAME} refers to a const in the page."""
    src = open(path, encoding='utf8').read()
    frag = re.search(r'const FRAG = `(.*?)`;', src, re.S).group(1)
    consts = dict(re.findall(r'\b([A-Z][A-Z0-9_]*) = ([0-9.]+)', src))
    frag = re.sub(r'\$\{(\w+)\}', lambda m: consts[m.group(1)], frag)
    return frag.replace('#version 300 es', '#version 330 core')


VERT = '#version 330 core\nin vec2 v; void main(){ gl_Position = vec4(v, 0.0, 1.0); }'


class Page:
    def __init__(self, ctx, path):
        self.prog = ctx.program(vertex_shader=VERT, fragment_shader=shader_from_html(path))
        vbo = ctx.buffer(np.array([-1, -1, 3, -1, -1, 3], dtype='f4').tobytes())
        self.vao = ctx.vertex_array(self.prog, [(vbo, '2f', 'v')])

    def draw(self, uniforms):
        for k, v in uniforms.items():
            if k in self.prog:
                self.prog[k].value = int(v) if k == 'S' else float(v)
        if 'R' in self.prog:
            self.prog['R'].value = (float(W), float(H))
        self.vao.render(moderngl.TRIANGLES)


def render_segment(ctx, fbo, page, uf, t0, t1, fps, path):
    n = int(round((t1 - t0) * fps))
    ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(fps),
                           '-i', '-', '-vf', 'vflip', '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', '-pix_fmt', 'yuv420p', path],
                          stdin=subprocess.PIPE)
    for i in range(n):
        fbo.use()
        page.draw(uf(t0 + i / fps))
        ff.stdin.write(fbo.read(components=3))
    ff.stdin.close()
    ff.wait()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', required=True)
    ap.add_argument('--track', required=True)
    ap.add_argument('--out', default='show.mp4')
    ap.add_argument('--fps', type=int, default=60)
    ap.add_argument('--work', default='segs')
    ap.add_argument('--still', type=float, help='render one frame at this song time to still.png and stop')
    a = ap.parse_args()
    os.makedirs(a.work, exist_ok=True)
    ctx = moderngl.create_standalone_context(backend='egl')
    print('GPU:', ctx.info['GL_RENDERER'])
    fbo = ctx.simple_framebuffer((W, H))
    if a.still is not None:
        from PIL import Image
        seg = next(s for s in SEGMENTS if s[1] <= a.still < s[2] + 1e-6)
        fbo.use()
        Page(ctx, os.path.join(a.repo, seg[0])).draw(seg[4](a.still))
        Image.frombytes('RGB', (W, H), fbo.read(components=3)).transpose(Image.FLIP_TOP_BOTTOM).save('still.png')
        print('still.png from', seg[0])
        return
    pages = {}
    for k, (page, t0, t1, _, uf) in enumerate(SEGMENTS):
        seg = os.path.join(a.work, f'seg{k}.mp4')
        if os.path.exists(seg):
            continue
        if page not in pages:
            pages[page] = Page(ctx, os.path.join(a.repo, page))
        end = t1 + (XF if k < len(SEGMENTS) - 1 else 0)
        render_segment(ctx, fbo, pages[page], uf, t0, end, a.fps, seg)
        print(f'seg{k} {page} {t0}-{end} done', flush=True)
    # join: the crossfade into each segment starts at its cut time, so the picture stays on the song's clock
    args, filt, prev = [], '', '[0:v]'
    for k in range(len(SEGMENTS)):
        args += ['-i', os.path.join(a.work, f'seg{k}.mp4')]
    for k, (_, t0, _, tr, _) in enumerate(SEGMENTS[1:], 1):
        filt += f'{prev}[{k}:v]xfade=transition={tr}:duration={XF}:offset={t0}[v{k}];'
        prev = f'[v{k}]'
    end = SEGMENTS[-1][2]
    filt += f'{prev}fade=t=out:st={end - 2}:d=2[vout]'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *args, '-i', a.track, '-filter_complex', filt, '-map', '[vout]', '-map',
                    f'{len(SEGMENTS)}:a', '-c:v', 'libx264', '-preset', 'slow', '-b:v', '12M', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
                    '-b:a', '256k', '-shortest', '-movflags', '+faststart', a.out], check=True)
    print('done:', a.out)


if __name__ == '__main__':
    main()

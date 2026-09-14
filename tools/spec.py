"""SSR Figma Sites -> arbre lisible avec déclarations CSS résolues, un fichier par breakpoint."""
import re, sys, html
from html.parser import HTMLParser
src = open(sys.argv[1]).read()
outdir = sys.argv[2]
css = re.search(r'<style id="ssr-css">(.*?)</style>', src, re.S).group(1)
rules = {}
for m in re.finditer(r'#container \.(css-[a-z0-9]+)\s*\{(.*?)\}(?=#container|$|@)', css, re.S):
    rules[m.group(1)] = m.group(2).strip()
# other rules (media/hover etc.)
other = re.sub(r'#container \.css-[a-z0-9]+\s*\{.*?\}(?=#container|$|@)', '', css, flags=re.S)
open(f'{outdir}/ssr-other-css.txt','w').write(other)
VOID = {'img','br','meta','link','input','source','hr'}
class P(HTMLParser):
    def __init__(s):
        super().__init__(convert_charrefs=True); s.depth=0; s.out=None; s.files={}; s.stack=[]
    def handle_starttag(s, tag, attrs):
        a = dict(attrs)
        if a.get('data-breakpoint') == 'true':
            s.out = []; s.files[a['data-width']] = s.out; s.bpdepth = s.depth
        if s.out is not None:
            cls = (a.get('class') or '').split()
            decl = ' '.join(rules.get(c, '') for c in cls if c.startswith('css-'))
            extra = ' '.join(c for c in cls if not c.startswith('css-'))
            attrs_s = ' '.join(f'{k}={v!r}' for k, v in a.items() if k not in ('class', 'srcSet', 'srcset', 'sizes'))
            s.out.append('  ' * (s.depth - s.bpdepth) + f'<{tag}{(" ." + extra) if extra else ""}> {attrs_s} || {decl}')
        if tag not in VOID: s.depth += 1
    def handle_endtag(s, tag):
        if tag not in VOID: s.depth -= 1
        if s.out is not None and s.depth == s.bpdepth: s.out = None
    def handle_data(s, data):
        if s.out is not None and data.strip():
            s.out.append('  ' * (s.depth - s.bpdepth) + '"' + data.strip() + '"')
p = P(); b = src.index('<div id="container">'); p.feed(src[b:])
for w, lines in p.files.items():
    open(f'{outdir}/bp-{w}.txt', 'w').write('\n'.join(lines))
    print(w, len(lines))

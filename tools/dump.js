(() => {
  const root = [...document.querySelectorAll('[data-breakpoint]')].find(e => getComputedStyle(e).display !== 'none') || document.body;
  const out = [];
  const sy = window.scrollY;
  const R = e => { const r = e.getBoundingClientRect(); return [Math.round(r.x*10)/10, Math.round((r.y+sy)*10)/10, Math.round(r.width*10)/10, Math.round(r.height*10)/10]; };
  const pick = (e, cs, pcs) => {
    const s = [];
    const add = (k, v) => s.push(k + ':' + v);
    if (cs.position === 'absolute' || cs.position === 'fixed' || cs.position === 'sticky') add('pos', cs.position);
    if (cs.display.includes('flex')) {
      add('flex', [cs.flexDirection, 'j=' + cs.justifyContent, 'a=' + cs.alignItems, cs.flexWrap !== 'nowrap' ? 'wrap' : '', 'gap=' + cs.rowGap + '/' + cs.columnGap].filter(Boolean).join(' '));
    }
    if (cs.display === 'grid') add('grid', cs.gridTemplateColumns + ' | ' + cs.gridTemplateRows + ' gap=' + cs.rowGap + '/' + cs.columnGap);
    if (cs.gridColumn !== 'auto' && cs.gridColumn !== 'auto / auto') add('gcol', cs.gridColumn + ' row ' + cs.gridRow);
    const pad = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(' ');
    if (pad !== '0px 0px 0px 0px') add('pad', pad);
    if (cs.flexGrow !== '0') add('grow', cs.flexGrow + ' ' + cs.flexBasis);
    if (cs.minWidth !== 'auto' && cs.minWidth !== '0px') add('minw', cs.minWidth);
    if (cs.maxWidth !== 'none') add('maxw', cs.maxWidth);
    if (cs.marginRight !== '0px' || cs.marginBottom !== '0px' || cs.marginLeft !== '0px' || cs.marginTop !== '0px') add('m', [cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft].join(' '));
    if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)') add('bg', cs.backgroundColor);
    if (cs.backgroundImage !== 'none') add('bgimg', cs.backgroundImage.slice(0, 160));
    ['Top', 'Right', 'Bottom', 'Left'].forEach(d => { if (cs['border' + d + 'Width'] !== '0px' && cs['border' + d + 'Style'] !== 'none') add('b' + d[0], cs['border' + d + 'Width'] + ' ' + cs['border' + d + 'Style'] + ' ' + cs['border' + d + 'Color']); });
    if (cs.borderRadius !== '0px') add('radius', cs.borderRadius);
    if (cs.boxShadow !== 'none') add('shadow', cs.boxShadow);
    if (cs.opacity !== '1') add('op', cs.opacity);
    if (cs.transform !== 'none') add('tf', cs.transform);
    if (cs.backdropFilter !== 'none') add('bdf', cs.backdropFilter);
    if (cs.filter !== 'none') add('filter', cs.filter);
    if (cs.mixBlendMode !== 'normal') add('blend', cs.mixBlendMode);
    if (cs.overflow !== 'visible') add('ov', cs.overflow);
    if (cs.zIndex !== 'auto') add('z', cs.zIndex);
    if (e.tagName === 'IMG') { add('src', (e.getAttribute('src') || '').split('/').pop()); add('fit', cs.objectFit + ' ' + cs.objectPosition); }
    if (e.tagName === 'VIDEO') { add('video', (e.currentSrc || e.src || '').split('/').pop() + ' poster=' + (e.poster || '').split('/').pop() + ' ' + [e.autoplay && 'autoplay', e.loop && 'loop', e.muted && 'muted', e.controls && 'controls'].filter(Boolean).join(',')); add('fit', cs.objectFit); }
    if (e.getAttribute('href')) add('href', e.getAttribute('href'));
    if (e.getAttribute('role')) add('role', e.getAttribute('role'));
    const font = [cs.fontFamily.split(',')[0].replace(/"/g, ''), cs.fontSize, 'w' + cs.fontWeight, 'lh ' + cs.lineHeight, 'ls ' + cs.letterSpacing, cs.textTransform !== 'none' ? cs.textTransform : '', 'ta ' + cs.textAlign, cs.whiteSpace !== 'normal' ? cs.whiteSpace : '', cs.color, cs.fontVariationSettings !== 'normal' ? cs.fontVariationSettings : ''].filter(Boolean).join(' ');
    if (!pcs || font !== pcs.__font) { if ([...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) add('font', font); }
    cs.__font = font;
    return s;
  };
  const walk = (e, depth, pcs) => {
    const cs = getComputedStyle(e);
    if (cs.display === 'none') return;
    const own = [...e.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join(' ');
    const s = pick(e, cs, pcs);
    const r = R(e);
    const kids = [...e.children];
    const trivial = !own && s.length === 0 && kids.length === 1 && JSON.stringify(R(kids[0])) === JSON.stringify(r) && !['IMG','VIDEO','A','SECTION','HEADER','FOOTER','NAV','H1','H2','H3','P','BUTTON'].includes(e.tagName);
    const ariaHiddenEmpty = e.getAttribute('aria-hidden') === 'true' && s.length === 0 && kids.length === 0;
    if (!trivial && !ariaHiddenEmpty) {
      out.push('  '.repeat(depth) + e.tagName.toLowerCase() + ' [' + r.join(',') + '] ' + s.join(' ; ') + (own ? '  "' + own.replace(/\s+/g, ' ') + '"' : ''));
      depth++;
    }
    kids.forEach(k => walk(k, depth, cs));
  };
  walk(root, 0, null);
  return out.join('\n');
})()

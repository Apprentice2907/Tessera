// Tessera · Ideas: the whiteboard, edge to edge. The page switcher hides here; the board brings its own way back (the
// first toolbar button, or keys 1–7). Opening the page starts the board (loads it, joins the other tabs on it) and
// wires the pointer and keys; leaving stops both.
//   #/ideas opens the board you had open last this visit, else "Ideas". #/ideas?b=<id> opens that board;
//   ?as=<name>&role=editor|viewer joins as someone else, the way a shared link did.
import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { start, stop } from './core';
import { attach } from './input';
import { importImages } from './extras';
import { UI, closeModal, closePops } from './pops';
import { Canvas } from './Canvas';
import { BarL, BarR, CtxBar, Flyout, Tools } from './Chrome';
import { Drawer, Modal, Pops } from './Cards';

export function Board() {
  const vp = useRef<HTMLDivElement>(null), root = useRef<HTMLElement>(null), file = useRef<HTMLInputElement>(null);
  const loc = useLocation(), go = useNavigate();
  // before the first paint, so the board shows at once rather than an empty canvas first
  useLayoutEffect(() => {
    UI.go = page => go('/' + (page === 'home' ? '' : page));
    start(new URLSearchParams(loc.search));
    const off = attach(vp.current!, root.current!);
    return () => { off(); closePops(); closeModal(); UI.drawer = false; stop(); };
  }, []); // once per visit to the page
  return (
    <main className="wbd" ref={root}>
      <Canvas ref={vp} />
      <BarL />
      <BarR />
      <Tools onUpload={() => file.current?.click()} />
      <Flyout />
      <CtxBar />
      <Drawer />
      <Pops />
      <Modal />
      <input type="file" ref={file} accept="image/*" multiple hidden onChange={e => { if (e.target.files) importImages(e.target.files); e.target.value = ''; }} />
    </main>
  );
}

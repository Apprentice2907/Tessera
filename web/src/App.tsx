// Tessera · the app shell: the page switcher, the router, the clock, and what floats over every page.
// Pages are routes under a hash router, so old links (#today, #review/<id>) and the desktop widget's still work.
// Keys 1–7 switch pages; U logs a project update from anywhere.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { Home } from './pages/Home';
import { Today } from './pages/Today';
import { Hours } from './pages/Hours';
import { Calendar } from './pages/Calendar';
import { Ideas } from './pages/Ideas';
import { Wall } from './pages/wall/Wall';
import { Review } from './pages/review/Review';
import { PopHost, Toast } from './ui/Pop';
import { closePop, setUI } from './store/ui';
import { useClock } from './store/clock';

export const PAGES = [['home', 'Home'], ['today', 'Today'], ['hours', 'Hours'], ['calendar', 'Calendar'], ['ideas', 'Ideas'], ['wall', 'Wall'], ['review', 'Review']] as const;
export type PageId = typeof PAGES[number][0];
const pageOf = (path: string): PageId => { const p = path.split('/')[1]; return (PAGES.find(x => x[0] === p)?.[0]) || 'home'; };

function Nav({ page }: { page: PageId }) {
  const go = useNavigate(), ref = useRef<HTMLElement>(null);
  // on a phone the switcher scrolls sideways: keep the page you're on in view
  useLayoutEffect(() => {
    const nav = ref.current, on = nav?.querySelector<HTMLElement>('.on');
    if (nav && on && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2;
  }, [page]);
  return (
    <nav className="nav" id="nav" aria-label="Sections" ref={ref}>
      {PAGES.map(([id, name], i) => (
        <button key={id} className={id === page ? 'on' : ''} aria-current={id === page ? 'page' : undefined} title={`${name} · ${i + 1}`} onClick={() => go('/' + (id === 'home' ? '' : id))}>
          {id === page && <motion.i className="nav-on" layoutId="nav-on" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
          <span>{name}</span>
        </button>
      ))}
    </nav>
  );
}

function Shell() {
  const loc = useLocation(), go = useNavigate(), page = pageOf(loc.pathname);
  const T = useClock(s => s.T);
  // a new page closes whatever was open, scrolls to the top, and names the window
  useEffect(() => {
    closePop();
    document.body.dataset.page = page;
    document.title = `Tessera · ${PAGES.find(p => p[0] === page)![1]}`;
  }, [page, loc.pathname]);
  useEffect(() => { scrollTo(0, 0); }, [page]);
  // single-key shortcuts: 1–7 switch pages, U logs a project update
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as Element)?.closest?.('input, textarea, select, [contenteditable], [data-float]')) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= PAGES.length) { go('/' + (n === 1 ? '' : PAGES[n - 1][0])); return; }
      if (e.key.toLowerCase() === 'u') {
        e.preventDefault();
        setUI({ ntMode: 'update', day: 0 });
        if (page !== 'today') go('/today');
        setTimeout(() => document.getElementById('nt')?.focus(), 80);
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [go, page]);
  return (
    <>
      {/* the page on its way out fades, then the next one's tiles arrive; moving inside Review morphs instead */}
      <AnimatePresence mode="wait">
        <motion.div key={page} className="page" data-day={T} exit={{ opacity: 0, transition: { duration: 0.12 } }}>
          <Routes location={loc}>
            <Route index element={<Home />} />
            <Route path="today" element={<Today />} />
            <Route path="hours" element={<Hours />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="ideas" element={<Ideas />} />
            <Route path="wall" element={<Wall />} />
            <Route path="review/*" element={<Review />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
      {page !== 'ideas' && <Nav page={page} />}
      <Toast />
      <PopHost />
    </>
  );
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <HashRouter><Shell /></HashRouter>
    </MotionConfig>
  );
}

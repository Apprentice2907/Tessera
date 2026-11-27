// Tessera · the app's entry. Load what this browser saved (and what serve.py has, if it's newer), keep Hours in step
// with finished tasks, turn to the new day at midnight, then draw.
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { restore } from './store/persist';
import { keepHoursInStep } from './store/rules';
import { tickClock } from './store/clock';
import { startContests } from './store/contests';
import { openLinksOutside } from './store/backend';
import './styles/app.css';
import './styles/home.css';
import './styles/today.css';
import './styles/hours.css';
import './styles/calendar.css';
import './styles/ideas.css';
import './styles/wall.css';
import './styles/review.css';
import './styles/motion.css';

openLinksOutside();
// coding contests go into the calendar by themselves, once the saved state is in
restore().then(startContests);
const sync = keepHoursInStep();
// the clock: every page turns to the new day at midnight; pages that show the time follow the minute
const check = () => { if (tickClock()) sync(); };
setInterval(check, 15000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });

createRoot(document.getElementById('root')!).render(<App />);

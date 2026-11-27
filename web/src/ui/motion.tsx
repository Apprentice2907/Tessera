// Tessera · how things move. Tiles arrive in order when a page opens (Motion variants, staggered by the bento);
// link tiles lift on hover. MotionConfig in App.tsx follows prefers-reduced-motion, which leaves only the fades.
import { motion, type HTMLMotionProps, type Variants } from 'motion/react';
import type { CSSProperties, ReactNode, Ref } from 'react';

export const EASE = [0.25, 0.8, 0.25, 1] as const;
export const tileIn: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: EASE } },
};
const bentoIn: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } } };

/** a page's grid of tiles; its tiles arrive one after another */
export function Bento({ className = '', style, children, ref }: { className?: string; style?: CSSProperties; children: ReactNode; ref?: Ref<HTMLElement> }) {
  return <motion.main className={'bento ' + className} style={style} variants={bentoIn} initial="hidden" animate="show" ref={ref}>{children}</motion.main>;
}

type TileProps = { area?: string; g?: string; className?: string; style?: CSSProperties; children?: ReactNode };
/** a tile: its ground (g-*), its place in the grid (grid-area), its words and numbers inside */
export function Tile({ area, g = '', className = '', style, children, ...rest }: TileProps & Omit<HTMLMotionProps<'section'>, 'style' | 'children'>) {
  return <motion.section className={`tile ${g} ${className}`} style={{ gridArea: area, ...style }} variants={tileIn} {...rest}>{children}</motion.section>;
}
/** a tile that opens another page: it lifts a little on hover */
export function LinkTile({ area, g = '', className = '', style, children, href, ...rest }: TileProps & { href: string } & Omit<HTMLMotionProps<'a'>, 'style' | 'children' | 'href'>) {
  return (
    <motion.a className={`tile ${g} ${className}`} href={href} style={{ gridArea: area, ...style }} variants={tileIn}
      whileHover={{ y: -3, transition: { duration: 0.3, ease: EASE } }} {...rest}>{children}</motion.a>
  );
}

/** the bold + muted line at the top left of a tile */
export const Copy = ({ b, s, className }: { b?: ReactNode; s?: ReactNode; className?: string }) => (
  <div className={'copy' + (className ? ' ' + className : '')}>{b != null && <b>{b}</b>}{b != null && s != null && ' '}{s != null && <span>{s}</span>}</div>
);

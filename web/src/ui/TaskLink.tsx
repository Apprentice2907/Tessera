// Tessera · the button beside a task's star that opens its link: a meeting, a contest page. In the desktop app it opens
// in your browser (store/backend.ts sends every outside link there).
import { linkName } from '../lib/links';
import { LinkIcon } from './icons';

export function TaskLink({ url, title }: { url?: string; title: string }) {
  if (!url) return null;
  const where = linkName(url);
  return (
    <a className="tlink" href={url} target="_blank" rel="noopener noreferrer" draggable={false} title={`Open in ${where}`} aria-label={`Open ${title} in ${where}`}
      onClick={e => e.stopPropagation()}><LinkIcon /></a>
  );
}

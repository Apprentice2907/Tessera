// Tessera · the archive behind Review: your folders, your project files, and what you add to each month.
//
//   folders   { id, name, ground, kind, cat, created }
//             kind 'month': a file for every month from the one it was made in, filled in from one Hours category (cat)
//             kind 'projects': a file per project you start
//   projects  id → { id, folder, name, created, status, tagline, about, note, plan: [[done, text]], entries: [[date, text]] }
//   months    'folderId|YYYY-MM' → { note, also: [[text, date]] }: the note and the "also this month" list of a monthly file
// Dates are 'YYYY-MM-DD'. core/store.js saves all of it.
'use strict';
const ARCHIVE = { folders: [], projects: {}, months: {} };
// the grounds a folder can wear; `on` is its colour where a tick is cut out of it, `a` its four day-square shades
const FOLDER_LOOKS = {
  green:  { g: 'g-green',  on: '#3E8A66', a: ['#CFF2D8', '#8EDFA3', '#34C759', '#1F8A3B'] },
  lilac:  { g: 'g-lilac',  on: '#C9B8FF', a: ['#E2DBFF', '#B9A9FF', '#7B61FF', '#5A3ECF'] },
  orange: { g: 'g-orange', on: '#FF6A2C', a: ['#FFE2D1', '#FFB58C', '#FF7438', '#D9481A'] },
  night:  { g: 'g-night',  on: '#151517', a: ['#2E2E33', '#1E5B37', '#2E8A50', '#7BE08F'] },
  kraft:  { g: 'g-kraft',  on: '#C8A37C', a: ['#E9D8C2', '#D9B98F', '#A97C4F', '#6E4B2A'] },
  sea:    { g: 'g-sea',    on: '#38BDF8', a: ['#D6F0FD', '#9ADCFB', '#38BDF8', '#3D3BD6'] },
};
const lookOf = f => FOLDER_LOOKS[f.ground] || FOLDER_LOOKS.green;
const folderById = id => ARCHIVE.folders.find(f => f.id === id);
const projectsIn = f => Object.values(ARCHIVE.projects).filter(p => p.folder === f.id);
const monthNote = (fid, ym) => ARCHIVE.months[fid + '|' + ym] || (ARCHIVE.months[fid + '|' + ym] = { note: '', also: [] });

// Tessera · Ideas board — the saved shapes. These are exactly what the plain-JS board wrote to localStorage:
//   tessera.wb.index     IndexEntry[]                      the list of boards
//   tessera.wb.folders   string[]                          folder names, in order
//   tessera.wb.b.<id>    SavedBoard                        one board and everything on it
//   tessera.wb.v.<id>    Version[]                         its versions, newest first (this browser only)
//   session tessera.wb.me  Me                              who this tab is

export type ObjType = 'note' | 'text' | 'shape' | 'image' | 'link' | 'section' | 'stamp' | 'comment' | 'ink' | 'poll' | 'line';
export type FontSize = 's' | 'm' | 'l' | 'xl';

/** one end of a connector: an object it is attached to, or a free point */
export interface End { id?: string; x?: number; y?: number }
export interface Msg { by: string; at: number; text: string }
export interface PollOpt { t: string; v?: Record<string, number> }

/** everything on a board. Objects are never changed in place: every edit makes a new object (rev goes up by one).
 *  A connector (type 'line') has no x/y/w/h of its own: its ends a and b say where it runs. */
export interface Obj {
  id: string; type: ObjType;
  x: number; y: number; w: number; h: number;
  z: number; r?: number; rev: number;
  by?: string; at?: number;
  g?: string; locked?: boolean;
  // text on notes, text, shapes and sections (a section's title), a connector's label
  text?: string; color?: string; fs?: FontSize; align?: 'left' | 'center' | 'right'; bold?: boolean;
  // shapes
  kind?: string; fill?: string; stroke?: string; sw?: number;
  // images and links
  src?: string; alt?: string; url?: string; title?: string;
  // stamps: the stamp's key (the classic board stored an emoji here; it is kept as the key and drawn instead)
  emoji?: string;
  // comments
  thread?: Msg[]; resolved?: boolean;
  // drawings: points relative to x/y at the size nw × nh
  nw?: number; nh?: number; pts?: [number, number][]; hl?: boolean;
  // polls
  q?: string; opts?: PollOpt[];
  // connectors
  a?: End; b?: End; style?: string; arrow?: string; dash?: boolean;
}
export type Objs = Record<string, Obj>;

export interface Member { name: string; role: 'owner' | 'editor' | 'viewer' }
export interface Settings { grid?: boolean; bg?: 'paper' | 'white' | 'warm' | 'dark'; snap?: boolean }
export interface Meta { members: Member[]; settings?: Settings; vote?: unknown; timer?: unknown }
/** the open board, without its objects (those live in WB.objs) */
export interface Board { id: string; name: string; folder: string; meta: Meta }
export interface SavedBoard extends Board { objs: Objs }
export interface IndexEntry { id: string; name: string; folder: string; updated: number; count: number; owner?: string }
export interface Version { t: number; by: string; label: string; count: number; objs: Objs }
export interface Me { id: string; name: string; color: string }
export interface Peer { id: string; name: string; color: string; x?: number; y?: number; sel?: string[]; role?: string; seen: number }

export type Tool = 'select' | 'hand' | 'note' | 'text' | 'shape' | 'line' | 'pen' | 'hl' | 'section' | 'stamp' | 'comment' | 'link';
export interface Opts { note: string; shape: string; fill: string; line: string; arrow: string; pen: string; penW: number; hl: string; stamp: string }

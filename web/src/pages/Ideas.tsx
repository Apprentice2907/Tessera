// Tessera · Ideas: the whiteboard (board.html, the classic page) inside the page, edge to edge. The page switcher hides
// here; the board brings its own way back (its first toolbar button, or keys 1–7).
export function Ideas() {
  return (
    <main className="bento p-board">
      <section className="tile board-tile"><iframe src="board.html?b=ideas&embed=1" title="Ideas board" /></section>
    </main>
  );
}

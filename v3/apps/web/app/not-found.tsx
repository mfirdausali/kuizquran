// The 404. Reached by `notFound()` from a bad route segment (surah 900,
// "/surah/abc") and by any URL outside the tree.
//
// It is a real, styled page with a way back, not the framework default:
// a learner who mistypes a URL, or follows a stale link from an older build,
// must land somewhere that still looks like the app and still has an exit.
//
// No tab bar — this file sits at the app root, outside the (app) route group,
// so a 404 from the landing side does not sprout learner navigation.

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>Not found</h1>
          <p className="caption">
            That page does not exist. Nothing has been lost — your history is
            stored on this device and is untouched.
          </p>
        </header>
        <div className="card">
          <Link href="/home" className="btn btn--primary hit">
            Go to Home
          </Link>
        </div>
      </div>
    </main>
  );
}

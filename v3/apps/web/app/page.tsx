// "/" — landing (v3-D14: `/` is a real stateless page, never a redirect).
// STUB. Plan §C2 assigns the real landing content to M10; this exists only so
// the app compiles and builds while §D (the IndexedDB island) is verified.
// No client JS, no IDB, no engine import — this is a Server Component.

export default function LandingPage() {
  return (
    <main>
      <h1>Iman Quiz</h1>
      <p>Memorise, and keep what you memorise.</p>
    </main>
  );
}

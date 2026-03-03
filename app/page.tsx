export default function HomePage() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}>
      <h1>Healthy!</h1>
      <p>This page confirms the app is running.</p>
      <a
        href='/playground'
        style={{ color: '#0070f3', textDecoration: 'underline' }}>
        Go to Playground
      </a>
    </main>
  );
}

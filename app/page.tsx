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
      <h1>Welcome!</h1>
      <p>This is the main page. All traffic is now directed here.</p>
    </main>
  );
}

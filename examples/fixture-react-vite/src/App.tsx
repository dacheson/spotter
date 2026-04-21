export function App() {
  const loading = false;
  const error = false;
  const modalOpen = true;
  const user = null;
  const items: string[] = [];

  if (loading) {
    return <div>Loading</div>;
  }

  if (error) {
    return <div>Error state</div>;
  }

  return (
    <main>
      {modalOpen && <div role="dialog">Invite modal</div>}
      {!user ? <div>Log in</div> : null}
      {items.length === 0 ? <p>No results</p> : null}
      <form>
        <input name="email" />
      </form>
    </main>
  );
}

export default App;
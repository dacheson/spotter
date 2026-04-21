export default function AdminPage() {
  const user = { name: 'Taylor' };
  const isAdmin = false;

  if (!user) {
    return <div>Please sign in</div>;
  }

  if (!isAdmin) {
    return <div>Read only mode</div>;
  }

  return <section>Admin dashboard</section>;
}
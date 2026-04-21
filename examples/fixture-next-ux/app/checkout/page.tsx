export default function CheckoutPage() {
  const loading = false;

  if (loading) {
    return <div>Loading checkout</div>;
  }

  return (
    <form>
      <input name="email" />
      <button type="submit">Complete purchase</button>
    </form>
  );
}
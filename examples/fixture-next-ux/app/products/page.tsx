export default function ProductsPage() {
  const products: string[] = [];

  if (products.length === 0) {
    return <p>No products found</p>;
  }

  return <ul>{products.map((product) => <li key={product}>{product}</li>)}</ul>;
}
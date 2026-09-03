export const metadata = {
  title: 'Spotter UX fixture',
  description:
    'A Next.js app exercising the UX states Spotter is meant to discover: auth and role gates, loading, validation and empty states, dynamic routes and route groups.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import './tailwind.css';

export const metadata = {
  title: 'Aquarium Autobattler',
  description: 'Build your dream aquarium and dominate the competition!',
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

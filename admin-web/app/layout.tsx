import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Tri Fare Agoo Admin', description: 'Report and feedback dashboard' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

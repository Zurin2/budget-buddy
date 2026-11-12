import './globals.css';
import Providers from '@/components/Providers';

export const metadata = {
  title: 'Budget Buddy',
  description: 'Track GCash and Cash on Hand per category, plan a budget, and let the AI assistant move money for you.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

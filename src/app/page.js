import { redirect } from 'next/navigation';

export default function Home() {
  // Always redirect root to dashboard
  // Middleware handles auth checking to bounce them to login if needed
  redirect('/dashboard');
}

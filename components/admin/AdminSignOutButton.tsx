import { LogOut } from 'lucide-react';
import { signOut } from '@/auth';

export function AdminSignOutButton() {
  return (
    <form
      action={async () => {
        'use server';
        await signOut({ redirectTo: '/' });
      }}
    >
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-sm font-bold text-white/70 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
      >
        <LogOut className="h-3.5 w-3.5" />
        로그아웃
      </button>
    </form>
  );
}

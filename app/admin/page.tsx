import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { isGoogleAuthConfigured } from '@/auth.config';
import { isAdminEmail } from '@/lib/auth/admin';
import { AdminLoginGate } from '@/components/admin/AdminLoginGate';
import { AdminSettingsPanel } from '@/components/admin/AdminSettingsPanel';
import { AdminSignOutButton } from '@/components/admin/AdminSignOutButton';

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const session = await auth();
  const params = searchParams ? await searchParams : undefined;
  const email = session?.user?.email ?? null;
  const googleConfigured = isGoogleAuthConfigured();

  if (email && !isAdminEmail(email)) {
    redirect('/?adminError=forbidden');
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-stone-950 px-5 py-8 text-white sm:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_20%_0%,rgba(245,158,11,0.16),transparent_55%),radial-gradient(ellipse_50%_40%_at_90%_100%,rgba(30,58,138,0.28),transparent_50%)]"
      />

      <div className="relative z-10 mx-auto w-full max-w-lg">
        {email && isAdminEmail(email) ? (
          <AdminSettingsPanel
            adminEmail={email}
            signOutSlot={<AdminSignOutButton />}
          />
        ) : (
          <AdminLoginGate
            authError={params?.error ?? null}
            googleConfigured={googleConfigured}
          />
        )}
      </div>
    </div>
  );
}

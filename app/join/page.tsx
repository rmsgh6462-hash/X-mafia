import { redirect } from 'next/navigation';

/** 예전 QR 경로 호환 → /play 로 전달 */
export default async function JoinRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ pin?: string }>;
}) {
  const { pin } = await searchParams;
  redirect(pin ? `/play?pin=${encodeURIComponent(pin)}` : '/play');
}

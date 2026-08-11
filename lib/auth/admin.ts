/**
 * 관리자 이메일 화이트리스트.
 * 서버 전용 ADMIN_EMAIL을 우선하고, 없으면 NEXT_PUBLIC_ADMIN_EMAIL을 사용한다.
 * 콤마로 여러 이메일을 허용할 수 있다.
 */
export function getAdminEmails(): string[] {
  const raw =
    process.env.ADMIN_EMAIL?.trim() ||
    process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim() ||
    '';
  if (!raw) return [];
  return raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = getAdminEmails();
  if (allowlist.length === 0) return false;
  return allowlist.includes(email.trim().toLowerCase());
}

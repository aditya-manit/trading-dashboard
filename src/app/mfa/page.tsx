import { redirect } from 'next/navigation';

// The 2FA code step is now hosted on the unified splash (/login), which detects
// an AAL1 owner session and shows the code grid. /mfa just forwards there.
// (/mfa/setup remains for first-time authenticator enrollment.)
export default function MfaPage() {
  redirect('/login');
}

import Link from "next/link";
import { AuthShell, AuthTextLink } from "@/components/auth/auth-shell";

const routes = [
  { href: "/auth/sign-in", title: "Sign in", copy: "Access your website account and open the app workspace." },
  { href: "/auth/sign-up", title: "Create account", copy: "Register a new Knowlense account from the website." },
  { href: "/auth/verify-email", title: "Verify email", copy: "Resend the confirmation email or check verification status." },
  { href: "/auth/forgot-password", title: "Forgot password", copy: "Request a recovery email and restore account access." },
  { href: "/auth/change-password", title: "Change password", copy: "Update your password while already signed in." },
  { href: "/auth/update-password", title: "Update password", copy: "Set a new password after opening the recovery link." }
];

export default function AuthIndexPage() {
  return (
    <AuthShell
      footer={
        <>
          Need the product overview? <AuthTextLink href="/">Go to homepage</AuthTextLink>
        </>
      }
      subtitle="Each account state uses a dedicated route so sign-in, verification, and recovery stay clear."
      title="Authentication flows"
    >
      <div className="space-y-3">
        {routes.map((route) => (
          <Link
            className="block rounded-[20px] border border-black/10 px-4 py-4 transition hover:border-black/15 hover:bg-neutral-50"
            href={route.href}
            key={route.href}
          >
            <div className="text-base font-medium text-black">{route.title}</div>
            <div className="mt-1 text-sm leading-6 text-neutral-500">{route.copy}</div>
          </Link>
        ))}
      </div>
    </AuthShell>
  );
}

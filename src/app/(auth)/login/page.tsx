import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Image
            src="/brand/felis-logo.png"
            alt="Felis Clinic"
            width={56}
            height={56}
            className="h-14 w-14 object-contain"
            priority
          />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Felis Clinic</h1>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              ANC System
            </p>
          </div>
        </div>

        <LoginForm next={next} />

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Accounts are created by a clinic administrator. Contact yours if
          you need access.
        </p>
      </div>
    </div>
  );
}

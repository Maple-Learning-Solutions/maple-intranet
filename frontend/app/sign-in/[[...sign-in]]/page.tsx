"use client";
/* eslint-disable react/no-unescaped-entities */

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Mail, Loader2, AlertCircle } from "lucide-react";

import { AuthLayout, FieldBox, AuthButton } from "@/components/ui/auth-section-1";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(false);
    setUnverifiedEmail(null);
    setResendSent(false);

    try {
      setIsLoading(true);
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        const errorLower = res.error.toLowerCase();
        if (errorLower.includes("not been verified") || errorLower.includes("verify your email")) {
          setUnverifiedEmail(email);
          toast.error("Your email is not verified yet. Please check your inbox or resend the link below.");
        } else {
          toast.error(res.error || "Invalid email or password");
        }
      } else {
        toast.success("Signed in successfully!");
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      toast.error("An error occurred during sign in. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async (targetEmail: string) => {
    if (!targetEmail) return;
    setIsResending(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      await fetch(`${backendUrl}/api/v1/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      setResendSent(true);
      toast.success("Verification link sent! Please check your inbox.");
    } catch {
      toast.error("Failed to resend verification link. Please try again later.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your Maple Intranet account"
      showSocial={true}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <FieldBox
          label="Official Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
        />
        <FieldBox
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
        />

        {/* Unverified account notice */}
        {unverifiedEmail && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">Email Verification Pending</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Your account requires email verification before you can sign in.
                </p>
              </div>
            </div>
            {resendSent ? (
              <p className="text-xs text-green-700 font-medium flex items-center gap-1.5 pt-1">
                <Mail className="h-4 w-4" />
                A new verification link has been sent to your inbox.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => handleResend(unverifiedEmail)}
                disabled={isResending}
                className="text-xs font-semibold text-brand-teal-deep hover:underline flex items-center gap-1 pt-1 disabled:opacity-60"
              >
                {isResending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Resend verification email to {unverifiedEmail}
              </button>
            )}
          </div>
        )}

        <div className="flex justify-between items-center pt-2 text-sm">
          <button
            type="button"
            onClick={() => {
              if (email) {
                handleResend(email);
              } else {
                toast.info("Please enter your email above to resend verification.");
              }
            }}
            disabled={isResending}
            className="text-xs text-slate-500 hover:text-brand-teal font-medium"
          >
            Resend verification email
          </button>
          <Link href="/forgot-password" className="text-sm text-brand-teal-deep hover:underline font-medium">
            Forgot password?
          </Link>
        </div>

        <AuthButton isLoading={isLoading}>
          Sign In
        </AuthButton>
      </form>

      <div className="mt-8 text-center text-sm font-medium text-black/60 dark:text-white/50">
        Don't have an account?{" "}
        <Link href="/sign-up" className="text-brand-teal-deep hover:underline">
          Create account
        </Link>
      </div>
    </AuthLayout>
  );
}

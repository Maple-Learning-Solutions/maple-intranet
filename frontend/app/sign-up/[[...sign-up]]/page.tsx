"use client";
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";

import { AuthLayout, FieldBox, AuthButton } from "@/components/ui/auth-section-1";

type PageState = "form" | "verify-pending";

export default function SignUpPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pageState, setPageState] = useState<PageState>("form");
  const [errorMsg, setErrorMsg] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [pendingNotice, setPendingNotice] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${backendUrl}/api/v1/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Show the backend's user-friendly message; never show raw errors
        setErrorMsg(data.detail || "Failed to create account. Please try again.");
        return;
      }

      setSubmittedEmail(email);

      if (data.requires_verification === false) {
        // Dev mode: auto-verified, send straight to sign-in
        setPageState("form");
        setErrorMsg(""); 
        window.location.href = "/sign-in?registered=1";
        return;
      }

      // Show check-your-inbox screen (works for both new signup and pending-verification resend)
      setPendingNotice(
        data.pending_verification
          ? "An account with this email was pending verification. We've resent the verification link."
          : ""
      );
      setPageState("verify-pending");
    } catch {
      setErrorMsg("Unable to connect to the server. Please check your internet connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Check-your-inbox screen ───────────────────────────────────────────────
  if (pageState === "verify-pending") {
    return (
      <AuthLayout
        title="Check your inbox"
        subtitle={`We sent a verification link to ${submittedEmail}`}
        showSocial={false}
      >
        <div className="space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-brand-teal/10 flex items-center justify-center">
              <Mail className="h-8 w-8 text-brand-teal" />
            </div>
          </div>

          {pendingNotice && (
            <p className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-2.5 text-center font-medium">
              {pendingNotice}
            </p>
          )}

          <p className="text-sm text-center text-slate-500 leading-relaxed">
            Click the link in your email to verify your account. The link expires in{" "}
            <strong>24 hours</strong>.
          </p>

          <p className="text-sm text-center text-slate-500">
            Didn&apos;t receive it?{" "}
            <ResendButton email={submittedEmail} />
          </p>

          <Link
            href="/sign-in"
            className="flex items-center justify-center gap-2 text-sm font-medium text-brand-teal hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  // ── Registration form ─────────────────────────────────────────────────────
  return (
    <AuthLayout
      title="Create an account"
      subtitle="Join Maple Intranet as an Employee"
      showSocial={true}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <FieldBox
            label="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <FieldBox
            label="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>

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

        <FieldBox
          label="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          type="password"
          required
        />

        {errorMsg && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
            {errorMsg}
          </p>
        )}

        <AuthButton isLoading={isLoading}>Create account</AuthButton>
      </form>

      <div className="mt-8 text-center text-sm font-medium text-black/60 dark:text-white/50">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-brand-teal-deep hover:underline">
          Sign In
        </Link>
      </div>
    </AuthLayout>
  );
}

// Inline resend button component
function ResendButton({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "loading" | "sent">("idle");

  const handleResend = async () => {
    setState("loading");
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      await fetch(`${backendUrl}/api/v1/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      // ignore — show success anyway (anti-enumeration)
    }
    setState("sent");
  };

  if (state === "sent") return <span className="text-green-600 font-medium">Email resent!</span>;

  return (
    <button
      type="button"
      onClick={handleResend}
      disabled={state === "loading"}
      className="text-brand-teal-deep font-medium hover:underline disabled:opacity-60"
    >
      {state === "loading" ? "Sending…" : "Resend verification email"}
    </button>
  );
}

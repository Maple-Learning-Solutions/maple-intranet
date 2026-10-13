"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2, Mail, ShieldCheck } from "lucide-react";

type State = "checking" | "ready" | "verifying" | "success" | "already_verified" | "error";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [state, setState] = useState<State>("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("No verification token found in the link. Please use the link provided in your email.");
      return;
    }

    // Inspect token status (read-only GET — NEVER marks account verified merely because link was opened)
    const checkTokenStatus = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const res = await fetch(
          `${backendUrl}/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`
        );
        const data = await res.json();

        if (res.ok) {
          if (data.status === "valid" || data.status === "pending_confirmation") {
            setState("ready");
            setMessage("Please click the button below to confirm your email and activate your account.");
          } else if (data.status === "already_verified") {
            setState("already_verified");
            setMessage("Your email is already verified. You can sign in to your account.");
          } else if (data.status === "already_used") {
            setState("error");
            setMessage("This verification link has already been used. Please request a new one below if needed.");
          } else if (data.status === "expired") {
            setState("error");
            setMessage("This verification link has expired (links are valid for 24 hours). Please request a new one below.");
          } else {
            setState("error");
            setMessage(data.message || "This verification link is invalid. Please request a new one below.");
          }
        } else {
          setState("error");
          setMessage(data.detail || "This verification link is invalid or has expired.");
        }
      } catch {
        // If inspection fails due to network, still allow user to attempt verification button
        setState("ready");
        setMessage("Click the button below to confirm and verify your email address.");
      }
    };

    checkTokenStatus();
  }, [token]);

  // Handle explicit confirmation click (POST request)
  const handleConfirmVerification = async () => {
    if (!token) return;
    setState("verifying");

    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${backendUrl}/api/v1/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();

      if (res.ok) {
        if (data.already_verified) {
          setState("already_verified");
        } else {
          setState("success");
        }
        setMessage(data.message || "Email verified successfully!");
      } else {
        setState("error");
        setMessage(data.detail || "This verification link is invalid or has expired. Please request a new one.");
      }
    } catch {
      setState("error");
      setMessage("Could not connect to the server. Please check your internet connection and try again.");
    }
  };

  // Auto-redirect to sign-in on success after 4 seconds
  useEffect(() => {
    if (state === "success" || state === "already_verified") {
      const t = setTimeout(() => router.push("/sign-in"), 4000);
      return () => clearTimeout(t);
    }
  }, [state, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-teal-deep via-brand-teal to-brand-green/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          {(state === "checking" || state === "verifying") && (
            <div className="h-16 w-16 rounded-full bg-brand-teal/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-brand-teal animate-spin" />
            </div>
          )}
          {state === "ready" && (
            <div className="h-16 w-16 rounded-full bg-brand-teal/10 flex items-center justify-center">
              <ShieldCheck className="h-9 w-9 text-brand-teal" />
            </div>
          )}
          {(state === "success" || state === "already_verified") && (
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-9 w-9 text-green-600" />
            </div>
          )}
          {state === "error" && (
            <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-9 w-9 text-red-500" />
            </div>
          )}
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          {state === "checking" && "Checking verification link…"}
          {state === "ready" && "Confirm your email"}
          {state === "verifying" && "Activating your account…"}
          {state === "success" && "Email verified!"}
          {state === "already_verified" && "Already verified"}
          {state === "error" && "Verification failed"}
        </h1>

        {/* Message */}
        <p className="text-slate-500 text-sm mb-8 leading-relaxed">{message}</p>

        {/* Action: Ready to verify */}
        {state === "ready" && (
          <div className="space-y-3">
            <button
              onClick={handleConfirmVerification}
              className="w-full py-3 px-6 bg-brand-teal text-white font-semibold rounded-xl hover:bg-brand-teal-deep transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              Verify My Email
            </button>
            <p className="text-xs text-slate-400">
              This single-use link confirms your Maple Intranet account.
            </p>
          </div>
        )}

        {/* Action: Success / Already verified */}
        {(state === "success" || state === "already_verified") && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">Redirecting you to sign in…</p>
            <Link
              href="/sign-in"
              className="block w-full py-3 px-6 bg-brand-teal text-white font-semibold rounded-xl hover:bg-brand-teal-deep transition-colors"
            >
              Sign in now
            </Link>
          </div>
        )}

        {/* Action: Error with inline resend */}
        {state === "error" && (
          <div className="space-y-3">
            <ResendForm />
            <Link
              href="/sign-in"
              className="block text-sm text-brand-teal hover:underline mt-4"
            >
              Back to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function ResendForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      await fetch(`${backendUrl}/api/v1/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex items-center gap-2 justify-center text-sm text-green-600 font-medium bg-green-50 rounded-lg p-3">
        <Mail className="h-4 w-4" />
        If an account with this email has a pending verification, a new link has been sent.
      </div>
    );
  }

  return (
    <form onSubmit={handleResend} className="space-y-2">
      <p className="text-sm text-slate-600 font-medium">Request a new verification link</p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your work email address"
        required
        className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 px-6 bg-brand-teal text-white font-semibold rounded-xl hover:bg-brand-teal-deep transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Resend verification email
      </button>
    </form>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-teal" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}

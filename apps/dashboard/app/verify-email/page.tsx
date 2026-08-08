"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { isAxiosError } from "axios";
import { verifyEmail } from "@/features/auth/api/auth.api";

type Status = "verifying" | "success" | "error";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>(token ? "verifying" : "error");
  const [message, setMessage] = useState<string | null>(
    token ? null : "This verification link is missing its token.",
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    verifyEmail(token)
      .then(() => {
        if (cancelled) return;
        setStatus("success");
        router.replace("/dashboard");
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(
          isAxiosError(error) && typeof error.response?.data?.message === "string"
            ? error.response.data.message
            : "This verification link is invalid or has expired.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
      {status === "verifying" ? (
        <p className="text-sm text-slate-500">Verifying your email…</p>
      ) : status === "success" ? (
        <p className="text-sm text-slate-500">Email confirmed! Redirecting…</p>
      ) : (
        <>
          <p className="text-sm text-rose-600">{message}</p>
          <Link href="/" className="mt-4 text-sm font-semibold text-blue-600">
            Back to home
          </Link>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}

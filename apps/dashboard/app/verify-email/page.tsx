"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { isAxiosError } from "axios";
import { verifyEmail } from "@/features/auth/api/auth.api";
import { useT } from "@/lib/i18n/context";

type Status = "verifying" | "success" | "error";

function VerifyEmailContent() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>(token ? "verifying" : "error");
  const [message, setMessage] = useState<string | null>(
    token ? null : t.verifyEmail.missingToken,
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    verifyEmail(token)
      .then(({ account }) => {
        if (cancelled) return;
        setStatus("success");
        router.replace(account.role === "student" ? "/dashboard" : "/");
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(
          isAxiosError(error) && typeof error.response?.data?.message === "string"
            ? error.response.data.message
            : t.verifyEmail.invalid,
        );
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
      {status === "verifying" ? (
        <p className="text-sm text-slate-500">{t.verifyEmail.verifying}</p>
      ) : status === "success" ? (
        <p className="text-sm text-slate-500">{t.verifyEmail.success}</p>
      ) : (
        <>
          <p className="text-sm text-rose-600">{message}</p>
          <Link href="/" className="mt-4 text-sm font-semibold text-blue-600">
            {t.verifyEmail.backToHome}
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

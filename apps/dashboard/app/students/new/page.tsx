import Link from "next/link";

export default function NewStudentPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-6 py-8">
      <div className="rounded-3xl bg-white p-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.08),0_12px_45px_rgba(15,23,42,0.05)] ring-1 ring-black/5">
        <p className="text-sm font-medium text-slate-500">За пределами MVP</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          Ручное создание студента пока отключено
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          В текущем API нет `POST /students`, поэтому первый MVP работает со
          студентами, которые уже пришли из Google Form.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition-transform hover:bg-slate-800 active:scale-[0.96]"
        >
          Вернуться к списку
        </Link>
      </div>
    </main>
  );
}

import { redirect } from "next/navigation";
import { getMe } from "@/lib/server/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Agent Login" };

export default async function LoginPage() {
  if (await getMe()) redirect("/");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-200 px-4">
      <div className="w-full max-w-sm rounded-md bg-white p-8 shadow-lg">
        <h1 className="mb-1 text-center text-xl font-bold text-slate-800">Staff Control Panel</h1>
        <h2 className="mb-5 text-center text-sm text-slate-500">Authentication Required</h2>
        <LoginForm />
        <p className="mt-6 text-center text-xs text-slate-400">Demo frontend for fast-ticket</p>
      </div>
    </main>
  );
}

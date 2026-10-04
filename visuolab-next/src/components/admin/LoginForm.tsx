"use client";

import { useState, type FormEvent } from "react";
import { login } from "@/actions/admin";

export default function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await login(new FormData(e.currentTarget)); // on success the action redirects and this never returns
      if (res?.error) setError(res.error);
    } catch (err) {
      // a redirect is thrown by the framework; anything else is a real failure
      if (!(err instanceof Error) || !/NEXT_REDIRECT|redirect/i.test(`${err.message} ${(err as { digest?: string }).digest ?? ""}`)) setError("Could not sign in. Please try again.");
      else throw err;
    }
    setBusy(false);
  };

  return (
    <form className="login" onSubmit={onSubmit}>
      <h1>Sign in</h1>
      <p className="admin-sub">Visuolab admin</p>
      <label htmlFor="a-email">Email</label>
      <input id="a-email" name="email" type="email" autoComplete="username" required maxLength={254} />
      <label htmlFor="a-pass">Password</label>
      <input id="a-pass" name="password" type="password" autoComplete="current-password" required maxLength={200} />
      {error && <p className="err" role="alert">{error}</p>}
      <button className="primary" type="submit" disabled={busy}>Sign in</button>
    </form>
  );
}

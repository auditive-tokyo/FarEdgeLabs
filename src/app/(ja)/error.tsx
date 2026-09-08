"use client";

import { useEffect } from "react";

/**
 * Route-segment error boundary. Must be a Client Component. Catches render and
 * data errors in this segment and offers a recovery action via `reset()`.
 *
 * 関数名を `Error` にしないこと。**global の `Error` を覆い隠す**ので、下の
 * `error: Error & { digest?: string }` が何を指しているのかがスコープ次第になる。
 * Next.js が見るのは default export だけで名前は自由なので、隠す理由が無い。
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error for logging/monitoring (kept by removeConsole's exclude).
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <button
        type="button"
        onClick={reset}
        className="underline underline-offset-4"
      >
        Try again
      </button>
    </div>
  );
}

/**
 * ヒーローの man と音声で会話する。WebRTC の1本を張るところまでを持つ。
 *
 * 流れは1往復で完結する。**STUN も TURN も signaling サーバも要らない。**
 *
 *   マイク取得 → RTCPeerConnection → offer を作る
 *     → SDP を中継関数へ POST（`application/json` の `{sdp}`）
 *       → 返ってきた answer を setRemoteDescription
 *         → 以降は**ブラウザと OpenAI が直結**。関数は経路から外れる
 *
 * 関数側は `gc_run_functions/realtime_call/`。モデルも指示文もあちらで固定されるので、
 * ここから送れるのは SDP だけ。
 *
 * > [!important] Turnstile のトークンは呼び出し側が用意する
 * > `start(token)` が受け取る。このフックはウィジェットを持たない — 検証をいつ走らせるか
 * > （ページ読み込み時か、ボタンを押したときか）は UI 側の判断で、そこを混ぜると
 * > 「話しかけない訪問者にも Turnstile を読み込ませる」形に固定されてしまう。
 * >
 * > **トークンが無いと関数は 403 を返す。** 中継は fail closed に倒してある
 * > （`main.py` の注記。素通しさせると出ていくのが金なので）。
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { realtimeEndpoint } from "@/env";

/**
 * `requesting-mic` を独立させているのは、**ブラウザの許可ダイアログが出ている間、
 * 画面上は何も起きていないように見える**から。ここを `connecting` に混ぜると、
 * 訪問者が「押したのに反応しない」と受け取る。
 *
 * `connecting` も同じ理由で長い。中継関数はほぼ毎回コールドスタート（月に数件の
 * サイトなのでインスタンスは常に冷えている）で、1〜3秒の無音が入る。
 */
export type RealtimeCallState =
  | "idle"
  | "requesting-mic"
  | "connecting"
  | "live"
  | "error";

/**
 * 失敗の種類。**文言を持たない**のは、表示はロケールファイルの仕事だから。
 *
 * `mic-denied` を他と分けているのは、これだけ**訪問者が自分で直せる**から。
 * 他は「時間を置く」以外にできることが無い。
 */
export type RealtimeCallError =
  | "mic-denied"
  | "rejected"
  | "unavailable"
  | "connection-lost"
  /**
   * 無音が続いた、または通話が上限に達した。**故障ではない。**
   *
   * それでもここに置いているのは、文言を必ず用意させるため —— `hero-voice.tsx` の
   * `Record<RealtimeCallError, string>` が網羅性を検査するので、種別を足すと
   * ロケールの追加漏れがコンパイルエラーになる。黙って終わるのが一番不親切。
   */
  | "timed-out";

export interface UseRealtimeCall {
  state: RealtimeCallState;
  error: RealtimeCallError | null;
  /** Turnstile のトークンを渡して通話を始める。 */
  start: (turnstileToken: string) => Promise<void>;
  /** 切る。マイクも必ず解放する。 */
  stop: () => void;
  /** 相手の声の出力先。`<audio>` に付ける。 */
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

/**
 * 無音がこれだけ続いたら切る。
 *
 * **GPT-Live は「セッションが開いている時間」で課金される**（$0.05/分、秒課金）。
 * Realtime とは逆で、**黙っていても止まらない** — あちらは server VAD 下の無音が
 * 0 トークンだった。タブを開いたまま席を離れられると、WebRTC はバックグラウンド
 * タブでも動き続けるので課金も続く。1晩で $24、1週間で $500。
 *
 * 45秒なのは**非対称だから**。短すぎると次の質問を考えている訪問者を切ってしまい、
 * 押し直し + **Turnstile の取り直し**（トークンは使い捨て）になる。長すぎたときの損は
 * 数十秒ぶんの課金で、30秒にしたところで差は **$0.0125**。**迷ったら長いほうへ倒す。**
 *
 * **精密な値ではない。** 30秒でも擁護できる。45秒にしたのは、ページを読みながら次を
 * 考える訪問者を想定したから。短くするなら、根拠は費用ではなく**実際に切られた人が
 * いたかどうか**で判断すること。
 *
 * 下の `session.usage.updated` の15秒周期とは**無関係**。あれはタイマーが無視する
 * イベントの周期で、この値の決め方には一切効かない（偶然同じ数字が出てくるだけ）。
 *
 * 壁時計で課金されることは実測済み（2026-09-15）。マイクを切って放置し、残高が
 * **$1.03 → $1.21（3.6分ぶん）**。ドキュメントの "billed by duration" は
 * 「音声のやり取りがある時間」ではなく**セッションが開いている時間**だった。
 */
const IDLE_HANGUP_MS = 45_000;

/**
 * 喋り続けていても、ここで切る。
 *
 * **こちらが費用の保証で、無音タイマーはその手前の最適化。** 下の `onmessage` が
 * どのイベントでも無音タイマーを叩き直す作りなので、キープアライブが流れていれば
 * 無音タイマーは永久に発火しない。**そのときに効くのがこの上限**で、だから
 * 「イベントを選り分けて判定する」より「上限で保証する」ほうを選んでいる。
 *
 * 3分。**この man は商談をしない** —— 具体的な相談は問い合わせフォームへ回す約束に
 * なっている（`instruction.py` の「料金・期間・受注可否・見積りは答えない」）ので、
 * 会話は一言二言で終わる設計。足りなければ押し直せばよい。
 */
const MAX_CALL_MS = 3 * 60_000;

export const useRealtimeCall = (): UseRealtimeCall => {
  const [state, setState] = useState<RealtimeCallState>("idle");
  const [error, setError] = useState<RealtimeCallError | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 後始末。**マイクのトラックを止め忘れると、通話が終わってもブラウザの録音表示が
   * 消えない。** `RTCPeerConnection.close()` はトラックを止めないので、両方要る。
   * 見た目に出るぶん、これは静かに壊れない類の不具合。
   */
  const teardown = useCallback(() => {
    // タイマーを先に落とす。**残すと、切ったあとのタイマーが `setState` を叩いて
    // `idle` に戻した画面をいきなり `error` にする。**
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (capTimerRef.current) clearTimeout(capTimerRef.current);
    idleTimerRef.current = null;
    capTimerRef.current = null;

    micRef.current?.getTracks().forEach((track) => track.stop());
    micRef.current = null;

    pcRef.current?.close();
    pcRef.current = null;

    if (audioRef.current) audioRef.current.srcObject = null;
  }, []);

  const stop = useCallback(() => {
    teardown();
    setState("idle");
    setError(null);
  }, [teardown]);

  // ページを離れるときに必ず解放する。**離脱で自動的に止まると思わないこと** —
  // マイクは掴んだままになる。
  useEffect(() => teardown, [teardown]);

  const start = useCallback(
    async (turnstileToken: string) => {
      if (pcRef.current) return;

      setError(null);
      setState("requesting-mic");

      let mic: MediaStream;
      try {
        // エコーキャンセルを明示する。**スピーカーで喋る訪問者**が相手なので、
        // これが無いと man が自分の声を拾って会話が成立しない。既定で有効な
        // ブラウザが多いが、依存しない。
        mic = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch {
        setError("mic-denied");
        setState("error");
        return;
      }
      micRef.current = mic;
      setState("connecting");

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // 相手の声。`autoPlay` に頼らず自分で `play()` を呼ぶのは、Safari が
      // ユーザー操作から離れた再生を止めるため。**失敗しても通話は成立している**
      // ので、ここで状態を壊さない。
      pc.ontrack = (event) => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.srcObject = event.streams[0];
        void audio.play().catch(() => undefined);
      };

      mic.getTracks().forEach((track) => pc.addTrack(track, mic));

      /** 時間切れで切る。**故障ではないが、黙って終わると訪問者に伝わらない。** */
      const hangUp = () => {
        if (pc !== pcRef.current) return;
        teardown();
        setError("timed-out");
        setState("error");
      };

      // 開発時だけの計測用。**残してある。**
      //
      // このタイマーは上流のイベントの流れ方に依存していて、そこは公式に完全な一覧が
      // 無い。**一度これを消してから直したせいで、直ったかどうかを確かめられずに
      // もう一往復した。** 本番ビルドでは `process.env.NODE_ENV` の置換で消えるので、
      // 置いておく費用がゼロ。次に挙動が変わったときは `npm run dev` で即わかる。
      const startedAt = Date.now();
      const probe = (...parts: unknown[]) => {
        if (process.env.NODE_ENV === "production") return;
        const at = ((Date.now() - startedAt) / 1000).toFixed(1).padStart(5);
        console.log(`[call ${at}s]`, ...parts);
      };

      const armIdleTimer = () => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
          probe("★ 無音タイマー発火");
          hangUp();
        }, IDLE_HANGUP_MS);
      };

      // イベント用のデータチャネル。後から足すには再ネゴシエーションが要るので、
      // 作るなら最初。
      //
      // **`usage` を含むイベントでは叩き直さない。** 最初は「どのイベントでも叩き
      // 直す」にしていて、**無音タイマーが一度も発火しなかった**。
      //
      // 2026-09-15 に実測した1通話の全イベント:
      //
      //     2.0s  session.started
      //     4.9s〜5.9s  session.input_transcript.delta   （訪問者が喋った）
      //     7.1s〜8.3s  session.output_transcript.delta  （man が喋った）
      //    15.7s / 30.7s / 45.7s  session.usage.updated  （**15秒周期**）
      //    53.3s ＝ 8.3 + 45.0 で発火
      //
      // 活動を示すのは transcript の2つだけ。定期的に流れるのは `usage` だけで、
      // それが延々とリセットしていた。
      //
      // 除外リスト（ここに挙げたものを無視する）にしてあるのは、許可リスト（挙げた
      // ものだけで叩き直す）だと**名前を1つ取りこぼしたときに会話の最中に切る**から。
      // 除外リストの取りこぼしはタイマーが効かなくなるだけで、`MAX_CALL_MS` が拾う。
      // **壊れ方が軽いほうを選ぶ。** `usage` が15秒周期だとわかったいまも、取りこぼし
      // は3分以内に必ず止まる側に倒っている。
      const events = pc.createDataChannel("oai-events");
      events.onmessage = (event) => {
        let type = "";
        try {
          type = JSON.parse(event.data as string).type ?? "(type なし)";
        } catch {
          // JSON でないものが来たら、中身の判断はしない。会話の証拠として扱う。
          type = "(JSON ではない)";
        }
        if (type.includes("usage")) {
          probe("無視 :", type);
          return;
        }
        probe("叩き直し:", type);
        armIdleTimer();
      };

      pc.onconnectionstatechange = () => {
        if (pc !== pcRef.current) return;
        if (pc.connectionState === "connected") {
          setState("live");
          armIdleTimer();
          // 通話の上限は繋がった時点から。**張り直さない** —— 叩き直せる無音タイマーと
          // 違って、こちらは伸びては意味が無い。
          if (!capTimerRef.current) capTimerRef.current = setTimeout(hangUp, MAX_CALL_MS);
        }
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          teardown();
          setError("connection-lost");
          setState("error");
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // ICE の収集完了を待たない。中継関数がそのまま上流へ渡し、残りの候補は
      // 接続確立のあとに流れる。待つと最初の音が出るまでが目に見えて遅くなる。
      let answer: string;
      try {
        const response = await fetch(realtimeEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Turnstile-Token": turnstileToken,
          },
          body: JSON.stringify({ sdp: offer.sdp ?? "" }),
        });
        if (!response.ok) {
          teardown();
          // 403 は Turnstile が通らなかったとき。訪問者に落ち度が無い場合
          // （拡張機能によるブロックなど）もあるので、他の失敗と分けて出す。
          setError(response.status === 403 ? "rejected" : "unavailable");
          setState("error");
          return;
        }
        // 中継関数は上流の応答から answer だけを抜いて、生の SDP を返す。
        // `{transport:{sdp}}` のまま渡さないのは、上流の応答の形をブラウザ側の
        // コードに漏らさないため — 変わったときに直す場所が2つになる。
        answer = await response.text();
      } catch {
        teardown();
        setError("unavailable");
        setState("error");
        return;
      }

      try {
        await pc.setRemoteDescription({ type: "answer", sdp: answer });
      } catch {
        teardown();
        setError("unavailable");
        setState("error");
      }
    },
    [teardown],
  );

  return { state, error, start, stop, audioRef };
};

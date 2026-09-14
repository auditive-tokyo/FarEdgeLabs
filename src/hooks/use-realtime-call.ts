/**
 * ヒーローの man と音声で会話する。WebRTC の1本を張るところまでを持つ。
 *
 * 流れは1往復で完結する。**STUN も TURN も signaling サーバも要らない。**
 *
 *   マイク取得 → RTCPeerConnection → offer を作る
 *     → SDP を中継関数へ POST（`application/sdp`）
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
  | "connection-lost";

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

export const useRealtimeCall = (): UseRealtimeCall => {
  const [state, setState] = useState<RealtimeCallState>("idle");
  const [error, setError] = useState<RealtimeCallError | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micRef = useRef<MediaStream | null>(null);

  /**
   * 後始末。**マイクのトラックを止め忘れると、通話が終わってもブラウザの録音表示が
   * 消えない。** `RTCPeerConnection.close()` はトラックを止めないので、両方要る。
   * 見た目に出るぶん、これは静かに壊れない類の不具合。
   */
  const teardown = useCallback(() => {
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

      // イベント用のデータチャネル。**いまは何も読まないが、offer に含めておく。**
      // 後から足すには再ネゴシエーションが要るので、作るなら最初。文字起こしや
      // function calling を使うときの受け口になる。
      pc.createDataChannel("oai-events");

      pc.onconnectionstatechange = () => {
        if (pc !== pcRef.current) return;
        if (pc.connectionState === "connected") setState("live");
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
            "Content-Type": "application/sdp",
            "X-Turnstile-Token": turnstileToken,
          },
          body: offer.sdp ?? "",
        });
        if (!response.ok) {
          teardown();
          // 403 は Turnstile が通らなかったとき。訪問者に落ち度が無い場合
          // （拡張機能によるブロックなど）もあるので、他の失敗と分けて出す。
          setError(response.status === 403 ? "rejected" : "unavailable");
          setState("error");
          return;
        }
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

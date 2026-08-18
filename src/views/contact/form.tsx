"use client";

import { useEffect, useRef, useState } from "react";

import { Inview } from "@/components/animation/springs/in-view";
import { useIntroRevealed } from "@/components/common/intro";
import type { HomeContent } from "@/data/mocks/home";
import { useTurnstile } from "@/hooks/use-turnstile";
import {
  CONTACT_LIMITS,
  isEmailShaped,
  isRequiredField,
  submitContactForm,
  type ContactField,
} from "@/lib/contact";
import type { Locale } from "@/locales";

import { LIFT_IN, LIFT_OUT, REVEAL_DELAY, REVEAL_SPRING } from "../home/reveal";

export interface ContactFormProps {
  copy: HomeContent["contact"];
  locale: Locale;
}

/** 送信の状態。`sent` から戻る道は無い — 成功したらフォームごと差し替える。 */
type Phase = "editing" | "sending" | "sent" | "failed";

const EMPTY: Record<ContactField, string> = {
  company: "",
  name: "",
  email: "",
  message: "",
};

/**
 * フォーム本体 — クライアントリーフ。ビューは Server Component のまま（hard rule #6）。
 *
 * ここにしか無いものが3つある。このリポジトリで最初の `<form>`、最初の `<label>`、
 * そして最初の外部スクリプト（Turnstile、`useTurnstile` の中）。プリミティブが無いので
 * 装飾は既存トークンの組み合わせで、カードの地は他のパネルと同じ
 * `rounded-card bg-surface/75`。
 *
 * > [!important] 二重送信を止めるのはここ
 * > バックエンドの IP レートリミットは検討して落とした（`contact.tf` と
 * > `.kiro/steering/` の記録）。その判断の前提が
 * > 「二重送信はフォームの disabled で止める」だったので、
 * > **`phase === "sending"` の間ボタンを無効にするのは飾りではない**。
 *
 * 検証はバックエンドと重複しているが冗長ではない。往復せずに答えられるものは
 * ブラウザで答える。上限の数字は `CONTACT_LIMITS` にあり、そちらが `main.py` と
 * 同じ値であることを担保している。
 */
export const ContactForm = ({ copy, locale }: ContactFormProps) => {
  const isRevealed = useIntroRevealed();
  const [values, setValues] = useState<Record<ContactField, string>>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<ContactField, boolean>>>(
    {},
  );
  const [phase, setPhase] = useState<Phase>("editing");
  const { containerRef, token, status, reset } = useTurnstile({
    language: locale,
  });

  // 送信中にページを離れたら投げっぱなしにしない。`hero-stats.tsx` と同じ形。
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const errorFor = (field: ContactField): string | null => {
    const value = values[field].trim();
    // 空の任意項目は正常。ここで `required` を返すと、埋める義務があるように見える。
    if (!value) return isRequiredField(field) ? copy.errors.required : null;
    if (value.length > CONTACT_LIMITS[field]) return copy.errors.tooLong;
    if (field === "email" && !isEmailShaped(value)) return copy.errors.email;
    return null;
  };

  const fieldErrors: Record<ContactField, string | null> = {
    company: errorFor("company"),
    name: errorFor("name"),
    email: errorFor("email"),
    message: errorFor("message"),
  };
  const hasFieldError = Object.values(fieldErrors).some(Boolean);

  // トークンが無いうちは押させない。出させてから 403 で返すほうが不親切。
  const canSubmit =
    phase !== "sending" && !hasFieldError && status === "solved" && token !== "";

  // `React.FormEvent` ではなく `SyntheticEvent`。@types/react 19 が FormEvent を
  // 「そんなイベントは存在しない」として deprecated にしていて、submit に対する
  // 正しい相手は SyntheticEvent（あるいは SubmitEvent）。ここで使うのは
  // `preventDefault` だけ。
  const onSubmit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    // 静的エクスポートに受け皿は無い。ここで止めなければブラウザが GET で
    // 自分のページに投げ直し、入力が URL に載って履歴に残る。
    event.preventDefault();

    // 何も触らずに押された場合にエラーを出すため、必須項目を touched にする。
    // `company` は入れない — 空で正常なので、触られてもいないのに印を付ける意味が無い。
    setTouched({ name: true, email: true, message: true });
    if (!canSubmit) return;

    setPhase("sending");
    abortRef.current = new AbortController();

    const result = await submitContactForm(
      {
        company: values.company.trim(),
        name: values.name.trim(),
        email: values.email.trim(),
        message: values.message.trim(),
        turnstileToken: token,
      },
      abortRef.current.signal,
    );

    if (result.ok) {
      setPhase("sent");
      return;
    }

    setPhase("failed");
    // 失敗してもトークンは消費済み。取り直さないと、次の送信が
    // `timeout-or-duplicate` で必ず失敗する。
    reset();
  };

  if (phase === "sent") {
    return (
      <Card enabled={isRevealed}>
        <h2 className="text-lead leading-[1.2]">{copy.success.heading}</h2>
        <p className="text-body leading-[1.4]">{copy.success.body}</p>
      </Card>
    );
  }

  return (
    <Card enabled={isRevealed}>
      <p className="text-lead leading-[1.2]">{copy.lead}</p>
      <p className="text-body leading-[1.4]">{copy.body}</p>

      {/* `noValidate`: ブラウザ内蔵のバリデーションを切って、ロケールファイルの文言に
          揃える。切らないと日本語ページに `Please fill out this field.` が混ざる。 */}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {/* 会社名が名前の**上**にあるのは、日本の法人向けフォームの並び（会社名 → 部署
            → お名前）で、名刺と同じ順だから。既定ロケールが日本語で相手が法人なので、
            そちらに合わせている。
            「必須を先、任意を後」という逆の作法もあるが、法人からの問い合わせなら
            実際に空になる人は少ない。 */}
        <Field
          field="company"
          label={copy.fields.company.label}
          optionalLabel={copy.optional}
          placeholder={copy.fields.company.placeholder}
          value={values.company}
          error={touched.company ? fieldErrors.company : null}
          autoComplete="organization"
          onChange={(value) => setValues((v) => ({ ...v, company: value }))}
          onBlur={() => setTouched((t) => ({ ...t, company: true }))}
        />
        <Field
          field="name"
          label={copy.fields.name.label}
          placeholder={copy.fields.name.placeholder}
          value={values.name}
          error={touched.name ? fieldErrors.name : null}
          autoComplete="name"
          onChange={(value) => setValues((v) => ({ ...v, name: value }))}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
        />
        <Field
          field="email"
          label={copy.fields.email.label}
          placeholder={copy.fields.email.placeholder}
          value={values.email}
          error={touched.email ? fieldErrors.email : null}
          autoComplete="email"
          inputMode="email"
          onChange={(value) => setValues((v) => ({ ...v, email: value }))}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
        />
        <Field
          field="message"
          label={copy.fields.message.label}
          placeholder={copy.fields.message.placeholder}
          value={values.message}
          error={touched.message ? fieldErrors.message : null}
          multiline
          onChange={(value) => setValues((v) => ({ ...v, message: value }))}
          onBlur={() => setTouched((t) => ({ ...t, message: true }))}
        />

        {/* Turnstile が描く先。空のままなのが正常な瞬間があるので高さは持たせない
            — 予約した高さは、読み込めなかったときに理由のない余白として残る。 */}
        <div ref={containerRef} />

        {status === "unsupported" ? (
          <p role="alert" className="text-caption leading-[1.4] text-accent">
            {copy.errors.turnstile}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          /* `disabled:` の見た目を薄くするだけに留める。押せない理由は上の
             エラー文言と Turnstile のウィジェット自身が説明している。 */
          className="flex h-[3.125rem] items-center justify-center rounded-full border border-hairline bg-accent text-body leading-[1.2] text-on-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
        >
          {phase === "sending" ? copy.submit.sending : copy.submit.idle}
        </button>

        {/* `role="alert"` なので、差し替わった瞬間に読み上げられる。送信ボタンの
            あとに置いてあるのは、視覚順と読み上げ順を揃えるため。 */}
        {phase === "failed" ? (
          <p role="alert" className="text-caption leading-[1.4] text-accent">
            {copy.errors.failed}
          </p>
        ) : null}
      </form>
    </Card>
  );
};

/**
 * カードの地。ページの他のパネルと同じ `bg-surface/75` — 後ろに WebGL の場が
 * 走っているので、`/70` が下限（`hero-copy.tsx` の注記）。`backdrop-blur` は
 * 使わない。
 */
const Card = ({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) => (
  <Inview
    tag="div"
    // 幅と中央寄せはビュー側の折り返しが持っている。ここで重ねると `max-width` が
    // 二重にかかり、片方を変えても効かない箇所が生まれる。
    className="flex w-full flex-col gap-5 rounded-card bg-surface/75 p-8"
    from={LIFT_OUT}
    to={LIFT_IN}
    config={REVEAL_SPRING}
    delayIn={REVEAL_DELAY.contactForm}
    mode="once"
    enabled={enabled}
  >
    {children}
  </Inview>
);

interface FieldProps {
  field: ContactField;
  label: string;
  /** 渡されたときだけ「任意」の印が出る。必須項目には渡さない。 */
  optionalLabel?: string;
  placeholder: string;
  value: string;
  error: string | null;
  multiline?: boolean;
  autoComplete?: string;
  inputMode?: "email";
  onChange: (value: string) => void;
  onBlur: () => void;
}

/**
 * ラベル付きの1項目。このリポジトリに `<label>` の前例が無いので形はここで決める。
 *
 * `<label htmlFor>` と `id` を結ぶのではなく**入力要素を `<label>` で包んで**いる。
 * `useId()` を使わずに済み、包んだ時点で関連付けが構造で保証されるので、`id` の
 * 付け忘れという壊れ方が存在しなくなる。
 *
 * `aria-describedby` はエラーがあるときだけ張る。空の要素を常に指していると、
 * 読み上げが「説明あり」と言ってから何も読まない。
 */
const Field = ({
  field,
  label,
  optionalLabel,
  placeholder,
  value,
  error,
  multiline = false,
  autoComplete,
  inputMode,
  onChange,
  onBlur,
}: FieldProps) => {
  const errorId = `${field}-error`;
  const shared = {
    value,
    placeholder,
    autoComplete,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onChange(event.target.value),
    onBlur,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
    // `maxLength` は入力を止める。切って送るのではなく、そもそも入らないほうが
    // 「全部送れたつもり」にならない。上限は `main.py` と同じ値。
    maxLength: CONTACT_LIMITS[field],
    className:
      // `aria-[invalid=true]:` と書くのは、Tailwind の既定の `aria-*` バリアントに
      // `invalid` が無いから（checked / disabled / expanded などはある）。
      // `aria-invalid:` と書いても効かず、しかも静かに効かない。
      "w-full rounded-card border border-hairline bg-background px-3 py-2 text-body leading-[1.4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-[invalid=true]:border-accent",
  };

  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline gap-2 font-mulish text-caption leading-[1.2]">
        {label}
        {/* `<label>` の中なので、この印はラベルの読み上げに含まれる。`aria-label` を
            別に足したり `title` に隠したりしないのはそのため — 目で見える文字と
            読み上げられる文字を同じにしておく。
            `aria-hidden` にしていないのも同じ理由で、任意であることは装飾ではない。 */}
        {/* 括弧はロケールファイル側に持たせている。全角の（）と半角の () は言語ごとに
            変わるので、ここで足すと "Company（optional）" のような混ざり方をする。 */}
        {optionalLabel ? (
          <span className="text-foreground/60">{optionalLabel}</span>
        ) : null}
      </span>
      {multiline ? (
        <textarea {...shared} rows={6} />
      ) : (
        <input {...shared} type="text" inputMode={inputMode} />
      )}
      {error ? (
        <span id={errorId} className="text-caption leading-[1.4] text-accent">
          {error}
        </span>
      ) : null}
    </label>
  );
};

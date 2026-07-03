import React, { useState } from "react";
import { useT } from "../../../i18n";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

const Contact: React.FC = () => {
  const t = useT();
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch(`${BASE_URL}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });

      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      alert(t("contact.success"));
      setName("");
      setEmail("");
      setMessage("");
    } catch (error) {
      console.error("Error:", error);
      alert(t("contact.error"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-5 rounded-lg">
      {" "}
      {/* 背景色を削除 */}
      <h1 className="mb-4">{t("contact.title")}</h1>
      <p className="text-lg text-gray-300 mb-6">{t("contact.intro")}</p>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="mb-4">
          <label htmlFor="name" className="block mb-1 text-white">
            {t("contact.name")}
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isLoading}
            className="w-full p-2.5 bg-transparent border border-gray-600 focus:border-cyan-500 text-white rounded text-base outline-none transition-colors"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="email" className="block mb-1 text-white">
            {t("contact.email")}
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            className="w-full p-2.5 bg-transparent border border-gray-600 focus:border-cyan-500 text-white rounded text-base outline-none transition-colors"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="message" className="block mb-1 text-white">
            {t("contact.message")}
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            disabled={isLoading}
            className="w-full p-2.5 bg-transparent border border-gray-600 focus:border-cyan-500 text-white rounded text-base h-[150px] resize-y outline-none transition-colors"
          ></textarea>
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center justify-center min-w-[120px] mx-auto py-3 px-5 bg-cyan-600 text-white rounded-md text-base transition-colors hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? t("contact.sending") : t("contact.send")}
          {isLoading && (
            <span className="w-5 h-5 border-2 border-white border-t-2 border-t-transparent animate-spin ml-2"></span>
          )}
        </button>
      </form>
    </div>
  );
};

export default Contact;

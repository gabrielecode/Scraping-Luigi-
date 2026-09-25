import React, { useState } from "react";

export function useApiKeys() {
  const [openRouterApiKey, setOpenRouterApiKey] = useState(() => {
    if (typeof window !== "undefined") {
      const meta = import.meta as any;
      return (
        localStorage.getItem("scuola_openrouter_api_key") || 
        (meta && meta.env && meta.env.VITE_OPENROUTER_API_KEY) || 
        (meta && meta.env && meta.env.OPENROUTER_API_KEY) || 
        ""
      );
    }
    return "";
  });
  const [deepseekApiKey, setDeepseekApiKey] = useState(() => {
    if (typeof window !== "undefined") {
      const meta = import.meta as any;
      return (
        localStorage.getItem("scuola_deepseek_api_key") || 
        (meta && meta.env && meta.env.VITE_DEEPSEEK_API_KEY) || 
        (meta && meta.env && meta.env.DEEPSEEK_API_KEY) || 
        ""
      );
    }
    return "";
  });
  const [showDeepseekKey, setShowDeepseekKey] = useState(false);
  const [isTestingDeepseek, setIsTestingDeepseek] = useState(false);
  const [deepseekTestStatus, setDeepseekTestStatus] = useState<{ valid: boolean; message: string } | null>(null);
  const [jinaApiKey, setJinaApiKey] = useState(() => {
    if (typeof window !== "undefined") {
      const meta = import.meta as any;
      return (
        localStorage.getItem("scuola_jina_api_key") || 
        (meta && meta.env && meta.env.VITE_JINA_API_KEY) || 
        (meta && meta.env && meta.env.JINA_API_KEY) || 
        ""
      );
    }
    return "";
  });
  const [githubUser, setGithubUser] = useState(() => typeof window !== "undefined" ? localStorage.getItem("scuola_github_user") || "" : "");
  const [githubRepo, setGithubRepo] = useState(() => typeof window !== "undefined" ? localStorage.getItem("scuola_github_repo") || "" : "");
  const [githubPat, setGithubPat] = useState(() => typeof window !== "undefined" ? localStorage.getItem("scuola_github_pat") || "" : "");
  const [customProxyUrl, setCustomProxyUrl] = useState(() => typeof window !== "undefined" ? localStorage.getItem("scuola_custom_proxy") || "" : "");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestStatus, setKeyTestStatus] = useState<{ valid: boolean; message: string } | null>(null);

  const testOpenRouterKey = async () => {
    const cleanKey = openRouterApiKey.trim();
    if (!cleanKey) {
      setKeyTestStatus({ valid: false, message: "Inserisci prima una chiave API valida." });
      return;
    }
    setIsTestingKey(true);
    setKeyTestStatus(null);
    try {
      const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
        headers: {
          Authorization: `Bearer ${cleanKey}`,
        },
      });
      const data = await res.json();
      if (res.ok && data?.data) {
        const usage = data.data.usage !== undefined ? `$${Number(data.data.usage).toFixed(3)}` : "";
        const limit = data.data.limit !== undefined ? `$${Number(data.data.limit).toFixed(2)}` : "";
        let msg = "Chiave OpenRouter valida e attiva!";
        if (usage && limit) {
          msg = `Chiave valida! (Utilizzo: ${usage} / Limite: ${limit})`;
        } else if (usage) {
          msg = `Chiave valida! (Utilizzo: ${usage})`;
        }
        setKeyTestStatus({ valid: true, message: msg });
      } else {
        const err = data?.error?.message || (res.status === 401 ? "Chiave API non valida (401 Unauthorized)." : `Errore HTTP ${res.status}`);
        setKeyTestStatus({ valid: false, message: err });
      }
    } catch (e: any) {
      setKeyTestStatus({
        valid: false,
        message: `Impossibile verificare: ${e.message || "Errore di connessione"}`
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  const testDeepseekKey = async () => {
    const cleanKey = deepseekApiKey.trim();
    if (!cleanKey) {
      setDeepseekTestStatus({ valid: false, message: "Inserisci prima una chiave API DeepSeek valida." });
      return;
    }
    setIsTestingDeepseek(true);
    setDeepseekTestStatus(null);
    try {
      const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${cleanKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "user", content: "Ping" }],
          max_tokens: 5
        })
      });
      const data = await res.json();
      if (res.ok && !data?.error) {
        setDeepseekTestStatus({ valid: true, message: "Chiave DeepSeek valida e attiva!" });
      } else {
        const err = data?.error?.message || (res.status === 401 ? "Chiave DeepSeek non valida (401 Unauthorized)." : `Errore HTTP ${res.status}`);
        setDeepseekTestStatus({ valid: false, message: err });
      }
    } catch (e: any) {
      setDeepseekTestStatus({
        valid: false,
        message: `Impossibile verificare: ${e.message || "Errore di connessione"}`
      });
    } finally {
      setIsTestingDeepseek(false);
    }
  };

  const saveSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanKey = openRouterApiKey.trim();
    const cleanDeepseekKey = deepseekApiKey.trim();
    const cleanJinaKey = jinaApiKey.trim();
    localStorage.setItem("scuola_openrouter_api_key", cleanKey);
    localStorage.setItem("scuola_deepseek_api_key", cleanDeepseekKey);
    localStorage.setItem("scuola_jina_api_key", cleanJinaKey);
    localStorage.setItem("scuola_github_user", githubUser.trim());
    localStorage.setItem("scuola_github_repo", githubRepo.trim());
    localStorage.setItem("scuola_github_pat", githubPat.trim());
    localStorage.setItem("scuola_custom_proxy", customProxyUrl.trim());
    setSettingsSavedMessage("Impostazioni salvate con successo in LocalStorage!");

    setTimeout(() => {
      setSettingsSavedMessage("");
      setIsSettingsOpen(false);
    }, 1200);
  };

  return {
    openRouterApiKey,
    setOpenRouterApiKey,
    deepseekApiKey,
    setDeepseekApiKey,
    showDeepseekKey,
    setShowDeepseekKey,
    isTestingDeepseek,
    deepseekTestStatus,
    jinaApiKey,
    setJinaApiKey,
    githubUser,
    setGithubUser,
    githubRepo,
    setGithubRepo,
    githubPat,
    setGithubPat,
    customProxyUrl,
    setCustomProxyUrl,
    isSettingsOpen,
    setIsSettingsOpen,
    settingsSavedMessage,
    showApiKey,
    setShowApiKey,
    isTestingKey,
    keyTestStatus,
    testOpenRouterKey,
    testDeepseekKey,
    saveSettings
  };
}

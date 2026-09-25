import React, { useState } from "react";
import { BatchHistoryItem, ExtractionResult } from "../types";

export function useBatchHistory(setBatchResults: (results: ExtractionResult[]) => void, setActiveTab: (tab: any) => void) {
  const [batchHistory, setBatchHistory] = useState<BatchHistoryItem[]>(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("scuola_batch_history");
        return saved ? JSON.parse(saved) : [];
      }
      return [];
    } catch {
      return [];
    }
  });

  const saveBatchToHistory = (results: ExtractionResult[], filename: string) => {
    const newItem: BatchHistoryItem = {
      id: "batch_" + Date.now(),
      filename: filename || "batch_urls.csv",
      timestamp: new Date().toLocaleString("it-IT"),
      totalUrls: results.length,
      results
    };
    const updated = [newItem, ...batchHistory];
    setBatchHistory(updated);
    try {
      localStorage.setItem("scuola_batch_history", JSON.stringify(updated));
    } catch (e) {
      console.error("Impossibile salvare lo storico in localStorage", e);
    }
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = batchHistory.filter(item => item.id !== id);
    setBatchHistory(updated);
    localStorage.setItem("scuola_batch_history", JSON.stringify(updated));
  };

  const clearHistory = () => {
    if (window.confirm("Sei sicuro di voler svuotare tutto lo storico delle estrazioni?")) {
      setBatchHistory([]);
      localStorage.removeItem("scuola_batch_history");
    }
  };

  const loadHistoryItem = (item: BatchHistoryItem) => {
    setBatchResults(item.results);
    setActiveTab("batch");
  };

  return {
    batchHistory,
    saveBatchToHistory,
    deleteHistoryItem,
    clearHistory,
    loadHistoryItem
  };
}

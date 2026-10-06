"use client";

import { useState } from "react";
import styles from "./dashboard.module.css";

type Props = { sessionId: string };

export default function CopySessionLink({ sessionId }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = new URL(`/coleta/${sessionId}`, window.location.origin).toString();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button className={styles.copyPending} type="button" onClick={() => void copyLink()}>
      {copied ? "✓ Copiado" : "Copiar link"}
    </button>
  );
}

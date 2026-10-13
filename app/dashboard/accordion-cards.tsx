"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import styles from "./dashboard.module.css";

type AccordionContextValue = {
  openId: string | null;
  setOpenId: (id: string) => void;
};

const AccordionContext = createContext<AccordionContextValue | null>(null);

export function AccordionCards({
  initialOpenId,
  children,
}: {
  initialOpenId: string;
  children: ReactNode;
}) {
  const [openId, setOpenId] = useState<string | null>(initialOpenId);

  return (
    <AccordionContext.Provider value={{ openId, setOpenId }}>
      <div className={styles.collectionGrid}>{children}</div>
    </AccordionContext.Provider>
  );
}

export function AccordionCard({
  id,
  protocolId,
  statusLabel,
  statusClassName,
  children,
}: {
  id: string;
  protocolId: string;
  statusLabel: string;
  statusClassName: string;
  children: ReactNode;
}) {
  const accordion = useContext(AccordionContext);

  if (!accordion) {
    throw new Error("AccordionCard deve estar dentro de AccordionCards.");
  }

  const isOpen = accordion.openId === id;

  return (
    <article className={`${styles.collectionCard} ${isOpen ? styles.collectionCardOpen : ""}`}>
      <button
        type="button"
        className={styles.cardHeaderButton}
        aria-expanded={isOpen}
        onClick={() => accordion.setOpenId(id)}
      >
        <span className={styles.cardHeaderTitle}>
          <span className={styles.cardEyebrow}>PROTOCOLO</span>
          <span className={styles.cardProtocol}>{protocolId}</span>
        </span>
        <span className={styles.cardHeaderMeta}>
          <span className={`${styles.status} ${statusClassName}`}>{statusLabel}</span>
          <span className={`${styles.cardChevron} ${isOpen ? styles.cardChevronOpen : ""}`} aria-hidden="true">
            ⌄
          </span>
        </span>
      </button>
      {isOpen ? <div className={styles.cardBody}>{children}</div> : null}
    </article>
  );
}

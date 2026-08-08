"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { openAuthModal } from "@/components/auth/auth-modal-store";
import Link from "next/link";
import styles from "./LandingHeader.module.css";

interface LandingHeaderProps {
  onToggleMenu: () => void;
  isMenuOpen: boolean;
  onOpenMap: () => void;
  isMapOpen?: boolean;
}

export default function LandingHeader({
  onToggleMenu,
  isMenuOpen,
  onOpenMap,
  isMapOpen = false,
}: LandingHeaderProps) {
  const { user } = useAuth();
  const businessUser = user?.user_metadata?.customer_type === "business";
  const [hidden, setHidden] = useState(false);
  const avatarUrl: string | null = user?.user_metadata?.avatar_url || null;
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      if (window.innerWidth < 1000) return;
      const y = window.scrollY;
      if (y > lastScrollY.current && y > 80) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`${styles.navBar} ${(hidden && !isMenuOpen) || isMapOpen ? styles.navHidden : ""}`}>
      <Link href="/" className={styles.navLogo}>
        <img src="/Основной (упрощенный).svg" alt="10coffee" className={styles.navLogoImg} />
      </Link>

      <div className={styles.navCenter}>
        <button type="button" className={styles.navLink} onClick={onOpenMap}>
          Где попробовать
        </button>
      </div>

      <div className={styles.navActions}>
          {businessUser ? (
          <Link href="/dashboard" className={styles.navAvatar}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
            ) : (
              user.user_metadata?.full_name?.[0]?.toUpperCase() ||
              user.email?.[0]?.toUpperCase() ||
              "U"
            )}
          </Link>
        ) : (
          <button
            type="button"
            className={styles.navPillBtn}
            onClick={() => openAuthModal("login")}
          >
            Вход для оптовых покупателей
          </button>
        )}

        <button
          type="button"
          className={`${styles.burger} ${isMenuOpen ? styles.burgerOpen : ""}`}
          onClick={onToggleMenu}
          aria-label={isMenuOpen ? "Закрыть меню" : "Открыть меню"}
        >
          <span className={styles.burgerLine} />
          <span className={styles.burgerLine} />
          <span className={styles.burgerLine} />
        </button>
      </div>
    </nav>
  );
}

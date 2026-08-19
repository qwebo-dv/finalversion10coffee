"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { openAuthModal } from "@/components/auth/auth-modal-store";
import Link from "next/link";
import BurgerMenu from "./BurgerMenu";
import MapModal from "./MapModal";
import styles from "./LandingHeader.module.css";

const NAV_LINKS = [
  { label: "Интернет-магазин", href: "https://shop.10coffee.ru", external: true },
  { label: "О нас", href: "/o-nas" },
  { label: "Блог", href: "/blog" },
  { label: "Обучение", href: "/obuchenie" },
  { label: "Сервис", href: "/b2b-servis" },
  { label: "Контакты", href: "/kontakty" },
];

export default function SiteHeader() {
  const { user } = useAuth();
  const businessUser = user?.user_metadata?.customer_type === "business";
  const avatarUrl: string | null = user?.user_metadata?.avatar_url || null;
  const accountLabel = user?.user_metadata?.full_name?.trim() || user?.email || "Личный кабинет";
  const [hidden, setHidden] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      if (window.innerWidth < 1000) return;
      const y = window.scrollY;
      if (y > lastScrollY.current && y > 80) setHidden(true);
      else setHidden(false);
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <nav className={`${styles.navBar} ${(hidden && !isMenuOpen) || isMapOpen ? styles.navHidden : ""}`}>
        <Link href="/" className={styles.navLogo}>
          <img src="/Основной (упрощенный).svg" alt="10coffee" className={styles.navLogoImg} />
        </Link>

        <div className={styles.navCenter}>
          {NAV_LINKS.map((link) => link.external ? (
            <a key={link.href} href={link.href} className={styles.navLink}>
              {link.label}
            </a>
          ) : (
            <Link key={link.href} href={link.href} className={styles.navLink}>
              {link.label}
            </Link>
          ))}
          <button type="button" className={styles.navLink} onClick={() => setIsMapOpen(true)}>
            Где попробовать
          </button>
        </div>

        <div className={styles.navActions}>
          {businessUser ? (
            <Link href="/dashboard" className={styles.navAccount} aria-label={`Открыть личный кабинет: ${accountLabel}`}>
              <span className={styles.navAccountName}>{accountLabel}</span>
              <span className={styles.navAvatar}>{avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
                />
              ) : (
                user.user_metadata?.full_name?.[0]?.toUpperCase() ||
                user.email?.[0]?.toUpperCase() ||
                "U"
              )}</span>
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
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={isMenuOpen ? "Закрыть меню" : "Открыть меню"}
          >
            <span className={styles.burgerLine} />
            <span className={styles.burgerLine} />
            <span className={styles.burgerLine} />
          </button>
        </div>
      </nav>

      <BurgerMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} onOpenMap={() => setIsMapOpen(true)} pageRef={{ current: null }} />
      <MapModal isOpen={isMapOpen} onClose={() => setIsMapOpen(false)} />
    </>
  );
}

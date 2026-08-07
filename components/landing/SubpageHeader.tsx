"use client";

import { useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { openAuthModal } from "@/components/auth/auth-modal-store";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BurgerMenu from "./BurgerMenu";
import styles from "./SubpageHeader.module.css";

const NAV_LINKS = [
  { label: "О нас", href: "/o-nas" },
  { label: "Блог", href: "/blog" },
  { label: "Обучение", href: "/obuchenie" },
  { label: "Сервис", href: "/b2b-servis" },
  { label: "Контакты", href: "/kontakty" },
];

export default function SubpageHeader() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const avatarUrl: string | null = user?.user_metadata?.avatar_url || null;

  return (
    <>
      <nav className={styles.nav}>
        <Link href="/" className={styles.logo}>
          <img src="/Основной (упрощенный).svg" alt="10coffee" className={styles.logoImg} />
        </Link>

        <div className={styles.links}>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.link} ${pathname.startsWith(link.href) ? styles.linkActive : ""}`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className={styles.actions}>
          {user ? (
            <Link href="/dashboard" className={styles.avatar}>
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
              className={styles.pillBtn}
              onClick={() => openAuthModal("login")}
            >
              Личный кабинет
            </button>
          )}

          <button
            type="button"
            className={`${styles.burger} ${menuOpen ? styles.burgerOpen : ""}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
          >
            <span className={styles.burgerLine} />
            <span className={styles.burgerLine} />
            <span className={styles.burgerLine} />
          </button>
        </div>
      </nav>

      <BurgerMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} pageRef={{ current: null }} />
    </>
  );
}

"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { openAuthModal } from "@/components/auth/auth-modal-store";
import { useLenis } from "lenis/react";
import gsap from "gsap";
import { FaTelegram, FaInstagram, FaVk } from "react-icons/fa";
import styles from "./BurgerMenu.module.css";

const MENU_IMAGES = [
  "/Ассортимент/Мокап Гондурас.png",
  "/Ассортимент/Мокап Колумбия 036.png",
  "/Ассортимент/Мокап Колумбия Декаф.png",
  "/media/Мокап б.п Бленд1-600x400.png",
  "/media/Мокап б.п Браз-600x400.png",
  "/media/Мокап б.п Колумбия-600x400.png",
];

const NAV_LINKS = [
  { label: "Интернет-магазин", href: "https://shop.10coffee.ru", external: true },
  { label: "О нас", href: "/o-nas" },
  { label: "Блог", href: "/blog" },
  { label: "Обучение", href: "/obuchenie" },
  { label: "Сервис", href: "/b2b-servis" },
  { label: "Контакты", href: "/kontakty" },
  { label: "Где попробовать", href: "#map", isMap: true },
  { label: "Вход для опта", href: "/?auth=login", isAuth: true },
];

const SOCIAL_LINKS = [
  { label: "VK", href: "https://vk.com/10coffee", icon: FaVk },
];

interface BurgerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMap?: () => void;
  pageRef: React.RefObject<HTMLDivElement | null>;
}

export default function BurgerMenu({ isOpen, onClose, onOpenMap, pageRef }: BurgerMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const lenis = useLenis();
  const [activeImg, setActiveImg] = useState(0);

  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isAnimatingRef = useRef(false);
  const wasOpenRef = useRef(false);

  const lockScroll = useCallback(() => {
    if (lenis) lenis.stop();
    document.body.style.overflow = "hidden";
  }, [lenis]);

  const unlockScroll = useCallback(() => {
    document.body.style.overflow = "";
    if (lenis) lenis.start();
  }, [lenis]);

  // Open / close animation
  useEffect(() => {
    if (isAnimatingRef.current) return;

    if (isOpen && !wasOpenRef.current) {
      // OPEN
      isAnimatingRef.current = true;
      const page = pageRef?.current;
      const scrollY = window.scrollY;

      lockScroll();

      if (page) {
        gsap.set(page, { transformOrigin: `right ${scrollY}px` });
        gsap.to(page, {
          rotation: 10,
          x: 300,
          y: 450,
          scale: 1.5,
          duration: 1.25,
          ease: "power4.inOut",
        });
      }

      // Reset menu text
      if (overlayRef.current) {
        const linkAnchors = overlayRef.current.querySelectorAll(`.${styles.menuLink} a, .${styles.menuSocial} a`);
        const footerSpans = overlayRef.current.querySelectorAll(`.${styles.menuFooter} p span`);
        gsap.set(linkAnchors, { y: "140%", opacity: 0.25 });
        gsap.set(footerSpans, { y: "120%", opacity: 0.25 });
      }

      gsap.to(contentRef.current, {
        rotation: 0,
        x: 0,
        y: 0,
        scale: 1,
        opacity: 1,
        duration: 1.25,
        ease: "power4.inOut",
      });

      if (overlayRef.current) {
        const allText = overlayRef.current.querySelectorAll(
          `.${styles.menuLink} a, .${styles.menuSocial} a, .${styles.menuFooter} p span`
        );
        gsap.to(allText, {
          y: "0%",
          opacity: 1,
          delay: 0.75,
          duration: 1,
          ease: "power3.out",
          stagger: 0.1,
        });
      }

      gsap.to(overlayRef.current, {
        clipPath: "polygon(0% 0%, 100% 0%, 100% 175%, 0% 100%)",
        duration: 1.25,
        ease: "power4.inOut",
        onComplete: () => {
          isAnimatingRef.current = false;
          wasOpenRef.current = true;
        },
      });
    } else if (!isOpen && wasOpenRef.current) {
      // CLOSE
      isAnimatingRef.current = true;
      const page = pageRef?.current;

      if (page) {
        gsap.to(page, {
          rotation: 0,
          x: 0,
          y: 0,
          scale: 1,
          duration: 1.25,
          ease: "power4.inOut",
          onComplete: () => {
            gsap.set(page, { clearProps: "all" });
            gsap.set(page, { transformOrigin: "" });
          },
        });
      }

      gsap.to(contentRef.current, {
        rotation: -15,
        x: -100,
        y: -100,
        scale: 1.5,
        opacity: 0.25,
        duration: 1.25,
        ease: "power4.inOut",
      });

      gsap.to(overlayRef.current, {
        clipPath: "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)",
        duration: 1.25,
        ease: "power4.inOut",
        onComplete: () => {
          isAnimatingRef.current = false;
          wasOpenRef.current = false;
          unlockScroll();
        },
      });
    }
  }, [isOpen, pageRef, lockScroll, unlockScroll]);

  // Force close on route change
  useEffect(() => {
    if (wasOpenRef.current) {
      const page = pageRef?.current;
      if (page) {
        gsap.set(page, { clearProps: "all" });
        gsap.set(page, { transformOrigin: "" });
      }
      gsap.set(overlayRef.current, {
        clipPath: "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)",
      });
      gsap.set(contentRef.current, {
        rotation: -15, x: -100, y: -100, scale: 1.5, opacity: 0.25,
      });
      wasOpenRef.current = false;
      isAnimatingRef.current = false;
      unlockScroll();
      onClose();
    }
  }, [pathname]);

  const handleLinkClick = (href: string, external?: boolean, isMap?: boolean) => {
    if (isMap) {
      onClose();
      setTimeout(() => onOpenMap?.(), 800);
      return;
    }
    if (external) {
      window.location.assign(href);
      return;
    }
    if (href.startsWith("#")) {
      onClose();
      setTimeout(() => {
        const el = document.getElementById(href.slice(1));
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 800);
      return;
    }
    onClose();
    setTimeout(() => router.push(href), 800);
  };

  return (
    <div className={styles.menuOverlay} ref={overlayRef}>
      <div className={styles.menuContent} ref={contentRef}>
        <div className={styles.menuItems}>
          <div className={styles.colLg}>
            <div className={styles.previewImg}>
              {MENU_IMAGES.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  style={{
                    opacity: activeImg === i ? 1 : 0,
                    transition: "opacity 0.5s ease",
                  }}
                />
              ))}
            </div>
          </div>

          <div className={styles.colSm}>
            <div className={styles.menuLinks}>
              {NAV_LINKS.map((link, i) => (
                <div className={styles.menuLink} key={link.label}>
                  <a
                    href={link.href}
                    onMouseEnter={() => setActiveImg(i)}
                    onClick={(e) => {
                      e.preventDefault();
                      if ("isAuth" in link && link.isAuth) {
                        onClose();
                        setTimeout(() => openAuthModal("login"), 800);
                        return;
                      }
                      handleLinkClick(link.href, "external" in link && link.external, "isMap" in link && link.isMap);
                    }}
                  >
                    {link.label}
                  </a>
                </div>
              ))}
            </div>

            <div className={styles.menuSocials}>
              {SOCIAL_LINKS.map((social) => (
                <div className={styles.menuSocial} key={social.label}>
                  <a href={social.href} target="_blank" rel="noopener noreferrer">
                    {social.label}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.menuFooter}>
          <p className="sm">
            <span>Кофе для бизнеса</span>
          </p>
          <p className="sm">
            <span>10coffee.ru</span>
          </p>
        </div>
      </div>
    </div>
  );
}

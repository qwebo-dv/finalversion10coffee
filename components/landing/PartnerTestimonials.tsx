"use client";

import { useRef, useEffect, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { HiOutlineArrowLeft, HiOutlineArrowRight } from "react-icons/hi";
import Copy from "./_shared/Copy";
import { TESTIMONIALS } from "./data/testimonials-data";
import styles from "./PartnerTestimonials.module.css";

gsap.registerPlugin(ScrollTrigger);

const CARD_GAP = 20;
const LERP_FACTOR = 0.075;
const VELOCITY_DAMPING = 0.95;
const VELOCITY_THRESHOLD = 0.05;

export default function PartnerTestimonials() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const slideByRef = useRef<((dir: number) => void) | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const navButtons = section.querySelectorAll(`.${styles.navBtnWrap}`);
    const cards = section.querySelectorAll(`.${styles.card}`);

    gsap.set(navButtons, { scale: 0 });
    gsap.set(cards, { scale: 0.85, autoAlpha: 0 });

    const scrollTrigger = ScrollTrigger.create({
      trigger: section,
      start: "top 75%",
      once: true,
      onEnter: () => {
        gsap.to(navButtons, {
          scale: 1, duration: 0.6, ease: "back.out(1.7)", stagger: 0.1, delay: 0.4,
        });
        gsap.to(cards, {
          scale: 1, autoAlpha: 1, duration: 0.7, ease: "power3.out", stagger: 0.1, delay: 0.3,
        });
      },
    });

    return () => scrollTrigger.kill();
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const cards = Array.from(track.querySelectorAll(`.${styles.card}`)) as HTMLElement[];
    const cardCount = cards.length;
    if (!cardCount) return;

    const cardWidth = cards[0].offsetWidth;
    const itemWidth = cardWidth + CARD_GAP;
    const totalWidth = cardCount * itemWidth;

    gsap.set(cards, {
      position: "absolute",
      left: 0,
      top: 0,
      x: (index: number) => index * itemWidth,
    });

    gsap.set(track, { height: cards[0].offsetHeight });

    const wrapPosition = gsap.utils.wrap(-itemWidth, totalWidth - itemWidth);

    let targetX = 0;
    let currentX = 0;
    let isDragging = false;
    let dragStartPointerX = 0;
    let dragStartTargetX = 0;
    let velocityX = 0;
    let lastPointerX = 0;
    let lastPointerTime = 0;

    slideByRef.current = (direction: number) => {
      velocityX = 0;
      targetX += direction * itemWidth;
    };

    const updateCardPositions = () => {
      if (!isDragging) {
        targetX += velocityX;
        velocityX *= VELOCITY_DAMPING;
        if (Math.abs(velocityX) < VELOCITY_THRESHOLD) velocityX = 0;
      }
      currentX += (targetX - currentX) * LERP_FACTOR;
      cards.forEach((card, index) => {
        gsap.set(card, { x: wrapPosition(index * itemWidth + currentX) });
      });
    };

    gsap.ticker.add(updateCardPositions);

    const handlePointerDown = (e: PointerEvent) => {
      isDragging = true;
      dragStartPointerX = e.clientX;
      dragStartTargetX = targetX;
      velocityX = 0;
      lastPointerX = e.clientX;
      lastPointerTime = Date.now();
      track.setPointerCapture(e.pointerId);
      track.style.cursor = "grabbing";
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      targetX = dragStartTargetX + (e.clientX - dragStartPointerX);
      const now = Date.now();
      const timeDelta = now - lastPointerTime;
      if (timeDelta > 0) {
        velocityX = ((e.clientX - lastPointerX) / timeDelta) * 16;
        lastPointerX = e.clientX;
        lastPointerTime = now;
      }
    };

    const handlePointerUp = () => {
      isDragging = false;
      track.style.cursor = "grab";
    };

    let isDragEnabled = false;

    const enableDrag = () => {
      if (isDragEnabled) return;
      track.addEventListener("pointerdown", handlePointerDown);
      track.addEventListener("pointermove", handlePointerMove);
      track.addEventListener("pointerup", handlePointerUp);
      track.addEventListener("pointercancel", handlePointerUp);
      track.style.cursor = "grab";
      // Keep vertical page scrolling while allowing horizontal finger swipes.
      track.style.touchAction = "pan-y";
      isDragEnabled = true;
    };

    const disableDrag = () => {
      if (!isDragEnabled) return;
      track.removeEventListener("pointerdown", handlePointerDown);
      track.removeEventListener("pointermove", handlePointerMove);
      track.removeEventListener("pointerup", handlePointerUp);
      track.removeEventListener("pointercancel", handlePointerUp);
      track.style.cursor = "default";
      track.style.touchAction = "auto";
      isDragging = false;
      isDragEnabled = false;
    };

    enableDrag();

    return () => {
      gsap.ticker.remove(updateCardPositions);
      disableDrag();
    };
  }, []);

  const handlePrev = useCallback(() => slideByRef.current?.(1), []);
  const handleNext = useCallback(() => slideByRef.current?.(-1), []);

  return (
    <section className={styles.section} ref={sectionRef}>
      <div className={styles.header}>
        <Copy type="lines" animateOnScroll>
          <h3>Отзывы партнёров</h3>
        </Copy>
        <div className={styles.nav}>
          <div className={styles.navBtnWrap}>
            <button className={styles.navBtn} onClick={handlePrev} type="button">
              <HiOutlineArrowLeft />
            </button>
          </div>
          <div className={styles.navBtnWrap}>
            <button className={styles.navBtn} onClick={handleNext} type="button">
              <HiOutlineArrowRight />
            </button>
          </div>
        </div>
      </div>

      <div className={styles.carousel}>
        <div className={styles.track} ref={trackRef}>
          {TESTIMONIALS.map((t, index) => (
            <div className={styles.card} key={index}>
              <div className={styles.cardContent}>
                <span className={styles.quoteMark}>&ldquo;</span>
                <p>{t.text}</p>
              </div>
              <div className={styles.author}>
                <div className={`${styles.authorLogo} ${t.logo ? styles.authorLogoImage : ""}`}>
                  {t.logo ? (
                    <img src={t.logo} alt={t.company} />
                  ) : (
                    <span>{t.company}</span>
                  )}
                </div>
                <div className={styles.authorInfo}>
                  <span className={styles.authorName}>{t.company}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Copy from "./_shared/Copy";
import AnimatedButton from "./_shared/AnimatedButton";
import PriceListFormModal from "./PriceListFormModal";
import styles from "./ProductImages.module.css";

gsap.registerPlugin(ScrollTrigger);

const PRODUCTS = [
  { name: "Ассортимент 1", image: "/Ассортимент/1.webp", thumb: "/Ассортимент/1.webp" },
  { name: "Ассортимент 2", image: "/Ассортимент/2.webp", thumb: "/Ассортимент/2.webp" },
  { name: "Ассортимент 3", image: "/Ассортимент/3.webp", thumb: "/Ассортимент/3.webp" },
  { name: "Ассортимент 4", image: "/Ассортимент/4.webp", thumb: "/Ассортимент/4.webp" },
  { name: "Ассортимент 5", image: "/Ассортимент/5.webp", thumb: "/Ассортимент/5.webp" },
  { name: "Ассортимент 6", image: "/Ассортимент/6%20(1).webp", thumb: "/Ассортимент/6%20(1).webp" },
  { name: "Ассортимент 7", image: "/Ассортимент/7.webp", thumb: "/Ассортимент/7.webp" },
];

export default function ProductImages() {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const swipeStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showPriceModal, setShowPriceModal] = useState(false);

  const active = PRODUCTS[activeIndex];
  const isFirstSlide = activeIndex === 0;
  const isLastSlide = activeIndex === PRODUCTS.length - 1;

  const goToSlide = useCallback((newIndex: number) => {
    setActiveIndex((currentIndex) => {
      const nextIndex = Math.max(0, Math.min(PRODUCTS.length - 1, newIndex));
      return nextIndex === currentIndex ? currentIndex : nextIndex;
    });
  }, []);

  useEffect(() => {
    const img = imageRef.current;
    if (!img) return;

    gsap.killTweensOf(img);
    gsap.fromTo(
      img,
      { autoAlpha: 0, scale: 0.97 },
      { autoAlpha: 1, scale: 1, duration: 0.28, ease: "power2.out" }
    );
  }, [activeIndex]);

  useEffect(() => {
    PRODUCTS.forEach((product) => {
      const img = new Image();
      img.src = product.image;
    });
  }, []);

  const handlePrev = () => {
    if (isFirstSlide) return;
    goToSlide(activeIndex - 1);
  };

  const handleNext = () => {
    if (isLastSlide) return;
    goToSlide(activeIndex + 1);
  };

  const handleSliderPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) return;
    swipeStartRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleSliderPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || start.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    goToSlide(activeIndex + (deltaX < 0 ? 1 : -1));
  };

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const fadeElements = section.querySelectorAll(`.${styles.fadeIn}`);
    gsap.set(fadeElements, { autoAlpha: 0, y: 40 });

    const st = ScrollTrigger.create({
      trigger: section,
      start: "top 50%",
      once: true,
      onEnter: () => {
        gsap.to(fadeElements, {
          autoAlpha: 1,
          y: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.12,
        });
      },
    });

    return () => st.kill();
  }, []);

  return (
    <div className={styles.wrapper}>
      <section className={styles.section} ref={sectionRef}>
        <div className={styles.header}>
          <Copy type="words" animateOnScroll>
            <h3>Ассортимент</h3>
          </Copy>
        </div>

        <div className={`${styles.slider} ${styles.fadeIn}`}>
          <button
            className={`${styles.arrowBtn} ${isFirstSlide ? styles.arrowDisabled : ""}`}
            onClick={handlePrev}
            aria-label="Предыдущий"
            disabled={isFirstSlide}
            type="button"
          >
            <ArrowLeft className={styles.arrowIcon} />
          </button>

          <div
            className={styles.mainImage}
            onPointerDown={handleSliderPointerDown}
            onPointerUp={handleSliderPointerUp}
            onPointerCancel={() => { swipeStartRef.current = null; }}
          >
            <img
              key={active.image}
              ref={imageRef}
              src={active.image}
              alt={active.name}
              decoding="async"
            />
          </div>

          <button
            className={`${styles.arrowBtn} ${isLastSlide ? styles.arrowDisabled : ""}`}
            onClick={handleNext}
            aria-label="Следующий"
            disabled={isLastSlide}
            type="button"
          >
            <ArrowRight className={styles.arrowIcon} />
          </button>
        </div>

        <div className={`${styles.thumbnails} ${styles.fadeIn}`}>
          {PRODUCTS.map((product, i) => (
            <button
              key={i}
              className={`${styles.thumb} ${i === activeIndex ? styles.thumbActive : ""}`}
              onClick={() => {
                goToSlide(i);
              }}
              type="button"
            >
              <img src={product.thumb} alt={product.name} />
            </button>
          ))}
        </div>

        <div className={`${styles.bottomRow} ${styles.fadeIn}`}>
          <AnimatedButton href="#" onClick={(e) => { e.preventDefault(); setShowPriceModal(true); }}>
            Получить прайс-лист
          </AnimatedButton>
        </div>
      </section>

      <PriceListFormModal isOpen={showPriceModal} onClose={() => setShowPriceModal(false)} />
    </div>
  );
}

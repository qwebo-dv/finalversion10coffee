"use client";

import { useRef } from "react";
import Copy from "./_shared/Copy";
import AnimatedButton from "./_shared/AnimatedButton";
import styles from "./LetsConnect.module.css";

export default function LetsConnect() {
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section className={styles.section} ref={sectionRef} id="lets-connect">
      <div className={styles.container}>
        <div className={styles.content}>
          <Copy type="lines" animateOnScroll start="top 80%">
            <h6>Давайте знакомиться</h6>
          </Copy>

          <Copy type="lines" animateOnScroll start="top 80%">
            <h5>
              Мы всегда рады новым партнёрам. Расскажем о продукции, подберём
              оптимальное решение для вашего бизнеса.
            </h5>
          </Copy>

          <div className={styles.details}>
            <div>
              <Copy type="lines" animateOnScroll start="top 80%" delay={0.3}>
                <p className="mono">10coffee@mail.ru</p>
                <p className="mono">+7 (938) 453-70-60</p>
                <p className="mono">+7 (918) 401-70-60</p>
              </Copy>
            </div>
            <div>
              <Copy type="lines" animateOnScroll start="top 80%" delay={0.3}>
                <p className="mono">ПН--ПТ 09:00--18:00</p>
                <p className="mono">СБ--ВС Выходные</p>
              </Copy>
            </div>
          </div>

          <AnimatedButton href="mailto:10coffee@mail.ru">
            Написать нам
          </AnimatedButton>
        </div>
      </div>
    </section>
  );
}

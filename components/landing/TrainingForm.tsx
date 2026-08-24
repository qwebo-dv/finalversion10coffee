"use client";

import { useActionState } from "react";
import PhoneInput from "@/components/shared/phone-input";
import { submitTrainingRequest, type ContactFormState } from "@/lib/actions/contact-forms";

const initialState: ContactFormState = { success: false };

export default function TrainingForm({ className, inputClassName, buttonClassName, disclaimerClassName }: {
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
  disclaimerClassName?: string;
}) {
  const [state, formAction, isPending] = useActionState(submitTrainingRequest, initialState);

  if (state.success) {
    return (
      <div className={className}>
        <p style={{ color: "#5b328a", fontWeight: 600, fontSize: "1.1rem" }}>
          Заявка отправлена! Мы свяжемся с вами для записи на курс.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className={className}>
      <input type="text" name="name" placeholder="Имя" required className={inputClassName} />
      <PhoneInput name="phone" required className={inputClassName} />
      <input type="email" name="email" placeholder="Email для подтверждения" className={inputClassName} />
      {state.error && <p style={{ color: "#e6610d", fontSize: "0.9rem" }}>{state.error}</p>}
      <label className={disclaimerClassName} style={{ display: "flex", alignItems: "flex-start", gap: "0.65rem", cursor: "pointer" }}>
        <input name="consent" type="checkbox" required style={{ width: "1rem", height: "1rem", marginTop: "0.1rem", flexShrink: 0, accentColor: "#5b328a" }} />
        <span>Я принимаю <a href="/Политика конфиденциальности.pdf" target="_blank" rel="noopener noreferrer">политику конфиденциальности</a> и даю согласие на обработку персональных данных в соответствии с <a href="/Политика обработки персональных данных пользователей сайта.pdf" target="_blank" rel="noopener noreferrer">правилами обработки персональных данных</a>.</span>
      </label>
      <button type="submit" className={buttonClassName} disabled={isPending}>
        {isPending ? "Отправка..." : "Записаться на курс"}
      </button>
    </form>
  );
}

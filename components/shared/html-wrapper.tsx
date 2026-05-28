import localFont from "next/font/local"
import Script from "next/script"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import "@/app/globals.css"

const googleSans = localFont({
  src: [
    {
      path: "../../public/fonts/GoogleSans-Regular.ttf",
      weight: "100 400",
      style: "normal",
    },
    {
      path: "../../public/fonts/GoogleSans-Medium.ttf",
      weight: "500 900",
      style: "normal",
    },
  ],
  variable: "--font-google-sans",
  display: "swap",
})

export function HtmlWrapper({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className={`${googleSans.variable} font-[family-name:var(--font-google-sans)] antialiased`}>
        <noscript>
          <div>
            <img src="https://mc.yandex.ru/watch/62318476" style={{ position: "absolute", left: -9999 }} alt="" />
          </div>
        </noscript>
        <TooltipProvider>
          {children}
        </TooltipProvider>
        <Toaster position="top-right" richColors duration={2000} />
        <Script
          id="yandex-metrika"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(m,e,t,r,i,k,a){
                m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
                m[i].l=1*new Date();
                for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
                k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
              })(window, document,'script','https://mc.yandex.ru/metrika/tag.js','ym');
              ym(62318476, 'init', {clickmap:true, referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
            `,
          }}
        />
      </body>
    </html>
  )
}

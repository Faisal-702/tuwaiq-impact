import Image from "next/image";
import sceneLeft from "../../../public/images/entry-scene-left.webp";
import sceneRight from "../../../public/images/entry-scene-right.webp";

/**
 * Bright Saudi educational environment behind the entry card:
 * the school building (start side) and the Riyadh skyline (end side) from the
 * login reference, joined by a soft sky-to-floor gradient and slow,
 * translucent teal/purple ribbons. Purely decorative.
 */
export function EntryScene() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 select-none" dir="ltr">
      {/* Sky → reflective floor */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#eaf0fb_0%,#f4f7fc_38%,#f7f8fc_62%,#eef0f8_100%)]" />
      <div className="absolute inset-x-0 top-0 h-[55%] bg-[radial-gradient(60%_80%_at_50%_0%,rgba(255,255,255,0.95),transparent_70%)]" />

      {/* School building */}
      <div className="absolute inset-y-0 left-0 hidden w-[min(40vw,calc(100dvh*0.5823))] md:block">
        <Image
          src={sceneLeft}
          alt=""
          loading="eager"
          sizes="(min-width: 768px) 40vw, 0px"
          className="h-full w-full object-cover object-right [mask-image:linear-gradient(90deg,#000_0%,#000_68%,transparent_100%)]"
        />
      </div>

      {/* Riyadh skyline */}
      <div className="absolute inset-y-0 right-0 w-full md:w-[min(40vw,calc(100dvh*0.56))]">
        <Image
          src={sceneRight}
          alt=""
          preload
          sizes="(min-width: 768px) 40vw, 100vw"
          className="h-full w-full object-cover object-left opacity-55 [mask-image:linear-gradient(180deg,transparent_0%,#000_45%)] md:opacity-100 md:[mask-image:linear-gradient(270deg,#000_0%,#000_66%,transparent_100%)]"
        />
      </div>

      {/* Translucent ribbons joining both sides along the floor */}
      <svg
        className="absolute inset-x-0 bottom-0 h-[38%] w-full animate-drift-slow opacity-80"
        viewBox="0 0 1440 360"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="ribbon-a" x1="0" x2="1">
            <stop offset="0" stopColor="#14B8A6" stopOpacity="0.0" />
            <stop offset="0.3" stopColor="#14B8A6" stopOpacity="0.22" />
            <stop offset="0.7" stopColor="#6D4AFF" stopOpacity="0.18" />
            <stop offset="1" stopColor="#A78BFA" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="ribbon-b" x1="0" x2="1">
            <stop offset="0" stopColor="#A78BFA" stopOpacity="0.25" />
            <stop offset="0.5" stopColor="#6D4AFF" stopOpacity="0.12" />
            <stop offset="1" stopColor="#14B8A6" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d="M0 300 C 320 250, 520 330, 820 280 S 1260 170, 1440 200 L 1440 360 L 0 360 Z" fill="url(#ribbon-a)" />
        <path d="M0 330 C 380 280, 700 350, 1000 320 S 1320 270, 1440 290 L 1440 360 L 0 360 Z" fill="url(#ribbon-b)" />
        <path
          d="M0 300 C 320 250, 520 330, 820 280 S 1260 170, 1440 200"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.7"
          strokeWidth="1.2"
        />
      </svg>

      {/* Soft halo behind the card */}
      <div className="absolute left-1/2 top-[18%] h-[70%] w-[min(60rem,90vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.75),transparent)]" />
    </div>
  );
}

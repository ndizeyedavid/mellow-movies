import Button from '../ui/Button'
import heroBg from '../../assets/hero-bg.png'
import playIcon from '../../assets/icon-play.svg'

/**
 * Hero section from Figma (#90:206 + #90:146): full-bleed background
 * image (radius 12) with fade-out gradients top/bottom, centered
 * headline 58px Bold, 18px muted description and the primary CTA button.
 */
export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background */}
      <img
        src={heroBg}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Fade out top — blends the sticky navbar into the image */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-2/3 bg-gradient-to-b from-background via-background/40 to-transparent"
      />
      {/* Fade out bottom */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background via-background/30 to-transparent"
      />
      {/* Abstract accent */}
      <div
        aria-hidden="true"
        className="absolute right-[38%] top-1/4 hidden h-[300px] w-[300px] rounded-full bg-primary/10 blur-[120px] lg:block"
      />

      <div className="relative mx-auto flex w-full max-w-[1920px] flex-col items-center px-5 pb-20 pt-24 sm:px-8 md:pb-28 md:pt-32 lg:min-h-[860px] lg:pb-40 lg:pt-44 lg:px-[121px] 2xl:px-[162px]">
        <div className="flex max-w-[1100px] flex-col items-center gap-[50px] text-center">
          <div className="flex flex-col gap-3.5">
            <h1 className="text-4xl font-bold leading-snug text-white sm:text-5xl md:text-[58px]">
              The Best Streaming Experience
            </h1>
            <p className="mx-auto max-w-4xl text-base leading-snug text-muted lg:text-lg">
              Mellow Movies is the best streaming experience for watching your favorite movies and
              shows on demand, anytime, anywhere. Enjoy a wide variety of content — from the latest
              blockbusters to popular TV shows — and build your own watchlist in seconds.
            </p>
          </div>
          <Button
            size="lg"
            icon={<img src={playIcon} alt="" className="h-7 w-7" />}
          >
            Start Watching Now
          </Button>
        </div>
      </div>
    </section>
  )
}

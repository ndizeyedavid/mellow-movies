import { devices } from '../../data/mockData'
import SectionHeading from '../ui/SectionHeading'
import DeviceCard from '../ui/DeviceCard'

/**
 * Devices section from Figma (#184:1045): heading + two rows of
 * three device cards (30px gaps).
 */
export default function DevicesSection() {
  return (
    <section className="mx-auto w-full max-w-[1920px] px-5 sm:px-8 lg:px-[60px] xl:px-[121px] 2xl:px-[162px]">
      <div className="flex flex-col gap-20">
        <SectionHeading
          title="We Provide you streaming experience across various devices."
          subtitle="With Mellow Movies, you can enjoy your favorite movies and TV shows anytime, anywhere. Our platform is designed to be compatible with a wide range of devices, ensuring that you never miss a moment of entertainment."
        />

        <div className="flex flex-col gap-[30px]">
          <div className="grid gap-[30px] md:grid-cols-2 lg:grid-cols-3">
            {devices.slice(0, 3).map((device) => (
              <DeviceCard key={device.id} device={device} />
            ))}
          </div>
          <div className="grid gap-[30px] md:grid-cols-2 lg:grid-cols-3">
            {devices.slice(3).map((device) => (
              <DeviceCard key={device.id} device={device} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

import type { ReactNode } from 'react'
import { FaMobileScreenButton, FaTabletScreenButton, FaTv, FaLaptop, FaGamepad, FaVrCardboard, FaArrowRight } from 'react-icons/fa6'
import type { Device } from '../../data/mockData'

const deviceIcons: Record<string, ReactNode> = {
  phone: <FaMobileScreenButton className="h-10 w-10" />,
  tablet: <FaTabletScreenButton className="h-10 w-10" />,
  tv: <FaTv className="h-10 w-10" />,
  laptop: <FaLaptop className="h-10 w-10" />,
  console: <FaGamepad className="h-10 w-10" />,
  vr: <FaVrCardboard className="h-10 w-10" />,
}

/**
 * Device card from Figma (EL-e326b187): #1A1A1A fill, radius 12,
 * padding 50px, 40px icon inside a 16px-padded box, 24px title,
 * 18px muted description and a "More info" link row.
 */
export default function DeviceCard({ device }: { device: Device }) {
  return (
    <div className="group flex flex-col gap-[50px] rounded-xl border border-line bg-card p-6 transition-colors duration-300 hover:border-line2 sm:p-10 lg:p-[50px]">
      <div className="flex items-center gap-4">
        <div className="flex h-auto w-auto items-center justify-center rounded-xl border border-card2 bg-background p-4 text-white transition-colors duration-300 group-hover:text-primary">
          {deviceIcons[device.icon] ?? deviceIcons.phone}
        </div>
        <h3 className="text-xl font-semibold leading-snug text-white lg:text-2xl">
          {device.name}
        </h3>
      </div>
      <p className="text-base leading-relaxed text-muted lg:text-lg">{device.description}</p>
      <div className="mt-auto flex items-center gap-2 text-base font-semibold text-white transition-colors duration-200 hover:text-primary lg:text-lg">
        More info
        <FaArrowRight className="h-4 w-4" aria-hidden="true" />
      </div>
    </div>
  )
}

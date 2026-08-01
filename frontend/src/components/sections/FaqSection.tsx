import { faqs } from "../../data/mockData";
import SectionHeading from "../ui/SectionHeading";
import FaqItem from "../ui/FaqItem";
import Button from "../ui/Button";

/**
 * FAQ section from Figma (#90:808): heading + "View All Questions"
 * button on the right, two columns of bordered accordion items.
 */
export default function FaqSection() {
  return (
    <section className="mx-auto w-full max-w-[1920px] px-5 sm:px-8 lg:px-[60px] xl:px-[121px] 2xl:px-[162px]">
      <div className="flex flex-col gap-20">
        <SectionHeading
          title="Frequently Asked Questions"
          subtitle="Everything you need to know about Mellow Movies. Can't find the answer you're looking for? Feel free to contact our team."
          actions={
            <Button size="lg" className="hidden lg:inline-flex">
              View All Questions
            </Button>
          }
        />

        <div className="grid gap-x-20 gap-y-2 lg:grid-cols-2">
          {faqs.map((faq, i) => (
            <FaqItem key={faq.question} faq={faq} defaultOpen={i === 0} />
          ))}
        </div>

        <Button size="lg" className="lg:hidden">
          View All Questions
        </Button>
      </div>
    </section>
  );
}

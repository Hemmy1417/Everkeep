import Link from "next/link";

export default function NotFound() {
  return (
    <section className="band-dark">
      <div className="page py-24 md:py-40">
        <p className="t-label text-haze">Not found</p>
        <h1 className="t-display mt-6">Nothing is kept here.</h1>
        <Link href="/" className="t-label mt-10 inline-block rounded-[8px] bg-paper px-4 py-2.5 text-ink">Back to the start</Link>
      </div>
    </section>
  );
}

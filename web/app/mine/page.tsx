"use client";

import { Arrow, Band, Empty, Loading, Status, Tag } from "@/components/bits";
import { gen, maintenanceType, orderState } from "@/lib/present";
import { workOrdersOf } from "@/lib/read";
import { useChain } from "@/lib/useChain";
import { useWallet } from "@/lib/wallet";

export default function Mine() {
  const w = useWallet();
  const mine = useChain(w.address ? `mine.${w.address}` : null, (f) => workOrdersOf(w.address, 0, 50, f));
  return (
    <>
      <section className="band-dark">
        <div className="page py-16 md:py-24">
          <Tag dark>My work</Tag>
          <h1 className="t-display mt-6 max-w-[16ch]">Every order this wallet is part of.</h1>
        </div>
      </section>
      <Band>
        {!w.address ? <Empty>Connect a wallet to see the work orders you commissioned, carry out or inspect.</Empty> : null}
        {mine.loading ? <Loading what="your work orders" /> : null}
        {mine.data?.total === 0 ? <Empty>This wallet is not part of any work order yet.</Empty> : null}
        {mine.data?.work_orders.map((x) => (
          <div key={x.work_order_id} className="grid grid-cols-[1fr_auto] items-center gap-6 border-t border-lichen py-6">
            <div>
              <div className="flex flex-wrap gap-4">
                <Status>{orderState(x.state)}</Status>
                <span className="t-label self-center text-graphite">{maintenanceType(x.maintenance_type)} · {gen(x.payment_wei)}</span>
              </div>
              <p className="t-sub mt-3">{x.title}</p>
            </div>
            <Arrow href={`/work-orders/${x.work_order_id}`} label={`Open ${x.title}`} />
          </div>
        ))}
      </Band>
    </>
  );
}

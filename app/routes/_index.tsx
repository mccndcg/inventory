import type { MetaFunction } from "@remix-run/node";
import { FrontCard, ModalCard } from "~/components/modal_card";
import { GoodsOutForm } from "~/components/goods/goods_out";
import { Link } from "@remix-run/react";
import RegisterGoods from "~/components/register_goods/register_goods";




export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export default function Index() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="grid grid-cols-2 gap-4">
        <ModalCard title="Register Goods">
          <RegisterGoods />
        </ModalCard>
        <div className="size-32 rounded ">
        </div>
        <ModalCard title="Goods In">
          <GoodsOutForm isGoodIn />
        </ModalCard>
        <ModalCard title="Goods Out">
          <GoodsOutForm isGoodIn={false} />
        </ModalCard>
        {/* <ModalCard title="Inventory">
          <InventoryModalContent />
        </ModalCard> */}
        <Link to="/inventory">
          <FrontCard title="Inventory" />
        </Link>
        <Link to="/sales">
          <FrontCard title="Sales" />
        </Link>
      </div>
    </div >
  );
}


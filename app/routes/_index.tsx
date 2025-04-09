import type { MetaFunction } from "@remix-run/node";
import { FrontCard, ModalCard } from "~/components/modal_card";
import { GoodsOutForm } from "~/components/goods/goods_out";
import { Link } from "@remix-run/react";
import RegisterGoods from "~/components/register_goods/register_goods";
import { QuickReport } from "~/components/quick_report";
import { SquareArrowDownRight, SquareArrowOutUpRight } from "lucide-react";

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
        <ModalCard title="Register Goods" id="register_goods">
          <RegisterGoods />
        </ModalCard>
        <QuickReport />
        <ModalCard title="Goods In" icon={<SquareArrowDownRight />} id="goods_in">
          <GoodsOutForm isGoodIn={true} />
        </ModalCard>
        <ModalCard title="Goods Out" icon={<SquareArrowOutUpRight />} id="goods_out">
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
    </div>
  );
}

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ReactNode } from "react";
import { useMediaQuery } from "~/lib/mediaquery";
import { atom, useAtom } from "jotai";

export function FrontCard({
  title,
  icon,
}: {
  title: string;
  icon?: ReactNode;
}) {
  return (
    <div className="size-32 rounded bg-primary grid place-items-center text-primary-foreground">
      <div className="flex flex-col items-center">
        {title}
        {icon}
      </div>
    </div>
  );
}

interface Props {
  title: string;
  children: ReactNode;
  hide_trigger?: true;
  icon?: ReactNode;
  id: string;
}

export function ModalCard({ title, children, icon, id }: Props) {
  return (
    <ResponsiveDialog {...{ title, icon, id }}>{children}</ResponsiveDialog>
  );
}
export const dialogAtom = atom(false);
export const dialogIdAtom = atom("");

export function ResponsiveDialog({
  title,
  children,
  hide_trigger,
  icon,
  id,
}: Props) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [open, setOpen] = useAtom(dialogAtom);
  const [currId, setCurrId] = useAtom(dialogIdAtom);
  if (isDesktop) {
    return (
      <Dialog open={open && currId == id} onOpenChange={setOpen}>
        <DialogTrigger onClick={() => setCurrId(id)}>
          {!hide_trigger && <FrontCard {...{ title, icon }} />}
        </DialogTrigger>
        <DialogContent className="max-h-[calc(100dvh)] min-w-[80dvw]">
          <ScrollArea className="max-h-[calc(100dvh-3rem)]">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription></DialogDescription>
            </DialogHeader>
            {children}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Drawer open={open} onOpenChange={setOpen} repositionInputs={false}>
      <DrawerTrigger>
        {!hide_trigger && <FrontCard {...{ title, icon }} />}
      </DrawerTrigger>
      <DrawerContent className="p-1">
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription></DrawerDescription>
        </DrawerHeader>
        {children}
      </DrawerContent>
    </Drawer>
  );
}

import toast from "react-hot-toast"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "~/components/ui/dialog"
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dispatch, ReactNode, SetStateAction, useContext, useState } from "react"
import { useMediaQuery } from "~/lib/mediaquery"
import { MenuContext } from "~/lib/open_provider"
import OpenProvider from "~/lib/open_provider";


export function FrontCard({ title }: any) {
    return <div className="size-32 rounded bg-primary grid place-items-center text-primary-foreground">
        {title}
    </div>
}

interface Props {
    title: string,
    children: ReactNode
    hide_trigger?: true
}

export function ModalCard({ title, children, }: Props) {
    return <OpenProvider>
        <ResponsiveDialog title={title}>
            {children}
        </ResponsiveDialog>
    </OpenProvider>
}

export function ResponsiveDialog({ title, children, hide_trigger }: Props) {
    const isDesktop = useMediaQuery("(min-width: 768px)")
    const { open, setOpen } = useContext(MenuContext)
    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger>
                    {!hide_trigger && <FrontCard title={title} />}
                </DialogTrigger>
                <DialogContent className="max-h-[calc(100dvh)] min-w-[80dvw]">
                    <ScrollArea className="max-h-[calc(100dvh-3rem)]">
                        <DialogHeader>
                            <DialogTitle>{title}</DialogTitle>
                            <DialogDescription>
                            </DialogDescription>
                        </DialogHeader>
                        {children}
                    </ScrollArea>
                </DialogContent>
            </Dialog>)
    }
    return (
        <Drawer open={open} onOpenChange={setOpen} repositionInputs={false}>
            <DrawerTrigger>
                {!hide_trigger && <FrontCard title={title} />}
            </DrawerTrigger>
            <DrawerContent className="p-1">
                <DrawerHeader className="text-left">
                    <DrawerTitle>{title}</DrawerTitle>
                    <DrawerDescription>
                    </DrawerDescription>
                </DrawerHeader>
                {children}
            </DrawerContent>
        </Drawer>
    )
}
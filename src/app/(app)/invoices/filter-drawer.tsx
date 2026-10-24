"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
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

export function FilterDrawer() {
  const [open, setOpen] = React.useState(false)

  return (
    <Drawer open={open} onOpenChange={setOpen} swipeDirection="right">
      <DrawerTrigger
        render={
          <Button
            variant="outline"
            className="!border-[#ffff]/10 !bg-[#171717]/20 text-white shrink-0"
          >
            Filters
          </Button>
        }
      />
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Filters</DrawerTitle>
          <DrawerDescription>Filter invoices by date.</DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 p-4">
          {/* add filter controls here */}
        </div>
        <DrawerFooter>
          <Button onClick={() => setOpen(false)}>Apply</Button>
          <DrawerClose render={<Button variant="outline">Cancel</Button>} />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

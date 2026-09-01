"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";

export type NavSection = {
  label: string;
  items: { href: string; label: string; icon: React.ElementType }[];
};

/** La nav de la sidebar : groupes, item actif, identite visuelle Lumyx. */
export function SidebarNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  return (
    <>
      {sections.map((section) => (
        <SidebarGroup key={section.label} className="gap-1 py-0">
          <SidebarGroupLabel className="sl-label h-auto px-2 pb-1 text-11">
            {section.label}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      className={cn(
                        "h-auto gap-2.5 rounded-sm px-2 py-1.5 text-13 transition-colors duration-[120ms]",
                        active
                          ? "bg-accent-tint font-medium text-accent-text shadow-[inset_2px_0_0_var(--accent)] hover:bg-accent-tint hover:text-accent-text"
                          : "text-body hover:bg-hover hover:text-strong",
                      )}
                    >
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className="no-underline hover:no-underline"
                      >
                        <item.icon className="size-4 shrink-0 stroke-[1.75]" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

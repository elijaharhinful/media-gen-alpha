"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sparkles,
  ImageIcon,
  Film,
  Wand2,
  LayoutDashboard,
  LogOut,
  LogIn,
  Menu,
  X,
  Settings,
  BookImage,
  ListTodo,
  ChevronDown,
  User,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";

const toolNavItems = [
  {
    href: "/multiplier",
    label: "Multiplier",
    icon: Wand2,
    accent: "text-blue-400",
  },
  {
    href: "/image-generator",
    label: "Images",
    icon: ImageIcon,
    accent: "text-lime-400",
  },
  {
    href: "/video-generator",
    label: "Videos",
    icon: Film,
    accent: "text-purple-400",
  },
  {
    href: "/library",
    label: "Library",
    icon: BookImage,
    accent: "text-cyan-400",
  },
  { href: "/tasks", label: "Tasks", icon: ListTodo, accent: "text-amber-400" },
];

function ProfileAvatar({
  name,
  email,
}: {
  name?: string | null;
  email?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : email
      ? email[0].toUpperCase()
      : "U";

  // Consistent gradient based on initials
  const gradients = [
    "from-lime-400 to-emerald-500",
    "from-purple-400 to-violet-600",
    "from-blue-400 to-cyan-500",
    "from-amber-400 to-orange-500",
    "from-pink-400 to-rose-500",
  ];
  const gradientIdx = initials.charCodeAt(0) % gradients.length;

  return (
    <div className="relative" ref={ref}>
      <button
        id="profile-avatar-btn"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-xl p-1 hover:bg-white/5 transition-colors"
        aria-label="Profile menu"
      >
        <div
          className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradients[gradientIdx]} flex items-center justify-center text-xs font-bold text-white shadow-lg ring-2 ring-white/10`}
        >
          {initials}
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50"
          >
            {/* User info */}
            <div className="px-4 py-3 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradients[gradientIdx]} flex items-center justify-center text-sm font-bold text-white flex-shrink-0`}
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  {name && (
                    <p className="text-sm font-medium truncate">{name}</p>
                  )}
                  {email && (
                    <p className="text-xs text-muted-foreground truncate">
                      {email}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Menu items */}
            <div className="p-1.5">
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
              <button
                onClick={() => {
                  setOpen(false);
                  signOut({ callbackUrl: "/login" });
                }}
                className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-red-400 hover:bg-red-400/5 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const { data: session, status } = useSession() || {};
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTaskCount, setActiveTaskCount] = useState(0);

  useEffect(() => {
    if (status !== "authenticated") return;

    const fetchActiveCount = async () => {
      try {
        const res = await fetch("/api/tasks/active-count");
        const data = await res.json();
        if (data.activeCount !== undefined) {
          setActiveTaskCount(data.activeCount);
        }
      } catch (err) {
        // Silent fail for polling
      }
    };

    fetchActiveCount();
    const interval = setInterval(fetchActiveCount, 10000);
    return () => clearInterval(interval);
  }, [status]);

  // Don't show header on login/signup pages
  if (pathname === "/login" || pathname === "/signup") return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-lime-400 via-blue-500 to-purple-500">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight hidden sm:inline">
            Movie Gen{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-400 via-blue-400 to-purple-400">
              Alpha
            </span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {toolNavItems.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? item.accent
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {item.href === "/tasks" && activeTaskCount > 0 && (
                    <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-bold text-black">
                      {activeTaskCount}
                    </span>
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="active-nav"
                      className="absolute inset-0 rounded-lg bg-white/5"
                      transition={{
                        type: "spring",
                        bounce: 0.2,
                        duration: 0.6,
                      }}
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}

          {isAdmin && (
            <Link href="/admin">
              <motion.div
                className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  pathname?.startsWith("/admin")
                    ? "text-amber-400"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Admin</span>
              </motion.div>
            </Link>
          )}
        </nav>

        {/* Right side: Auth + Mobile */}
        <div className="flex items-center gap-2">
          {status === "authenticated" ? (
            <ProfileAvatar
              name={(session?.user as any)?.name}
              email={(session?.user as any)?.email}
            />
          ) : status === "unauthenticated" ? (
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Login</span>
            </Link>
          ) : null}

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-xl overflow-hidden"
          >
            <div className="flex flex-col gap-1 p-3">
              {toolNavItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                      isActive
                        ? item.accent + " bg-white/5"
                        : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                    {item.href === "/tasks" && activeTaskCount > 0 && (
                      <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-black">
                        {activeTaskCount}
                      </span>
                    )}
                  </Link>
                );
              })}
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                    pathname?.startsWith("/admin")
                      ? "text-amber-400 bg-white/5"
                      : "text-muted-foreground"
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Admin
                </Link>
              )}
              {/* Mobile auth */}
              {status === "authenticated" && (
                <>
                  <div className="my-1 border-t border-border/40" />
                  <Link
                    href="/settings"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      signOut({ callbackUrl: "/login" });
                    }}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-red-400 text-left"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

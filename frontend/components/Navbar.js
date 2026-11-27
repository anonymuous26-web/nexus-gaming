
"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Gamepad2,
  Search,
  Heart,
  User,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Sun,
  Moon,
  Zap,
  Home,
  Compass,
  ShieldCheck,
  Command,
  ShoppingBag,
  ClipboardList,
  Sparkles,
  ArrowRight,
  LoaderCircle,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import CartButton from "@/components/CartButton";

const OPEN_CART_KEY = "openCartOnHome";
const THEME_KEY = "nexus-theme";

const NAV_LINKS = [
  { label: "Home", href: "/", icon: Home },
  { label: "Explore", href: "/explore", icon: Compass },
  {
    label: "Wishlist",
    href: "/wishlist",
    icon: Heart,
    authRequired: true,
  },
  {
    label: "My Orders",
    href: "/orders",
    icon: ClipboardList,
    authRequired: true,
  },
];

function getInitialTheme() {
  if (typeof window === "undefined") return "dark";

  try {
    return localStorage.getItem(THEME_KEY) === "light"
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}

function isActivePath(pathname, href) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Navbar() {
  const { currentUser, loginWithGoogle, logout, loading } = useAuth();
  const { setIsCartOpen } = useCart();

  const router = useRouter();
  const pathname = usePathname();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [scrolled, setScrolled] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const searchInputRef = useRef(null);
  const searchTriggerRef = useRef(null);
  const profileRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const mobileMenuButtonRef = useRef(null);

  // --------------------------------------------------
  // THEME
  // --------------------------------------------------

  useEffect(() => {
    const initialTheme = getInitialTheme();

    setTheme(initialTheme);
    document.documentElement.classList.toggle(
      "light",
      initialTheme === "light"
    );
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((previousTheme) => {
      const nextTheme =
        previousTheme === "dark" ? "light" : "dark";

      document.documentElement.classList.toggle(
        "light",
        nextTheme === "light"
      );
      document.documentElement.dataset.theme = nextTheme;

      try {
        localStorage.setItem(THEME_KEY, nextTheme);
      } catch {
        // The theme still works for the current page.
      }

      return nextTheme;
    });
  }, []);

  // --------------------------------------------------
  // SCROLL EFFECT
  // --------------------------------------------------

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;

      ticking = true;

      window.requestAnimationFrame(() => {
        setScrolled(window.scrollY > 12);
        ticking = false;
      });
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // --------------------------------------------------
  // RESTORE CART WHEN RETURNING HOME
  // --------------------------------------------------

  useEffect(() => {
    if (pathname !== "/") return;

    try {
      if (sessionStorage.getItem(OPEN_CART_KEY) === "true") {
        sessionStorage.removeItem(OPEN_CART_KEY);
        setIsCartOpen(true);
      }
    } catch {
      // Ignore unavailable session storage.
    }
  }, [pathname, setIsCartOpen]);

  // --------------------------------------------------
  // CLOSE MENUS WHEN ROUTE CHANGES
  // --------------------------------------------------

  useEffect(() => {
    setMobileMenuOpen(false);
    setProfileOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  // --------------------------------------------------
  // SEARCH DIALOG
  // --------------------------------------------------

  const openSearch = useCallback(() => {
    setMobileMenuOpen(false);
    setProfileOpen(false);
    setSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [searchOpen]);

  const handleSearch = useCallback(
    (event) => {
      event.preventDefault();

      const query = searchQuery.trim();

      if (!query) {
        searchInputRef.current?.focus();
        return;
      }

      setSearchOpen(false);
      setMobileMenuOpen(false);
      router.push(`/games?search=${encodeURIComponent(query)}`);
    },
    [router, searchQuery]
  );

  // Keyboard shortcut: Ctrl/Cmd + K
  useEffect(() => {
    const handleGlobalShortcut = (event) => {
      const target = event.target;
      const isTyping =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        openSearch();
      }

      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        setProfileOpen(false);
      }

      if (
        event.key === "/" &&
        !isTyping &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        openSearch();
      }
    };

    window.addEventListener("keydown", handleGlobalShortcut);

    return () => {
      window.removeEventListener("keydown", handleGlobalShortcut);
    };
  }, [openSearch]);

  // Return focus to the search trigger after closing.
  const previousSearchOpen = useRef(false);

  useEffect(() => {
    if (previousSearchOpen.current && !searchOpen) {
      searchTriggerRef.current?.focus();
    }

    previousSearchOpen.current = searchOpen;
  }, [searchOpen]);

  // --------------------------------------------------
  // PROFILE MENU
  // --------------------------------------------------

  useEffect(() => {
    if (!profileOpen) return;

    const handleOutsideClick = (event) => {
      if (!profileRef.current?.contains(event.target)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [profileOpen]);

  // --------------------------------------------------
  // MOBILE MENU
  // --------------------------------------------------

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleOutsideClick = (event) => {
      if (
        !mobileMenuRef.current?.contains(event.target) &&
        !mobileMenuButtonRef.current?.contains(event.target)
      ) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [mobileMenuOpen]);

  // --------------------------------------------------
  // CART
  // --------------------------------------------------

  const handleCartClick = useCallback(() => {
    setMobileMenuOpen(false);
    setProfileOpen(false);

    if (pathname === "/") {
      setIsCartOpen(true);
      return;
    }

    try {
      sessionStorage.setItem(OPEN_CART_KEY, "true");
    } catch {
      // Navigation still works without session storage.
    }

    router.push("/");
  }, [pathname, router, setIsCartOpen]);

  // --------------------------------------------------
  // AUTHENTICATION
  // --------------------------------------------------

  const handleLogin = useCallback(async () => {
    if (authBusy || loading) return;

    setAuthBusy(true);

    try {
      await loginWithGoogle();
      setMobileMenuOpen(false);
    } catch (error) {
      console.error("Google sign-in failed:", error);
    } finally {
      setAuthBusy(false);
    }
  }, [authBusy, loading, loginWithGoogle]);

  const handleLogout = useCallback(async () => {
    setProfileOpen(false);
    setMobileMenuOpen(false);

    try {
      await logout();
    } catch (error) {
      console.error("Sign-out failed:", error);
    }
  }, [logout]);

  // --------------------------------------------------
  // NAVIGATION HELPERS
  // --------------------------------------------------

  const navLinkClass = (href) => {
    const active = isActivePath(pathname, href);

    return [
      "group relative inline-flex items-center gap-2 rounded-xl",
      "px-3 py-2.5 text-sm font-semibold transition-all duration-200",
      active
        ? "bg-cyan-400/10 text-cyan-300"
        : "text-secondary hover:bg-white/[0.05] hover:text-primary",
    ].join(" ");
  };

  const mobileLinkClass = (href) => {
    const active = isActivePath(pathname, href);

    return [
      "flex min-h-12 items-center gap-3 rounded-xl px-4 py-3",
      "text-sm font-semibold transition-colors",
      active
        ? "border border-cyan-400/15 bg-cyan-400/10 text-cyan-300"
        : "border border-transparent text-secondary hover:bg-white/[0.04] hover:text-primary",
    ].join(" ");
  };

  const wishlistCount = Array.isArray(currentUser?.wishlist)
    ? currentUser.wishlist.length
    : 0;

  const displayName =
    currentUser?.displayName ||
    currentUser?.email?.split("@")[0] ||
    "Player";

  const avatar = currentUser?.photoURL;
  const isDark = theme === "dark";
  const signInBusy = authBusy || loading;

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <>
      <header
        className={[
          "sticky top-0 z-40 w-full border-b",
          "border-glass-border transition-all duration-300",
          scrolled
            ? "bg-black/90 shadow-[0_8px_35px_rgba(0,0,0,0.28)] backdrop-blur-2xl"
            : "bg-black/70 backdrop-blur-xl",
        ].join(" ")}
      >
        {/* Neon top edge */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />

        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex min-h-[60px] items-center justify-between gap-1.5 py-2 sm:min-h-[72px] sm:gap-3 sm:py-0">
            {/* BRAND */}
            <Link
              href="/"
              aria-label="Nexus Gaming home"
              className="group flex min-w-0 shrink items-center gap-2 sm:gap-3"
            >
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-gradient-to-br from-cyan-400/20 to-violet-500/20 shadow-[0_0_22px_rgba(34,211,238,0.08)] transition duration-300 group-hover:scale-105 group-hover:border-cyan-300/70 sm:h-11 sm:w-11 sm:rounded-2xl">
                <Gamepad2 className="h-5 w-5 text-cyan-300 transition-transform duration-300 group-hover:rotate-[-8deg] sm:h-6 sm:w-6" />
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-black bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              </div>

              <div className="min-w-0 leading-none">
                <span className="block text-lg font-black tracking-[0.06em] text-primary sm:text-2xl sm:tracking-[0.12em]">
                  NEXUS<span className="text-cyan-400">.</span>
                </span>

                <span className="mt-1.5 hidden text-[9px] font-semibold uppercase tracking-[0.28em] text-secondary sm:block">
                  Gaming marketplace
                </span>
              </div>
            </Link>

            {/* DESKTOP NAVIGATION */}
            <nav
              aria-label="Main navigation"
              className="hidden items-center gap-1 lg:flex"
            >
              {NAV_LINKS.filter(
                (item) => !item.authRequired || currentUser
              ).map((item) => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={navLinkClass(item.href)}
                  >
                    <Icon
                      className={[
                        "h-4 w-4 transition-colors",
                        item.href === "/wishlist" && wishlistCount > 0
                          ? "text-pink-400"
                          : "group-hover:text-cyan-300",
                      ].join(" ")}
                    />

                    {item.label}

                    {item.href === "/wishlist" && wishlistCount > 0 && (
                      <span className="rounded-full bg-pink-500/15 px-1.5 py-0.5 text-[10px] text-pink-300">
                        {wishlistCount}
                      </span>
                    )}

                    {active && (
                      <span className="absolute inset-x-3 -bottom-1 h-0.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)]" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* ACTIONS */}
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              {/* Search */}
              <button
                ref={searchTriggerRef}
                type="button"
                onClick={openSearch}
                aria-label="Search games"
                title="Search games (Ctrl/Cmd + K)"
                className="group flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-secondary transition hover:border-glass-border hover:bg-white/[0.05] hover:text-cyan-300 sm:w-auto sm:gap-2 sm:px-3"
              >
                <Search className="h-[18px] w-[18px]" />
                <span className="hidden text-sm md:inline">Search</span>
                <span className="hidden items-center gap-1 rounded-md border border-glass-border px-1.5 py-1 text-[10px] text-secondary xl:flex">
                  <Command className="h-3 w-3" /> K
                </span>
              </button>

              {/* Theme */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
                title={`Switch to ${isDark ? "light" : "dark"} theme`}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-secondary transition hover:bg-white/[0.05] hover:text-amber-300"
              >
                {isDark ? (
                  <Sun className="h-[18px] w-[18px]" />
                ) : (
                  <Moon className="h-[18px] w-[18px]" />
                )}
              </button>

              {/* Cart */}
              <div className="flex h-10 items-center justify-center">
                <CartButton onClick={handleCartClick} />
              </div>

              <div className="mx-1 hidden h-7 w-px bg-glass-border sm:block" />

              {/* Signed-in profile */}
              {currentUser ? (
                <div className="relative hidden sm:block" ref={profileRef}>
                  <button
                    type="button"
                    onClick={() => setProfileOpen((value) => !value)}
                    aria-expanded={profileOpen}
                    aria-haspopup="menu"
                    aria-label="Open profile menu"
                    className="flex items-center gap-2 rounded-xl border border-transparent p-1.5 transition hover:border-glass-border hover:bg-white/[0.05]"
                  >
                    {avatar ? (
                      <img
                        src={avatar}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="h-8 w-8 rounded-lg border border-cyan-400/30 object-cover"
                      />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/25 bg-cyan-400/10">
                        <User className="h-4 w-4 text-cyan-300" />
                      </span>
                    )}

                    <span className="hidden max-w-24 truncate text-sm font-medium text-primary xl:block">
                      {displayName}
                    </span>

                    <ChevronDown
                      className={[
                        "hidden h-4 w-4 text-secondary transition-transform xl:block",
                        profileOpen ? "rotate-180" : "",
                      ].join(" ")}
                    />
                  </button>

                  {profileOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-full mt-3 w-64 overflow-hidden rounded-2xl border border-glass-border bg-[#0b101b] shadow-[0_15px_50px_rgba(0,0,0,0.5)]"
                    >
                      <div className="border-b border-glass-border bg-gradient-to-br from-cyan-400/10 to-violet-500/10 p-4">
                        <div className="flex items-center gap-3">
                          {avatar ? (
                            <img
                              src={avatar}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="h-10 w-10 rounded-xl border border-cyan-400/30 object-cover"
                            />
                          ) : (
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10">
                              <User className="h-5 w-5 text-cyan-300" />
                            </span>
                          )}

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-primary">
                              {displayName}
                            </p>
                            <p className="truncate text-xs text-secondary">
                              {currentUser.email}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Signed in
                        </div>
                      </div>

                      <div className="p-2">
                        <Link
                          href="/wishlist"
                          role="menuitem"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-secondary transition hover:bg-white/[0.05] hover:text-pink-300"
                        >
                          <span className="flex items-center gap-2">
                            <Heart className="h-4 w-4" />
                            Wishlist
                          </span>
                          <span>{wishlistCount}</span>
                        </Link>

                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleLogout}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-red-300 transition hover:bg-red-400/10"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={signInBusy}
                  className="hidden items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2.5 text-sm font-semibold text-cyan-300 transition hover:border-cyan-300/60 hover:bg-cyan-400/15 hover:shadow-[0_0_18px_rgba(34,211,238,0.1)] disabled:cursor-wait disabled:opacity-60 sm:flex"
                >
                  {signInBusy ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                  {authBusy ? "Connecting..." : loading ? "Loading..." : "Sign in"}
                </button>
              )}

              {/* Mobile menu button */}
              <button
                ref={mobileMenuButtonRef}
                type="button"
                onClick={() => setMobileMenuOpen((value) => !value)}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
                aria-controls="nexus-mobile-navigation"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-glass-border text-primary transition hover:border-cyan-400/30 hover:bg-cyan-400/5 lg:hidden"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* MOBILE NAVIGATION */}
        {mobileMenuOpen && (
          <div
            id="nexus-mobile-navigation"
            ref={mobileMenuRef}
            className="border-t border-glass-border bg-[#080c14]/98 px-3 pb-5 pt-3 shadow-2xl backdrop-blur-2xl sm:px-6 lg:hidden"
          >
            <nav aria-label="Mobile navigation" className="space-y-1">
              {NAV_LINKS.filter(
                (item) => !item.authRequired || currentUser
              ).map((item) => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                    className={mobileLinkClass(item.href)}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>

                    {item.href === "/wishlist" && wishlistCount > 0 && (
                      <span className="ml-auto rounded-full bg-pink-500/15 px-2 py-0.5 text-xs text-pink-300">
                        {wishlistCount}
                      </span>
                    )}

                    {active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300" />
                    )}
                  </Link>
                );
              })}

              <button
                type="button"
                onClick={openSearch}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-secondary transition hover:bg-white/[0.04] hover:text-primary"
              >
                <Search className="h-5 w-5" />
                Search games
                <span className="ml-auto text-xs text-secondary">Ctrl K</span>
              </button>

              {/* Mobile authentication */}
              {!currentUser ? (
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={signInBusy}
                  className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/15 disabled:opacity-50"
                >
                  {signInBusy ? (
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                  ) : (
                    <User className="h-5 w-5" />
                  )}
                  {authBusy ? "Connecting..." : loading ? "Loading..." : "Sign in with Google"}
                </button>
              ) : (
                <div className="mt-3 border-t border-glass-border pt-3">
                  <div className="flex items-center gap-3 rounded-xl px-3 py-2">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="h-9 w-9 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10">
                        <User className="h-5 w-5 text-cyan-300" />
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-primary">
                        {displayName}
                      </p>
                      <p className="truncate text-xs text-secondary">
                        {currentUser.email}
                      </p>
                    </div>

                    <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" />
                  </div>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-2 flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-red-300 transition hover:bg-red-400/10"
                  >
                    <LogOut className="h-5 w-5" />
                    Sign out
                  </button>
                </div>
              )}

              {/* Mobile footer controls */}
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-glass-border bg-white/[0.02] px-4 py-3">
                <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-secondary">
                  <Zap className="h-4 w-4 shrink-0 text-cyan-300" />
                  <span>NEXUS GAMING</span>
                </div>

                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex shrink-0 items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-secondary transition hover:bg-white/[0.05] hover:text-cyan-300"
                >
                  {isDark ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                  {isDark ? "Light mode" : "Dark mode"}
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* SEARCH OVERLAY */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/75 px-3 pb-8 pt-[12vh] backdrop-blur-md sm:px-4 sm:pt-[15vh]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeSearch();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="nexus-search-title"
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-cyan-400/20 bg-[#0b101b] shadow-[0_0_80px_rgba(34,211,238,0.1)]"
          >
            <div className="border-b border-glass-border bg-gradient-to-r from-cyan-400/[0.07] to-violet-500/[0.07] px-4 py-4 sm:px-5">
              <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300">
                <Sparkles className="h-3.5 w-3.5" />
                Nexus discovery
              </div>

              <h2
                id="nexus-search-title"
                className="text-lg font-bold text-primary"
              >
                Find your next game
              </h2>

              <p className="mt-1 text-xs text-secondary">
                Search the marketplace by game or keyword.
              </p>
            </div>

            <form onSubmit={handleSearch} className="p-3 sm:p-4">
              <div className="flex items-center gap-3 rounded-xl border border-glass-border bg-white/[0.03] px-3 transition focus-within:border-cyan-400/50 focus-within:ring-2 focus-within:ring-cyan-400/10 sm:px-4">
                <Search className="h-5 w-5 shrink-0 text-cyan-300" />

                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search games, editions, platforms..."
                  aria-label="Search games"
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm text-primary outline-none placeholder:text-secondary"
                />

                <button
                  type="button"
                  onClick={closeSearch}
                  aria-label="Close search"
                  className="rounded-lg p-2 text-secondary transition hover:bg-white/[0.06] hover:text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <button
                type="submit"
                disabled={!searchQuery.trim()}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Search marketplace
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-glass-border px-4 py-3 sm:px-5">
              <p className="text-[11px] text-secondary">
                Press Enter to search.
              </p>
              <p className="text-[11px] text-secondary">
                Esc to close · / to open search
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import GameCard from "@/components/GameCard";
import {
  Heart,
  ShoppingCart,
  Gamepad2,
  ArrowRight,
  ArrowUp,
  Loader2,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";

export default function WishlistPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const { addToCart, setIsCartOpen } = useCart();

  const [wishlistGameIds, setWishlistGameIds] = useState([]);
  const [games, setGames] = useState([]);

  const [wishlistLoading, setWishlistLoading] = useState(true);
  const [gamesLoading, setGamesLoading] = useState(false);

  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  // --------------------------------------------------
  // Listen for changes to the signed-in user's wishlist.
  // --------------------------------------------------
  useEffect(() => {
    if (authLoading) return;

    if (!currentUser) {
      setWishlistGameIds([]);
      setGames([]);
      setError("");
      setWishlistLoading(false);
      setGamesLoading(false);
      return;
    }

    setWishlistLoading(true);
    setError("");

    const userRef = doc(db, "users", currentUser.uid);

    const unsubscribe = onSnapshot(
      userRef,
      (userSnapshot) => {
        if (!userSnapshot.exists()) {
          setWishlistGameIds([]);
        } else {
          const data = userSnapshot.data();
          const wishlist = Array.isArray(data.wishlist)
            ? data.wishlist
            : [];

          // Keep only valid, unique document IDs.
          const validIds = [
            ...new Set(
              wishlist.filter(
                (id) => typeof id === "string" && id.trim().length > 0
              )
            ),
          ];

          setWishlistGameIds(validIds);
        }

        setWishlistLoading(false);
      },
      (err) => {
        console.error("Error listening to wishlist:", err);
        setError("We couldn't load your wishlist. Please try again.");
        setWishlistLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, authLoading, retryKey]);

  // --------------------------------------------------
  // Fetch only the games saved in the wishlist.
  // --------------------------------------------------
  useEffect(() => {
    if (authLoading || wishlistLoading) return;

    if (!currentUser || wishlistGameIds.length === 0) {
      setGames([]);
      setGamesLoading(false);
      return;
    }

    let cancelled = false;

    const loadWishlistGames = async () => {
      setGamesLoading(true);
      setError("");

      try {
        const results = await Promise.all(
          wishlistGameIds.map(async (gameId) => {
            const gameRef = doc(db, "games", gameId);
            const gameSnapshot = await getDoc(gameRef);

            if (!gameSnapshot.exists()) {
              return null;
            }

            return {
              id: gameSnapshot.id,
              ...gameSnapshot.data(),
            };
          })
        );

        if (!cancelled) {
          setGames(results.filter(Boolean));
        }
      } catch (err) {
        console.error("Error fetching wishlist games:", err);

        if (!cancelled) {
          setError(
            "We couldn't load your saved games. Check your connection and retry."
          );
        }
      } finally {
        if (!cancelled) {
          setGamesLoading(false);
        }
      }
    };

    loadWishlistGames();

    return () => {
      cancelled = true;
    };
  }, [
    wishlistGameIds,
    currentUser,
    authLoading,
    wishlistLoading,
    retryKey,
  ]);

  const handleRetry = () => {
    setError("");
    setRetryKey((previous) => previous + 1);
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const isLoading =
    authLoading || wishlistLoading || gamesLoading;

  // --------------------------------------------------
  // Shared background.
  // --------------------------------------------------
  const Background = () => (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--background)_0,var(--background)_30%,rgba(0,240,255,0.06)_75%)]" />

      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width%3D%2260%22 height%3D%2260%22 viewBox%3D%220 0 60 60%22 xmlns%3D%22http://www.w3.org/2000/svg%22%3E%3Cg fill%3D%22%2300F0FF%22 fill-opacity%3D%220.06%22%3E%3Ccircle cx%3D%2230%22 cy%3D%2230%22 r%3D%222%22/%3E%3C/g%3E%3C/svg%3E')]" />

      <div className="absolute -right-24 top-32 h-72 w-72 rounded-full bg-cyan-400/5 blur-3xl" />

      <div className="absolute -left-24 bottom-20 h-72 w-72 rounded-full bg-purple-500/5 blur-3xl" />
    </div>
  );

  // --------------------------------------------------
  // Loading screen.
  // --------------------------------------------------
  if (isLoading) {
    return (
      <main className="relative min-h-[80vh] overflow-hidden">
        <Background />

        <div className="container relative z-10 mx-auto px-4 py-12">
          <div className="mb-10 text-center">
            <div className="mx-auto mb-4 h-10 w-56 animate-pulse rounded-lg bg-accent/15" />
            <div className="mx-auto h-4 w-72 max-w-full animate-pulse rounded bg-accent/10" />
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="overflow-hidden rounded-xl border border-glass-border bg-card/70 p-4"
              >
                <div className="mb-4 aspect-[4/3] animate-pulse rounded-lg bg-accent/10" />
                <div className="mb-3 h-5 w-3/4 animate-pulse rounded bg-accent/15" />
                <div className="mb-5 h-4 w-1/2 animate-pulse rounded bg-accent/10" />
                <div className="h-10 animate-pulse rounded-lg bg-accent/10" />
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading your wishlist...
          </div>
        </div>
      </main>
    );
  }

  // --------------------------------------------------
  // Signed-out screen.
  // --------------------------------------------------
  if (!currentUser) {
    return (
      <main className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-4 py-16">
        <Background />

        <section className="relative z-10 w-full max-w-lg rounded-2xl border border-glass-border bg-card/80 p-8 text-center shadow-2xl backdrop-blur-xl md:p-12">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-pink-400/20 bg-pink-500/10">
            <Heart className="h-10 w-10 text-pink-400" />
          </div>

          <h1 className="text-3xl font-extrabold text-white">
            Your Wishlist
          </h1>

          <p className="mx-auto mt-4 max-w-sm leading-7 text-secondary">
            Sign in to view your saved games and keep your favourite titles
            together.
          </p>

          <Link
            href="/login"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/15 px-6 py-3 font-semibold text-accent transition hover:bg-accent/25"
          >
            Sign In
            <ArrowRight className="h-4 w-4" />
          </Link>

          <div>
            <Link
              href="/"
              className="mt-5 inline-block text-sm text-secondary transition hover:text-accent"
            >
              Continue browsing games
            </Link>
          </div>
        </section>
      </main>
    );
  }

  // --------------------------------------------------
  // Error screen.
  // --------------------------------------------------
  if (error) {
    return (
      <main className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-4 py-16">
        <Background />

        <section className="relative z-10 w-full max-w-lg rounded-2xl border border-glass-border bg-card/80 p-8 text-center backdrop-blur-xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/10">
            <AlertCircle className="h-8 w-8 text-red-400" />
          </div>

          <h1 className="text-2xl font-bold text-white">
            Something went wrong
          </h1>

          <p role="alert" className="mt-3 leading-6 text-secondary">
            {error}
          </p>

          <button
            type="button"
            onClick={handleRetry}
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/15 px-6 py-3 font-semibold text-accent transition hover:bg-accent/25"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </section>
      </main>
    );
  }

  // --------------------------------------------------
  // Empty wishlist screen.
  // --------------------------------------------------
  if (wishlistGameIds.length === 0 || games.length === 0) {
    return (
      <main className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-4 py-16">
        <Background />

        <section className="relative z-10 w-full max-w-xl rounded-2xl border border-glass-border bg-card/80 p-8 text-center shadow-xl backdrop-blur-xl md:p-12">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10">
            <Gamepad2 className="h-10 w-10 text-accent" />
          </div>

          <div className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
            <Sparkles className="h-4 w-4" />
            Your Collection
          </div>

          <h1 className="text-3xl font-extrabold text-white">
            Your Wishlist Is Empty
          </h1>

          <p className="mx-auto mt-4 max-w-md leading-7 text-secondary">
            Save the games you love and find them here whenever you're ready
            to explore them again.
          </p>

          <Link
            href="/"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/15 px-6 py-3 font-semibold text-accent transition hover:bg-accent/25 hover:shadow-lg hover:shadow-cyan-500/10"
          >
            <ShoppingCart className="h-5 w-5" />
            Browse Games
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>
    );
  }

  // --------------------------------------------------
  // Wishlist page.
  // --------------------------------------------------
  return (
    <main className="relative min-h-[80vh] overflow-hidden">
      <Background />

      <div className="relative z-10 container mx-auto px-4 py-10 md:py-14">
        {/* Header */}
        <header className="mb-10 text-center">
          <div className="mb-4 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
            <Sparkles className="h-4 w-4" />
            Your Gaming Collection
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-accent md:text-5xl">
            My Wishlist
          </h1>

          <div className="mx-auto mt-4 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-secondary md:text-base">
            Your favourite games, collected in one place. Add them to your
            cart whenever you're ready.
          </p>

          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-glass-border bg-card/70 px-4 py-2 text-sm text-secondary">
            <Heart className="h-4 w-4 text-pink-400" />
            <span>
              {games.length} {games.length === 1 ? "game" : "games"} saved
            </span>
          </div>
        </header>

        {/* Game grid */}
        <section aria-label="Wishlisted games">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {games.map((game) => (
              <div
                key={game.id}
                className="group relative min-w-0"
              >
                <div className="pointer-events-none absolute -inset-px rounded-xl bg-gradient-to-br from-cyan-400/0 via-cyan-400/10 to-purple-500/0 opacity-0 transition duration-300 group-hover:opacity-100" />

                <div className="relative h-full transition duration-300 group-hover:-translate-y-1">
                <GameCard
  game={game}
  onAddToCart={async (selectedGame) => {
    await addToCart(selectedGame);

    if (typeof setIsCartOpen === "function") {
      setIsCartOpen(true);
    }
  }}
/>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom navigation */}
        <footer className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-glass-border pt-6 sm:flex-row">
          <p className="text-center text-xs text-secondary sm:text-left">
            Keep discovering games worth playing.
          </p>

          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-accent transition hover:text-white"
          >
            Explore More Games
            <ArrowRight className="h-4 w-4" />
          </Link>
        </footer>
      </div>

      {/* Scroll-to-top button */}
      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Scroll to top"
        className="fixed bottom-6 right-6 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-accent/30 bg-card/90 text-accent shadow-lg backdrop-blur transition hover:-translate-y-1 hover:bg-accent/20"
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </main>
  );
}
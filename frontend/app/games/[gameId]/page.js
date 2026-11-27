"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import {
  ArrowLeft,
  ArrowUp,
  Check,
  Heart,
  Loader2,
  Package,
  ShoppingCart,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export default function GameDetail() {
  const params = useParams();
  const router = useRouter();

  const gameId = Array.isArray(params?.gameId)
    ? params.gameId[0]
    : params?.gameId;

  const { currentUser, updateWishlist } = useAuth();
  const { cartItems = [], addToCart, setIsCartOpen } = useCart();

  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMessage, setCartMessage] = useState("");
  const [cartError, setCartError] = useState("");

  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [wishlistMessage, setWishlistMessage] = useState("");
  const [wishlistError, setWishlistError] = useState("");

  const [imageError, setImageError] = useState(false);

  // Fetch the selected game from Firestore.
  const fetchGame = useCallback(async () => {
    if (!gameId) {
      setPageError("The game ID is missing from the URL.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setPageError("");

    try {
      const gameRef = doc(db, "games", gameId);
      const gameSnapshot = await getDoc(gameRef);

      if (!gameSnapshot.exists()) {
        setGame(null);
        setPageError("Game not found. It may have been removed.");
        return;
      }

      setGame({
        id: gameSnapshot.id,
        ...gameSnapshot.data(),
      });
      setImageError(false);
    } catch (err) {
      console.error("Error fetching game details:", err);
      setPageError(
        "Unable to load this game. Check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  // Keep cart checks consistent with the CartContext.
  const cartItem = game
    ? cartItems.find((item) => item.id === game.id)
    : null;

  const cartQuantity = Number(cartItem?.quantity) || 0;
  const isInCart = Boolean(cartItem);

  const price = Number(game?.price);
  const hasValidPrice = Number.isFinite(price) && price >= 0;

  const stockValue = game?.stockCount;
  const stockCount =
    stockValue === undefined ||
    stockValue === null ||
    stockValue === ""
      ? null
      : Number(stockValue);

  const hasKnownStock =
    stockCount !== null &&
    Number.isFinite(stockCount);

  const isOutOfStock =
    hasKnownStock && stockCount <= 0;

  const isLowStock =
    hasKnownStock && stockCount > 0 && stockCount <= 5;

  const formatPrice = (value) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(value);

  // Add the game using your existing CartContext.
  const handleAddToCart = async () => {
    setCartMessage("");
    setCartError("");

    if (!game?.id) {
      setCartError("Game information is unavailable. Please reload.");
      return;
    }

    if (typeof addToCart !== "function") {
      setCartError("Cart functionality is not available. Please reload.");
      return;
    }

    if (!hasValidPrice) {
      setCartError("This game's price is invalid. Please contact support.");
      return;
    }

    if (isOutOfStock) {
      setCartError("This game is currently out of stock.");
      return;
    }

    try {
      setAddingToCart(true);

      await addToCart(game);

if (typeof setIsCartOpen === "function") {
  setIsCartOpen(true);
}

      setCartMessage(
        isInCart
          ? "Cart updated. Check your cart for the latest quantity."
          : "Game added to your cart successfully."
      );
    } catch (err) {
      console.error("Failed to add game to cart:", err);
      setCartError(
        err?.message || "Could not add this game to your cart."
      );
    } finally {
      setAddingToCart(false);
    }
  };

  // Wishlist updates require authentication.
  const handleWishlist = async () => {
    setWishlistMessage("");
    setWishlistError("");

    if (!currentUser) {
      setWishlistError("Please sign in to manage your wishlist.");
      return;
    }

    if (!game?.id || typeof updateWishlist !== "function") {
      setWishlistError("Wishlist functionality is unavailable.");
      return;
    }

    try {
      setWishlistLoading(true);
      await updateWishlist(game.id);
      setWishlistMessage("Wishlist updated.");
    } catch (err) {
      console.error("Failed to update wishlist:", err);
      setWishlistError(
        err?.message || "Could not update your wishlist."
      );
    } finally {
      setWishlistLoading(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Shared background used by the loading, error, and game views.
  const Background = () => (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--background)_0,var(--background)_30%,rgba(0,240,255,0.07)_75%)]" />

      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width%3D%2260%22 height%3D%2260%22 viewBox%3D%220 0 60 60%22 xmlns%3D%22http://www.w3.org/2000/svg%22%3E%3Cg fill%3D%22%2300F0FF%22 fill-opacity%3D%220.08%22%3E%3Ccircle cx%3D%2230%22 cy%3D%2230%22 r%3D%222%22/%3E%3C/g%3E%3C/svg%3E')]" />

      <div className="absolute -right-24 top-24 h-72 w-72 rounded-full bg-cyan-400/5 blur-3xl" />
      <div className="absolute -left-24 bottom-20 h-72 w-72 rounded-full bg-purple-500/5 blur-3xl" />
    </div>
  );

  // Loading state.
  if (loading) {
    return (
      <main className="relative min-h-[80vh] overflow-hidden">
        <Background />

        <div className="container relative z-10 mx-auto px-4 py-20">
          <div className="mx-auto max-w-5xl animate-pulse">
            <div className="mb-8 h-5 w-32 rounded bg-accent/20" />

            <div className="rounded-2xl border border-glass-border bg-card/80 p-6 md:p-8">
              <div className="flex flex-col gap-8 md:flex-row">
                <div className="h-72 w-full rounded-xl bg-accent/10 md:w-64" />

                <div className="flex-1 space-y-5">
                  <div className="h-8 w-3/4 rounded bg-accent/20" />
                  <div className="h-4 w-1/3 rounded bg-accent/10" />
                  <div className="h-4 w-full rounded bg-accent/10" />
                  <div className="h-4 w-5/6 rounded bg-accent/10" />
                  <div className="h-10 w-40 rounded bg-accent/20" />
                  <div className="h-12 w-full rounded-lg bg-accent/10 md:w-64" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading game details...
          </div>
        </div>
      </main>
    );
  }

  // Error state.
  if (pageError || !game) {
    return (
      <main className="relative min-h-[80vh] overflow-hidden">
        <Background />

        <div className="relative z-10 mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/10">
            <AlertCircle className="h-8 w-8 text-red-400" />
          </div>

          <h1 className="text-2xl font-bold text-white">
            {pageError.includes("not found")
              ? "Game Not Found"
              : "Unable to Load Game"}
          </h1>

          <p className="mt-3 max-w-md text-sm leading-6 text-secondary">
            {pageError || "The requested game could not be found."}
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={fetchGame}
              className="inline-flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-5 py-3 text-accent transition hover:bg-accent/20"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>

            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-card/70 px-5 py-3 text-white transition hover:border-accent/40"
            >
              <ArrowLeft className="h-4 w-4" />
              Return Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const title = game.title || "Untitled Game";
  const description =
    game.description || "No description is available for this game.";
  const category = game.category || "Gaming";
  const imageUrl = game.imageUrl || game.image || "";

  return (
    <main className="relative min-h-[80vh] overflow-hidden text-white">
      <Background />

      <div className="relative z-10 container mx-auto px-4 py-8 md:py-12">
        {/* Navigation */}
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-card/70 px-4 py-2.5 text-sm text-secondary transition hover:border-accent/40 hover:text-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>

          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-secondary">
            <Sparkles className="h-4 w-4 text-accent" />
            Nexus Gaming Marketplace
          </div>
        </div>

        {/* Main game card */}
        <section className="overflow-hidden rounded-2xl border border-glass-border bg-card/90 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="grid grid-cols-1 gap-0 md:grid-cols-[300px_minmax(0,1fr)] lg:grid-cols-[360px_minmax(0,1fr)]">
            {/* Game artwork */}
            <div className="relative flex min-h-[300px] items-center justify-center overflow-hidden bg-black/20 p-6 md:min-h-[500px]">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-purple-500/10" />

              {imageUrl && !imageError ? (
                <img
                  src={imageUrl}
                  alt={`${ title } cover`}
                  onError={() => setImageError(true)}
                  className="relative z-10 max-h-[460px] w-full rounded-xl object-contain shadow-2xl"
                />
              ) : (
                <div className="relative z-10 flex h-64 w-full flex-col items-center justify-center rounded-xl border border-glass-border bg-card/60 text-secondary">
                  <Package className="mb-3 h-12 w-12 text-accent/70" />
                  <span className="text-sm">Game artwork unavailable</span>
                </div>
              )}

              {game.featured && (
                <div className="absolute left-5 top-5 z-20 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-black/70 px-3 py-1.5 text-xs font-semibold text-accent backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5" />
                  Featured
                </div>
              )}
            </div>

            {/* Game information */}
            <div className="flex min-w-0 flex-col p-6 md:p-8 lg:p-10">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                  {category}
                </span>

                {isOutOfStock ? (
                  <span className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400">
                    Out of Stock
                  </span>
                ) : isLowStock ? (
                  <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                    Limited Stock
                  </span>
                ) : (
                  <span className="rounded-full border border-green-400/20 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400">
                    Available
                  </span>
                )}
              </div>

              <h1 className="break-words text-3xl font-extrabold leading-tight tracking-tight text-white md:text-4xl">
                {title}
              </h1>

              <p className="mt-5 whitespace-pre-line text-sm leading-7 text-secondary md:text-base">
                {description}
              </p>

              <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-glass-border bg-black/10 p-4">
                  <p className="text-xs uppercase tracking-wider text-secondary">
                    Availability
                  </p>
                  <p className="mt-2 font-semibold text-white">
                    {isOutOfStock
                      ? "Currently unavailable"
                      : hasKnownStock
                        ? `${ stockCount } in stock`
                        : "Check availability"}
                  </p>
                </div>

                <div className="rounded-xl border border-glass-border bg-black/10 p-4">
                  <p className="text-xs uppercase tracking-wider text-secondary">
                    Purchase
                  </p>
                  <p className="mt-2 flex items-center gap-2 font-semibold text-white">
                    <ShieldCheck className="h-4 w-4 text-accent" />
                    Secure checkout
                  </p>
                </div>
              </div>

              {/* Price */}
              <div className="mt-8 border-t border-glass-border pt-6">
                <p className="text-xs uppercase tracking-[0.2em] text-secondary">
                  Price
                </p>

                <div className="mt-2 flex flex-wrap items-baseline gap-3">
                  <span className="text-3xl font-extrabold text-accent md:text-4xl">
                    {hasValidPrice ? formatPrice(price) : "Price unavailable"}
                  </span>

                  {isInCart && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400">
                      <Check className="h-3.5 w-3.5" />
                      In cart: {cartQuantity}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={
                    addingToCart ||
                    isOutOfStock ||
                    !hasValidPrice
                  }
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/15 px-5 py-3 font-semibold text-accent transition duration-200 hover:bg-accent/25 hover:shadow-lg hover:shadow-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {addingToCart ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Adding to Cart...
                    </>
                  ) : isOutOfStock ? (
                    <>
                      <Package className="h-5 w-5" />
                      Out of Stock
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-5 w-5" />
                      {isInCart ? "Add Another" : "Add to Cart"}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleWishlist}
                  disabled={wishlistLoading}
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-glass-border bg-black/10 px-5 py-3 font-semibold text-white transition hover:border-pink-400/40 hover:bg-pink-500/10 hover:text-pink-300 disabled:cursor-wait disabled:opacity-60"
                >
                  {wishlistLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Heart className="h-5 w-5" />
                  )}

                  {wishlistLoading ? "Updating..." : "Wishlist"}
                </button>
              </div>

              {/* Cart feedback */}
              {cartMessage && (
                <div
                  role="status"
                  className="mt-4 flex items-start gap-2 rounded-lg border border-green-400/20 bg-green-500/10 p-3 text-sm text-green-400"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{cartMessage}</span>
                </div>
              )}

              {cartError && (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-2 rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-400"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{cartError}</span>
                </div>
              )}

              {/* Wishlist feedback */}
              {wishlistMessage && (
                <p
                  role="status"
                  className="mt-3 text-sm text-green-400"
                >
                  {wishlistMessage}
                </p>
              )}

              {wishlistError && (
                <p
                  role="alert"
                  className="mt-3 text-sm text-red-400"
                >
                  {wishlistError}
                </p>
              )}

              {!currentUser && (
                <p className="mt-4 text-xs leading-5 text-secondary">
                  You can add games to your cart as a guest. Sign in when
                  you are ready to use account-based features or proceed
                  through your checkout flow.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Footer navigation */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-secondary transition hover:text-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            Continue Exploring Games
          </Link>

          <p className="text-xs text-secondary">
            Nexus Gaming Marketplace
          </p>
        </div>
      </div>

      {/* Scroll to top */}
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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Heart,
  ShoppingCart,
  AlertCircle,
  CheckCircle2,
  Package,
  ArrowUpRight,
  LoaderCircle,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const FALLBACK_IMAGE =
  "https://placehold.co/800x500/111a2b/00e5ff?text=Game+Image";

export default function GameCard({
  game,
  onAddToCart,
  className = "",
}) {
  const { currentUser, updateWishlist } = useAuth();

  const [cartLoading, setCartLoading] = useState(false);
  const [cartError, setCartError] = useState("");
  const [cartSuccess, setCartSuccess] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [wishlistError, setWishlistError] = useState("");
  const [imageSrc, setImageSrc] = useState("");
  const [showFeaturedLabel, setShowFeaturedLabel] = useState(false);

  const earlyStockCount = Number(game?.stockCount);
  const earlyHasStock =
    game?.stockCount !== null &&
    game?.stockCount !== undefined &&
    game?.stockCount !== "" &&
    Number.isFinite(earlyStockCount);
  const earlyOutOfStock =
    !game?.upcoming && earlyHasStock && earlyStockCount <= 0;

  useEffect(() => {
    if (!game?.featured || earlyOutOfStock || game?.upcoming) {
      setShowFeaturedLabel(false);
      return;
    }

    const interval = window.setInterval(() => {
      setShowFeaturedLabel((value) => !value);
    }, 2200);

    return () => window.clearInterval(interval);
  }, [game?.featured, earlyOutOfStock, game?.upcoming]);

  if (!game || !game.id) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-red-500/30 bg-slate-950/70 p-5 text-sm text-red-300"
      >
        This game could not be displayed because its information is
        invalid.
      </div>
    );
  }

  const title = game.title || game.name || "Untitled game";
  const description =
    game.description || "Discover more about this game.";

  const price = Number(game.price);
  const stockCount = Number(game.stockCount);
  const hasStockCount =
    game.stockCount !== null &&
    game.stockCount !== undefined &&
    game.stockCount !== "" &&
    Number.isFinite(stockCount);

  const isOutOfStock = !game.upcoming && hasStockCount && stockCount <= 0;
  const isLowStock =
    !game.upcoming && hasStockCount && stockCount > 0 && stockCount < 5;

  const wishlist = Array.isArray(currentUser?.wishlist)
    ? currentUser.wishlist
    : [];

  const isWishlisted = wishlist.includes(game.id);

  const formattedPrice =
    game.price !== null &&
    game.price !== undefined &&
    game.price !== "" &&
    Number.isFinite(price) &&
    price >= 0
      ? new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 2,
        }).format(price)
      : "Price unavailable";

  const imageUrl = game.imageUrl || FALLBACK_IMAGE;

  async function handleAddToCart(event) {
    event.preventDefault();
    event.stopPropagation();

    if (cartLoading) return;

    setCartError("");
    setCartSuccess(false);

    if (typeof onAddToCart !== "function") {
      setCartError(
        "Cart functionality is unavailable on this page."
      );
      return;
    }

    if (isOutOfStock) {
      setCartError("This game is currently out of stock.");
      return;
    }

    setCartLoading(true);

    try {
      await onAddToCart(game);
      setCartSuccess(true);
    } catch (error) {
      console.error("Nexus add-to-cart error:", error);

      setCartError(
        error?.message ||
          "Could not add this game to your cart. Please try again."
      );
    } finally {
      setCartLoading(false);
    }
  }

  async function handleWishlistToggle(event) {
    event.preventDefault();
    event.stopPropagation();

    setWishlistError("");

    if (!currentUser) {
      setWishlistError(
        "Please sign in to manage your wishlist."
      );
      return;
    }

    if (wishlistLoading) return;

    if (typeof updateWishlist !== "function") {
      setWishlistError(
        "Wishlist functionality is currently unavailable."
      );
      return;
    }

    setWishlistLoading(true);

    try {
      await updateWishlist(game.id);
    } catch (error) {
      console.error("Nexus wishlist update error:", error);

      setWishlistError(
        error?.message ||
          "Could not update your wishlist. Please try again."
      );
    } finally {
      setWishlistLoading(false);
    }
  }

  return (
    <article
      className={[
        "nexus-game-card group relative flex h-full flex-col overflow-hidden rounded-2xl",
        "border border-white/10 bg-slate-950/70",
        "shadow-[0_12px_35px_rgba(0,0,0,0.22)]",
        "transition-all duration-300",
        "hover:-translate-y-1 hover:border-cyan-300/30",
        "hover:shadow-[0_18px_45px_rgba(0,229,255,0.10)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Image and game navigation */}
      <div className="relative overflow-hidden">
        <Link
          href={`/games/${encodeURIComponent(String(game.id))}`}
          className="group/image relative block overflow-hidden"
          aria-label={`View details for ${title}`}
        >
          <img
            src={imageSrc || imageUrl}
            alt={title}
            loading="lazy"
            decoding="async"
            onError={() => {
              if (imageSrc !== FALLBACK_IMAGE) {
                setImageSrc(FALLBACK_IMAGE);
              }
            }}
            className="h-48 w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-52"
          />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-slate-950/20" />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
            <span className="line-clamp-1 text-xs font-medium text-white/80">
              {game.category || "Gaming"}
            </span>

            <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-cyan-200 opacity-0 transition-opacity group-hover/image:opacity-100">
              Details <ArrowUpRight size={14} />
            </span>
          </div>
        </Link>

        {/* Availability / featured / upcoming status */}
        {game.upcoming ? (
          <span className="absolute right-3 top-3 rounded-full border border-sky-300/30 bg-slate-950/85 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-200 backdrop-blur-md">
            Coming soon
          </span>
        ) : isOutOfStock ? (
          <span className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
            Out of stock
          </span>
        ) : isLowStock ? (
          <span className="absolute right-3 top-3 rounded-full border border-red-300/30 bg-red-500/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
            Only {stockCount} left
          </span>
        ) : hasStockCount ? (
          <span
            className={[
              "absolute right-3 top-3 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md",
              game.featured
                ? "border-cyan-300/30 bg-slate-950/85 text-cyan-200"
                : "border-emerald-300/20 bg-slate-950/75 text-emerald-300",
              game.featured ? "featured-status-pulse" : "",
            ].join(" ")}
          >
            {game.featured && showFeaturedLabel ? "★ Featured" : "In Stock"}
          </span>
        ) : game.featured ? (
          <span className="absolute right-3 top-3 rounded-full border border-cyan-300/30 bg-slate-950/85 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-200">
            ★ Featured
          </span>
        ) : null}

        {/* Wishlist shortcut */}
        <button
          type="button"
          onClick={handleWishlistToggle}
          disabled={wishlistLoading}
          aria-pressed={isWishlisted}
          aria-label={
            isWishlisted
              ? `Remove ${title} from wishlist`
              : `Add ${title} to wishlist`
          }
          title={
            isWishlisted ? "Remove from wishlist" : "Add to wishlist"
          }
          className={[
            "absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full",
            "border border-white/15 bg-slate-950/75 text-white backdrop-blur-md",
            "transition-all duration-200 hover:scale-105 hover:border-rose-300/40 hover:text-rose-300",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
            "disabled:cursor-wait disabled:opacity-60",
            isWishlisted ? "text-rose-400" : "",
          ].join(" ")}
        >
          {wishlistLoading ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Heart
              className={[
                "h-4 w-4",
                isWishlisted ? "fill-current text-rose-400" : "",
              ].join(" ")}
            />
          )}
        </button>
      </div>

      {/* Game information */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="line-clamp-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300/75">
            {game.category || "Game"}
          </span>

          {game.platform && (
            <span className="max-w-[45%] truncate rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-slate-400">
              {game.platform}
            </span>
          )}
        </div>

        <Link
          href={`/games/${encodeURIComponent(String(game.id))}`}
          className="mb-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          <h3 className="line-clamp-2 min-h-[3.5rem] text-lg font-bold leading-7 tracking-tight text-slate-100 transition-colors group-hover:text-cyan-200 sm:text-xl">
            {title}
          </h3>
        </Link>

        <p className="mb-5 line-clamp-2 min-h-10 text-sm leading-5 text-slate-400">
          {description}
        </p>

        {/* Price and availability */}
        <div className="mb-4 mt-auto rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Price
            </span>

            <span className="text-lg font-extrabold tabular-nums text-cyan-200">
              {formattedPrice}
            </span>
          </div>

          {(hasStockCount || game.upcoming) && (
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-2 text-xs">
              <span className="flex items-center gap-1.5 text-slate-500">
                <Package size={13} />
                Availability
              </span>

              <span
                className={
                  isOutOfStock
                    ? "font-medium text-red-400"
                    : isLowStock
                      ? "font-medium text-amber-300"
                      : "text-slate-400"
                }
              >
                {game.upcoming
                  ? "Pre-orders open"
                  : isOutOfStock
                    ? "Unavailable"
                    : `${stockCount} available`}
              </span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleWishlistToggle}
            disabled={wishlistLoading}
            aria-pressed={isWishlisted}
            className="flex min-w-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-2.5 py-3 text-sm font-semibold text-slate-300 transition-all hover:border-rose-300/30 hover:bg-rose-400/10 hover:text-rose-300 disabled:cursor-wait disabled:opacity-60"
          >
            <Heart
              size={16}
              className={[
                "shrink-0",
                isWishlisted ? "fill-current text-rose-400" : "",
              ].join(" ")}
            />

            <span className="truncate">
              {wishlistLoading
                ? "Saving..."
                : isWishlisted
                  ? "Saved"
                  : "Wishlist"}
            </span>
          </button>

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={cartLoading || isOutOfStock}
            className="flex min-w-0 items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-2.5 py-3 text-sm font-bold text-cyan-200 transition-all hover:border-cyan-200/60 hover:bg-cyan-300/20 hover:text-white hover:shadow-[0_0_22px_rgba(0,229,255,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none"
          >
            {cartLoading ? (
              <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <ShoppingCart className="h-4 w-4 shrink-0" />
            )}

            <span className="truncate">
              {cartLoading
                ? "Adding..."
                : isOutOfStock
                  ? "Unavailable"
                  : game.upcoming
                    ? "Pre-order"
                    : "Add to Cart"}
            </span>
          </button>
        </div>

        {/* Accessible action feedback */}
        {cartError && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{cartError}</p>
          </div>
        )}

        {cartSuccess && (
          <div
            role="status"
            className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{game.upcoming ? "Pre-order item added to cart." : "Added to cart successfully."}</p>
          </div>
        )}

        {wishlistError && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{wishlistError}</p>
          </div>
        )}
      </div>
    </article>
  );
}
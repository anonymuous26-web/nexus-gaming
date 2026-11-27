
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Gamepad2,
  Heart,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { getAuth } from "firebase/auth";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { apiUrl } from "@/lib/api";

const UPI_ID = process.env.NEXT_PUBLIC_UPI_ID || "";
const MERCHANT_NAME =
  process.env.NEXT_PUBLIC_MERCHANT_NAME || "Nexus Gaming";
const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_MERCHANT_WHATSAPP || "";

const PAYMENT_WINDOW_SECONDS = 180;
const MAX_QUANTITY = 10;
const MAX_CART_ITEMS = 30;

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function formatINR(value) {
  const number = Number(value);
  return currencyFormatter.format(Number.isFinite(number) ? number : 0);
}

function getErrorMessage(error, fallback = "Something went wrong.") {
  if (typeof error === "string" && error.trim()) return error;
  if (error?.message) return error.message;
  return fallback;
}

async function getIdToken(firebaseUser) {
  // Prefer the Firebase user exposed by AuthContext.
  if (firebaseUser && typeof firebaseUser.getIdToken === "function") {
    return firebaseUser.getIdToken();
  }

  // Fallback for projects whose AuthContext exposes only a profile.
  try {
    const auth = getAuth();
    if (auth.currentUser) {
      return await auth.currentUser.getIdToken();
    }
  } catch (error) {
    console.error("Could not retrieve Firebase authentication:", error);
  }

  throw new Error("Please sign in again before checking out.");
}

async function authenticatedRequest(url, options = {}, firebaseUser) {
  const token = await getIdToken(firebaseUser);

  const response = await fetch(apiUrl(url), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `Request failed (${response.status}).`
    );
  }

  return data;
}

function createUpiLink({
  upiId,
  merchantName,
  amount,
  transactionReference,
}) {
  if (!upiId) {
    throw new Error(
      "UPI payments are not configured yet. Please contact the store."
    );
  }

  const params = new URLSearchParams({
    pa: upiId,
    pn: merchantName,
    am: Number(amount).toFixed(2),
    cu: "INR",
  });

  if (transactionReference) {
    params.set("tr", String(transactionReference));
    params.set("tn", `Nexus Gaming order ${transactionReference}`);
  } else {
    params.set("tn", "Nexus Gaming order");
  }

  return `upi://pay?${params.toString()}`;
}

function getProductId(item) {
  return String(
    item?.id ??
      item?.productId ??
      item?.gameId ??
      item?.slug ??
      ""
  ).trim();
}

function getProductName(item) {
  return (
    item?.name ||
    item?.title ||
    item?.gameName ||
    "Gaming product"
  );
}

function getProductImage(item) {
  return (
    item?.image ||
    item?.imageUrl ||
    item?.coverImage ||
    item?.thumbnail ||
    ""
  );
}

function getProductPrice(item) {
  const price = Number(
    item?.price ??
      item?.salePrice ??
      item?.discountedPrice ??
      0
  );

  return Number.isFinite(price) && price >= 0 ? price : 0;
}

function getProductQuantity(item) {
  const quantity = Number(item?.quantity ?? 1);

  if (!Number.isFinite(quantity)) return 1;

  return Math.min(MAX_QUANTITY, Math.max(1, Math.floor(quantity)));
}

function getOrderReference(data) {
  return (
    data?.order?.reference ||
    data?.order?.orderNumber ||
    data?.order?.orderId ||
    data?.order?.id ||
    data?.reference ||
    data?.orderNumber ||
    data?.orderId ||
    data?.id ||
    ""
  );
}

function getOrderAmount(data, fallbackAmount) {
  const possibleAmounts = [
    data?.order?.total,
    data?.order?.totalAmount,
    data?.order?.amount,
    data?.total,
    data?.totalAmount,
    data?.amount,
  ];

  for (const candidate of possibleAmounts) {
    if (candidate !== undefined && candidate !== null) {
      const amount = Number(candidate);

      if (Number.isFinite(amount) && amount >= 0) {
        return amount;
      }
    }
  }

  return fallbackAmount;
}

function IconButton({
  label,
  onClick,
  children,
  className = "",
  buttonRef,
  disabled = false,
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex h-10 w-10 shrink-0 items-center justify-center",
        "rounded-xl border border-white/10 bg-white/[0.04]",
        "text-white/75 transition-colors",
        "hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-200",
        "focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-cyan-400 disabled:cursor-not-allowed",
        "disabled:opacity-40",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SectionCard({ children, className = "" }) {
  return (
    <section
      className={[
        "rounded-2xl border border-white/[0.08]",
        "bg-white/[0.025] p-4 sm:p-5",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}

function Notice({ type = "error", children }) {
  const styles =
    type === "success"
      ? "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-200"
      : type === "info"
        ? "border-cyan-400/20 bg-cyan-400/[0.06] text-cyan-100"
        : "border-rose-400/20 bg-rose-400/[0.07] text-rose-200";

  const Icon = type === "success" ? CheckCircle2 : AlertCircle;

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-xl border p-3 text-sm ${styles}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export default function CartSlideout({
  cartItems = [],
  onRemoveFromCart,
  onUpdateQuantity,
}) {
  const authContext = useAuth();
  const firebaseUser = authContext?.firebaseUser ?? null;

  const { isCartOpen, setIsCartOpen } = useCart();

  const [portalReady, setPortalReady] = useState(false);

  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState("");
  const [promoMessage, setPromoMessage] = useState("");
  const [promoApplied, setPromoApplied] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [order, setOrder] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const [copied, setCopied] = useState(false);
  const [merchantNotified, setMerchantNotified] = useState(false);

  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const checkoutLock = useRef(false);
  const promoRequest = useRef(0);
  const copiedTimeout = useRef(null);

  const normalizedItems = useMemo(() => {
    if (!Array.isArray(cartItems)) return [];

    return cartItems.map((item) => ({
      ...item,
      id: getProductId(item),
      name: getProductName(item),
      image: getProductImage(item),
      price: getProductPrice(item),
      quantity: getProductQuantity(item),
    }));
  }, [cartItems]);

  const totalItems = useMemo(
    () =>
      normalizedItems.reduce(
        (sum, item) => sum + item.quantity,
        0
      ),
    [normalizedItems]
  );

  const displaySubtotal = useMemo(
    () =>
      normalizedItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      ),
    [normalizedItems]
  );

  const cartSignature = useMemo(
    () =>
      normalizedItems
        .map(
          (item) =>
            `${item.id}:${item.quantity}:${item.price}`
        )
        .sort()
        .join("|"),
    [normalizedItems]
  );

  const discountAmount = useMemo(() => {
    if (!promoApplied) return 0;

    const value = Number(
      promoApplied.discountAmount ??
        promoApplied.discount ??
        0
    );

    if (!Number.isFinite(value) || value <= 0) return 0;

    return Math.min(displaySubtotal, value);
  }, [promoApplied, displaySubtotal]);

  const displayTotal = Math.max(
    0,
    displaySubtotal - discountAmount
  );

  const closeCart = useCallback(() => {
    setIsCartOpen(false);
  }, [setIsCartOpen]);

  // A portal moves the drawer outside transformed/overflow-hidden
  // ancestors, avoiding common fixed-position and stacking problems.
  useEffect(() => {
    setPortalReady(true);
  }, []);

  // Keep the page behind the open drawer from scrolling.
  useEffect(() => {
    if (!portalReady || !isCartOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [portalReady, isCartOpen]);

  // Keyboard close support and initial focus.
  useEffect(() => {
    if (!portalReady || !isCartOpen) return;

    previousFocusRef.current = document.activeElement;

    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCart();
      }

      // Keep keyboard focus inside the modal.
      if (event.key === "Tab") {
        const dialog = document.getElementById("nexus-cart-dialog");
        if (!dialog) return;

        const focusable = Array.from(
          dialog.querySelectorAll(
            'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((element) => element.getAttribute("aria-hidden") !== "true");

        if (!focusable.length) {
          event.preventDefault();
          dialog.focus();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === last
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);

      if (previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus?.();
      }
    };
  }, [portalReady, isCartOpen, closeCart]);

  // Reset promo state when cart contents change.
  useEffect(() => {
    promoRequest.current += 1;
    setPromoApplied(null);
    setPromoError("");
    setPromoMessage("");
    setPromoLoading(false);
  }, [cartSignature]);

  // Expire the local checkout display after the payment window.
  useEffect(() => {
    if (!order?.expiresAt) {
      setTimeLeft(0);
      return;
    }

    const updateTime = () => {
      const remaining = Math.max(
        0,
        Math.ceil((order.expiresAt - Date.now()) / 1000)
      );

      setTimeLeft(remaining);
    };

    updateTime();

    const timer = window.setInterval(updateTime, 1000);

    return () => window.clearInterval(timer);
  }, [order?.expiresAt]);

  useEffect(
    () => () => {
      if (copiedTimeout.current) {
        window.clearTimeout(copiedTimeout.current);
      }
    },
    []
  );

  const validateCart = useCallback(() => {
    if (!normalizedItems.length) {
      throw new Error("Your cart is empty.");
    }

    if (normalizedItems.length > MAX_CART_ITEMS) {
      throw new Error(
        `You can add up to ${MAX_CART_ITEMS} different items per order.`
      );
    }

    for (const item of normalizedItems) {
      if (!item.id) {
        throw new Error(
          "A cart item is missing its product ID. Remove it and add it again."
        );
      }

      if (
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > MAX_QUANTITY
      ) {
        throw new Error(
          `Quantity for "${item.name}" must be between 1 and ${MAX_QUANTITY}.`
        );
      }
    }
  }, [normalizedItems]);

  const applyPromo = useCallback(async () => {
    const code = promoCode.trim().toUpperCase();

    setPromoError("");
    setPromoMessage("");

    if (!code) {
      setPromoError("Enter a promo code first.");
      return;
    }

    if (!normalizedItems.length) {
      setPromoError("Add an item to your cart first.");
      return;
    }

    const requestId = ++promoRequest.current;
    setPromoLoading(true);

    try {
      const data = await authenticatedRequest(
        "/api/promos/validate",
        {
          method: "POST",
          body: JSON.stringify({
            code,
            items: normalizedItems.map((item) => ({
              productId: item.id,
              id: item.id,
              quantity: item.quantity,
            })),
          }),
        },
        firebaseUser
      );

      if (requestId !== promoRequest.current) return;

      if (data?.valid === false || data?.success === false) {
        throw new Error(
          data?.error || data?.message || "This promo code is invalid."
        );
      }

      const discount = Number(
        data?.discountAmount ??
          data?.discount ??
          data?.promo?.discountAmount ??
          0
      );

      const percentage = Number(
        data?.discountPercentage ??
          data?.percentage ??
          data?.promo?.discountPercentage ??
          data?.promo?.percentage ??
          0
      );

      setPromoApplied({
        code,
        discountAmount:
          Number.isFinite(discount) && discount > 0
            ? Math.min(discount, displaySubtotal)
            : percentage > 0
              ? Math.min(
                  displaySubtotal,
                  (displaySubtotal * percentage) / 100
                )
              : 0,
        discountPercentage: percentage,
        message:
          data?.message ||
          data?.promo?.message ||
          "Promo code applied.",
      });

      setPromoMessage(
        data?.message ||
          data?.promo?.message ||
          "Promo code applied successfully."
      );
    } catch (error) {
      if (requestId !== promoRequest.current) return;

      setPromoApplied(null);
      setPromoError(getErrorMessage(error, "Unable to validate promo code."));
    } finally {
      if (requestId === promoRequest.current) {
        setPromoLoading(false);
      }
    }
  }, [promoCode, normalizedItems, firebaseUser, displaySubtotal]);

  const removePromo = useCallback(() => {
    promoRequest.current += 1;
    setPromoApplied(null);
    setPromoError("");
    setPromoMessage("");
    setPromoLoading(false);
    setPromoCode("");
  }, []);

  const startCheckout = useCallback(async () => {
    if (checkoutLock.current) return;

    checkoutLock.current = true;
    setCheckoutLoading(true);
    setCheckoutError("");

    try {
      validateCart();

      if (!firebaseUser && !getAuth().currentUser) {
        throw new Error(
          "Please sign in with your account before placing an order."
        );
      }

      const data = await authenticatedRequest(
        "/api/orders",
        {
          method: "POST",
          body: JSON.stringify({
            items: normalizedItems.map((item) => ({
              productId: item.id,
              id: item.id,
              quantity: item.quantity,
            })),
            promoCode: promoApplied?.code || null,
            paymentMethod: "upi",
          }),
        },
        firebaseUser
      );

      if (data?.success === false) {
        throw new Error(
          data?.error || data?.message || "Could not create the order."
        );
      }

      const reference = getOrderReference(data);

      if (!reference) {
        throw new Error(
          "The server did not return an order reference. Please check your orders before trying again."
        );
      }

      const serverAmount = getOrderAmount(data, displayTotal);

      if (!Number.isFinite(serverAmount) || serverAmount < 0) {
        throw new Error("The server returned an invalid order total.");
      }

      const serverUpiId =
        data?.upiId ||
        data?.paymentDetails?.upiId ||
        UPI_ID;

      const serverMerchantName =
        data?.merchantName ||
        data?.paymentDetails?.merchantName ||
        MERCHANT_NAME;

      const upiLink = createUpiLink({
        upiId: serverUpiId,
        merchantName: serverMerchantName,
        amount: serverAmount,
        transactionReference: reference,
      });

      const expiresAtFromServer =
        data?.order?.expiresAt ||
        data?.expiresAt ||
        data?.order?.expiresAtMs ||
        null;

      let expiresAt = Date.now() + PAYMENT_WINDOW_SECONDS * 1000;

      if (expiresAtFromServer) {
        const parsed =
          typeof expiresAtFromServer === "number"
            ? expiresAtFromServer
            : new Date(expiresAtFromServer).getTime();

        if (Number.isFinite(parsed)) {
          expiresAt = parsed;
        }
      }

      setOrder({
        reference: String(reference),
        amount: serverAmount,
        upiLink,
        upiId: serverUpiId,
        merchantName: serverMerchantName,
        expiresAt,
        status: "pending",
      });

      setCopied(false);
      setMerchantNotified(false);
    } catch (error) {
      setCheckoutError(
        getErrorMessage(error, "Unable to start checkout.")
      );
    } finally {
      checkoutLock.current = false;
      setCheckoutLoading(false);
    }
  }, [
    validateCart,
    firebaseUser,
    normalizedItems,
    promoApplied,
    displayTotal,
  ]);

  const copyReference = useCallback(async () => {
    if (!order?.reference) return;

    try {
      await navigator.clipboard.writeText(order.reference);
      setCopied(true);

      if (copiedTimeout.current) {
        window.clearTimeout(copiedTimeout.current);
      }

      copiedTimeout.current = window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      setCheckoutError(
        "Could not copy automatically. Please select and copy the order reference."
      );
    }
  }, [order]);

  const notifyMerchant = useCallback(() => {
    if (!order?.reference) return;

    if (!WHATSAPP_NUMBER) {
      setCheckoutError(
        "The store's WhatsApp number is not configured. Please contact the store directly."
      );
      return;
    }

    const message = [
      `Hello ${MERCHANT_NAME},`,
      "",
      "I have initiated a UPI payment for my Nexus Gaming order.",
      `Order reference: ${order.reference}`,
      `Order amount: ${formatINR(order.amount)}`,
      "",
      "Please verify the payment and confirm my order.",
      "I understand that the order remains pending until the payment is verified.",
    ].join("\n");

    const phone = WHATSAPP_NUMBER.replace(/[^\d]/g, "");

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank", "noopener,noreferrer");
    setMerchantNotified(true);
  }, [order]);

  const resetCheckout = useCallback(() => {
    setOrder(null);
    setTimeLeft(0);
    setCheckoutError("");
    setCopied(false);
    setMerchantNotified(false);
  }, []);

  
const updateQuantity = useCallback(
  (item, delta) => {
    if (!onUpdateQuantity) return;

    const currentQuantity = Number(item.quantity) || 1;
    const change = Math.trunc(Number(delta));

    if (!Number.isFinite(change) || change === 0) return;

    const nextQuantity = currentQuantity + change;

    // The cart supports quantities from 1 to 10.
    if (nextQuantity < 1 || nextQuantity > MAX_QUANTITY) return;

    // CartContext.updateQuantity expects a DELTA, not an absolute quantity.
    onUpdateQuantity(item.id, change);
  },
  [onUpdateQuantity]
);


  const removeItem = useCallback(
    (item) => {
      if (!onRemoveFromCart) return;
      onRemoveFromCart(item.id);
    },
    [onRemoveFromCart]
  );

  const handleBackdropMouseDown = useCallback(
    (event) => {
      if (event.target === event.currentTarget) {
        closeCart();
      }
    },
    [closeCart]
  );

  if (!portalReady || !isCartOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex justify-end bg-black/75 backdrop-blur-[5px]"
      style={{
        height: "100dvh",
        width: "100%",
        isolation: "isolate",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      onMouseDown={handleBackdropMouseDown}
    >
      <aside
        id="nexus-cart-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        aria-describedby="cart-description"
        tabIndex={-1}
        className={[
          "relative flex h-full min-h-0 w-full max-w-lg flex-col",
          "overflow-hidden border-l border-cyan-400/15",
          "bg-[#090b12] text-white",
          "shadow-[-25px_0_80px_rgba(0,0,0,0.55)]",
          "animate-in slide-in-from-right duration-300",
        ].join(" ")}
        style={{
          height: "100%",
          maxHeight: "100%",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Decorative background lighting */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/[0.09] blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 top-1/3 h-64 w-64 rounded-full bg-violet-500/[0.07] blur-3xl"
        />

        {/* Sticky drawer header: always above decorative layers */}
        <header className="relative z-20 flex shrink-0 items-center justify-between gap-4 border-b border-white/[0.08] bg-[#090b12]/95 px-4 py-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.08]">
              <ShoppingCart className="h-5 w-5 text-cyan-300" />
            </div>

            <div className="min-w-0">
              <h2
                id="cart-title"
                className="truncate text-lg font-black tracking-tight sm:text-xl"
              >
                Your Cart
              </h2>
              <p
                id="cart-description"
                className="text-xs text-white/45"
              >
                {totalItems} {totalItems === 1 ? "item" : "items"} ready
                for checkout
              </p>
            </div>
          </div>

          <IconButton
            label="Close cart"
            onClick={closeCart}
            buttonRef={closeButtonRef}
            className="relative z-30"
          >
            <X className="h-5 w-5" />
          </IconButton>
        </header>

        {/* Main scroll area */}
        <div className="relative z-10 min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {checkoutError && (
            <Notice type="error">{checkoutError}</Notice>
          )}

          {!order ? (
            <>
              {/* Cart items */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Selected games
                  </h3>
                  <p className="mt-1 text-xs text-white/40">
                    Review your items before checkout.
                  </p>
                </div>

                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/65">
                  {normalizedItems.length} products
                </span>
              </div>

              {normalizedItems.length === 0 ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
                  <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-cyan-400/15 bg-cyan-400/[0.06]">
                    <ShoppingCart className="h-9 w-9 text-cyan-300/80" />
                  </div>

                  <h3 className="text-lg font-bold">
                    Your cart is empty
                  </h3>

                  <p className="mt-2 max-w-xs text-sm leading-6 text-white/45">
                    Your next gaming adventure starts here. Add a game
                    and it will appear in this cart.
                  </p>

                  <button
                    type="button"
                    onClick={closeCart}
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                  >
                    Explore games
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {normalizedItems.map((item, index) => (
                    <article
                      key={item.id || `${item.name}-${index}`}
                      className="group rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 transition-colors hover:border-cyan-400/20 hover:bg-white/[0.04] sm:p-4"
                    >
                      <div className="flex gap-3">
                        <div className="relative h-24 w-[76px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#121722]">
                          {item.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.image}
                              alt={item.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Gamepad2 className="h-8 w-8 text-cyan-300/60" />
                            </div>
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="line-clamp-2 text-sm font-bold leading-5 text-white">
                                {item.name}
                              </h4>

                              {item.platform && (
                                <p className="mt-1 text-xs text-white/40">
                                  {item.platform}
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              aria-label={`Remove ${item.name} from cart`}
                              onClick={() => removeItem(item)}
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/35 transition hover:bg-rose-400/10 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-3">
                            <div className="inline-flex items-center rounded-xl border border-white/10 bg-black/20 p-1">
                              <button
                                type="button"
                                aria-label={`Decrease quantity of ${item.name}`}
                                disabled={item.quantity <= 1}
                                onClick={() => updateQuantity(item, -1)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white/65 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>

                              <span
                                className="w-8 text-center text-xs font-bold tabular-nums"
                                aria-live="polite"
                              >
                                {item.quantity}
                              </span>

                              <button
                                type="button"
                                aria-label={`Increase quantity of ${item.name}`}
                                disabled={item.quantity >= MAX_QUANTITY}
                                onClick={() => updateQuantity(item, 1)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white/65 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="text-right">
                              <p className="text-sm font-black text-cyan-200">
                                {formatINR(item.price * item.quantity)}
                              </p>

                              {item.quantity > 1 && (
                                <p className="mt-0.5 text-[10px] text-white/35">
                                  {formatINR(item.price)} each
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {normalizedItems.length > 0 && (
                <>
                  {/* Promo code */}
                  <SectionCard>
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400/10">
                        <Tag className="h-4 w-4 text-violet-300" />
                      </div>

                      <div>
                        <h3 className="text-sm font-bold">
                          Promo code
                        </h3>
                        <p className="text-xs text-white/40">
                          Apply an eligible discount.
                        </p>
                      </div>
                    </div>

                    {promoApplied ? (
                      <div className="space-y-3">
                        <Notice type="success">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span>
                              {promoApplied.code} applied
                            </span>
                            <span className="font-bold">
                              −{formatINR(discountAmount)}
                            </span>
                          </div>
                        </Notice>

                        <button
                          type="button"
                          onClick={removePromo}
                          className="text-xs font-semibold text-white/45 underline decoration-white/20 underline-offset-4 transition hover:text-white"
                        >
                          Remove promo code
                        </button>
                      </div>
                    ) : (
                      <form
                        className="flex gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          applyPromo();
                        }}
                      >
                        <input
                          type="text"
                          value={promoCode}
                          onChange={(event) => {
                            setPromoCode(event.target.value);
                            setPromoError("");
                            setPromoMessage("");
                          }}
                          placeholder="Enter code"
                          autoComplete="off"
                          maxLength={40}
                          aria-label="Promo code"
                          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm uppercase text-white outline-none placeholder:normal-case placeholder:text-white/25 focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/10"
                        />

                        <button
                          type="submit"
                          disabled={promoLoading || !promoCode.trim()}
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08] px-4 py-3 text-sm font-bold text-cyan-200 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {promoLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Apply"
                          )}
                        </button>
                      </form>
                    )}

                    {promoError && (
                      <p className="mt-3 text-xs text-rose-300">
                        {promoError}
                      </p>
                    )}

                    {promoMessage && !promoError && !promoApplied && (
                      <p className="mt-3 text-xs text-emerald-300">
                        {promoMessage}
                      </p>
                    )}
                  </SectionCard>

                  {/* Price summary */}
                  <SectionCard>
                    <div className="mb-4 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-cyan-300" />
                      <h3 className="text-sm font-bold">
                        Order summary
                      </h3>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between gap-3 text-white/55">
                        <span>Subtotal</span>
                        <span className="tabular-nums">
                          {formatINR(displaySubtotal)}
                        </span>
                      </div>

                      {promoApplied && (
                        <div className="flex justify-between gap-3 text-emerald-300">
                          <span>Discount</span>
                          <span className="tabular-nums">
                            −{formatINR(discountAmount)}
                          </span>
                        </div>
                      )}

                      <div className="border-t border-white/[0.08] pt-3">
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <p className="font-bold">Total</p>
                            <p className="mt-1 text-xs text-white/35">
                              Final amount confirmed by the server
                            </p>
                          </div>

                          <p className="text-2xl font-black tracking-tight text-cyan-200 tabular-nums">
                            {formatINR(displayTotal)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </SectionCard>

                  {/* Checkout trust notes */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                      <ShieldCheck className="mb-2 h-5 w-5 text-emerald-300" />
                      <p className="text-xs font-bold">
                        Secure order
                      </p>
                      <p className="mt-1 text-[11px] leading-4 text-white/40">
                        Account-authenticated checkout
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                      <Heart className="mb-2 h-5 w-5 text-violet-300" />
                      <p className="text-xs font-bold">
                        Player first
                      </p>
                      <p className="mt-1 text-[11px] leading-4 text-white/40">
                        Help is available if needed
                      </p>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            /* UPI payment panel */
            <div className="space-y-5">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.08]">
                  <ShieldCheck className="h-8 w-8 text-cyan-200" />
                </div>

                <h3 className="text-xl font-black">
                  Complete your payment
                </h3>

                <p className="mt-2 text-sm leading-6 text-white/45">
                  Scan the QR code with a UPI app or open the payment
                  link on a compatible device.
                </p>
              </div>

              <SectionCard className="text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                  Order amount
                </p>

                <p className="mt-2 text-3xl font-black tracking-tight text-cyan-200 tabular-nums">
                  {formatINR(order.amount)}
                </p>

                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-white/45">
                  <Clock className="h-4 w-4" />
                  {timeLeft > 0
                    ? `Payment window: ${Math.floor(timeLeft / 60)}:${String(
                        timeLeft % 60
                      ).padStart(2, "0")}`
                    : "Payment window expired"}
                </div>

                {timeLeft <= 0 && (
                  <p className="mt-2 text-xs leading-5 text-amber-200/80">
                    This checkout window has expired. Confirm the order
                    status with the store before attempting another payment.
                  </p>
                )}
              </SectionCard>

              <SectionCard>
                <div className="mx-auto flex w-full max-w-[260px] items-center justify-center rounded-2xl bg-white p-4">
                  <QRCodeSVG
                    value={order.upiLink}
                    size={220}
                    level="H"
                    includeMargin
                    bgColor="#ffffff"
                    fgColor="#090b12"
                    title={`UPI payment QR for order ${order.reference}`}
                  />
                </div>

                <p className="mt-4 text-center text-xs leading-5 text-white/45">
                  Verify the merchant name and amount in your UPI app
                  before approving the payment.
                </p>

                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-white/35">
                      UPI ID
                    </p>
                    <p className="mt-1 break-all text-sm font-semibold text-white/85">
                      {order.upiId || "Not configured"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-white/35">
                      Order reference
                    </p>

                    <div className="mt-1 flex items-center gap-2">
                      <p className="min-w-0 flex-1 break-all text-sm font-bold text-white">
                        {order.reference}
                      </p>

                      <button
                        type="button"
                        onClick={copyReference}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
                      >
                        {copied ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                </div>
              </SectionCard>

              <div className="space-y-3">
                <a
                  href={order.upiLink}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3.5 text-sm font-black text-black transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                >
                  Open UPI app
                  <ExternalLink className="h-4 w-4" />
                </a>

                <button
                  type="button"
                  onClick={notifyMerchant}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] px-4 py-3.5 text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                >
                  {merchantNotified
                    ? "Open WhatsApp again"
                    : "Notify store on WhatsApp"}
                  <ArrowRight className="h-4 w-4" />
                </button>

                {merchantNotified && (
                  <Notice type="info">
                    WhatsApp opened. A message is not proof of payment;
                    your order remains pending until the store verifies
                    the transaction.
                  </Notice>
                )}
              </div>

              <Notice type="info">
                Only pay the amount displayed in your UPI app after
                checking the recipient. Do not share your UPI PIN or
                OTP with anyone. Payment confirmation must come from
                the store's verification process.
              </Notice>

              <button
                type="button"
                onClick={resetCheckout}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/65 transition hover:bg-white/[0.05] hover:text-white"
              >
                <RefreshCw className="h-4 w-4" />
                Back to cart
              </button>
            </div>
          )}
        </div>

        {/* Footer is separate from the scrolling content */}
        {!order && normalizedItems.length > 0 && (
          <footer
            className="relative z-20 shrink-0 border-t border-white/[0.08] bg-[#090b12]/95 p-4 backdrop-blur-xl sm:p-6"
            style={{
              paddingBottom:
                "max(1rem, env(safe-area-inset-bottom))",
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm text-white/45">
                Payable total
              </span>

              <span className="text-xl font-black text-white tabular-nums">
                {formatINR(displayTotal)}
              </span>
            </div>

            <button
              type="button"
              onClick={startCheckout}
              disabled={checkoutLoading || normalizedItems.length === 0}
              className={[
                "flex w-full items-center justify-center gap-2",
                "rounded-xl bg-gradient-to-r from-cyan-400 to-sky-300",
                "px-4 py-4 text-sm font-black text-[#061019]",
                "shadow-[0_8px_30px_rgba(34,211,238,0.13)]",
                "transition duration-200 hover:brightness-110",
                "focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-cyan-200 focus-visible:ring-offset-2",
                "focus-visible:ring-offset-[#090b12]",
                "disabled:cursor-not-allowed disabled:opacity-50",
              ].join(" ")}
            >
              {checkoutLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Creating secure order...
                </>
              ) : (
                <>
                  Continue to payment
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>

            <p className="mt-3 text-center text-[10px] leading-4 text-white/30">
              Order totals and product availability must be verified
              by the server. Payment is not confirmed by opening UPI
              or sending a WhatsApp message.
            </p>
          </footer>
        )}
      </aside>
    </div>,
    document.body
  );
}

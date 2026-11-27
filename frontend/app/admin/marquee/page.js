"use client";

import { useCallback, useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { apiUrl } from "@/lib/api";
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  ArrowUp,
  TicketPercent,
  CalendarDays,
  Megaphone,
  RefreshCw,
  Plus,
  ToggleLeft,
  ToggleRight,
  Save,
} from "lucide-react";

const DEFAULT_CONFIG = {
  marqueeText: "Welcome to Nexus Gaming!",
};

const EMPTY_COUPON = {
  code: "",
  discountPercent: 10,
  lifetime: false,
  expiresAt: "",
};

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value) {
  if (!value) return "Lifetime";

  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !part)) {
    return "Invalid date";
  }

  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "Invalid date";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    if (response.status === 403) {
      throw new Error(
        "Access denied. Your account is not authorized to manage promotions."
      );
    }

    throw new Error(
      data.error || `Request failed with status ${response.status}.`
    );
  }

  return data;
}

async function authorizedFetch(user, url, options = {}) {
  if (!user) {
    throw new Error("Please sign in with your administrator account.");
  }

  const token = await user.getIdToken();

  return fetch(apiUrl(url), {
    ...options,
    cache: "no-store",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

export default function AdminMarquee() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [marqueeText, setMarqueeText] = useState(
    DEFAULT_CONFIG.marqueeText
  );
  const [coupons, setCoupons] = useState([]);
  const [couponForm, setCouponForm] = useState(EMPTY_COUPON);
  const [couponEdits, setCouponEdits] = useState({});

  const [loading, setLoading] = useState(true);
  const [savingMarquee, setSavingMarquee] = useState(false);
  const [creatingCoupon, setCreatingCoupon] = useState(false);
  const [busyCoupon, setBusyCoupon] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const auth = getAuth();

    return onAuthStateChanged(
      auth,
      (user) => {
        setFirebaseUser(user);
        setAuthReady(true);
      },
      (authError) => {
        console.error("Admin auth state failed:", authError);
        setFirebaseUser(null);
        setAuthReady(true);
      }
    );
  }, []);

  const loadData = useCallback(async () => {
    if (!authReady) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!firebaseUser) {
        throw new Error(
          "Your session is unavailable. Please sign in again."
        );
      }

      const [marqueeResponse, couponsResponse] = await Promise.all([
        authorizedFetch(firebaseUser, "/api/admin/marquee"),
        authorizedFetch(firebaseUser, "/api/admin/coupons"),
      ]);

      const marqueeData = await readResponse(marqueeResponse);
      const couponsData = await readResponse(couponsResponse);

      setMarqueeText(
        String(
          marqueeData.config?.marqueeText ||
            DEFAULT_CONFIG.marqueeText
        )
      );

      const loadedCoupons = Array.isArray(couponsData.coupons)
        ? couponsData.coupons
        : [];

      setCoupons(loadedCoupons);

      const edits = {};
      for (const coupon of loadedCoupons) {
        edits[coupon.code] = {
          discountPercent: String(coupon.discountPercent ?? 10),
          lifetime: Boolean(coupon.lifetime),
          expiresAt: coupon.expiresAt || "",
        };
      }
      setCouponEdits(edits);
    } catch (loadError) {
      console.error("Loading promotion data failed:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load promotion data."
      );
    } finally {
      setLoading(false);
    }
  }, [authReady, firebaseUser]);

  useEffect(() => {
    loadData();
  }, [loadData, reloadKey]);

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  async function saveMarquee(event) {
    event.preventDefault();
    if (savingMarquee) return;

    clearMessages();

    const cleanText = marqueeText.trim();

    if (!cleanText) {
      setError("Marquee text is required.");
      return;
    }

    if (cleanText.length > 200) {
      setError("Marquee text must be 200 characters or fewer.");
      return;
    }

    setSavingMarquee(true);

    try {
      const response = await authorizedFetch(
        firebaseUser,
        "/api/admin/marquee",
        {
          method: "PUT",
          body: JSON.stringify({ marqueeText: cleanText }),
        }
      );

      await readResponse(response);
      setMarqueeText(cleanText);
      setSuccess("Marquee text saved successfully.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save marquee text."
      );
    } finally {
      setSavingMarquee(false);
    }
  }

  async function createCoupon(event) {
    event.preventDefault();
    if (creatingCoupon) return;

    clearMessages();

    const code = couponForm.code.trim().toUpperCase();
    const discountPercent = Number(couponForm.discountPercent);
    const expiresAt = couponForm.expiresAt;

    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
      setError(
        "Coupon codes must contain 3–30 letters, numbers, hyphens, or underscores."
      );
      return;
    }

    if (
      !Number.isInteger(discountPercent) ||
      discountPercent < 1 ||
      discountPercent > 99
    ) {
      setError("Discount must be a whole number between 1 and 99.");
      return;
    }

    if (!couponForm.lifetime) {
      if (!isValidDateString(expiresAt)) {
        setError("Select a valid expiration date.");
        return;
      }

      if (expiresAt < localDateString()) {
        setError("Expiration date cannot be in the past.");
        return;
      }
    }

    setCreatingCoupon(true);

    try {
      const response = await authorizedFetch(
        firebaseUser,
        "/api/admin/coupons",
        {
          method: "POST",
          body: JSON.stringify({
            code,
            discountPercent,
            lifetime: couponForm.lifetime,
            expiresAt: couponForm.lifetime ? null : expiresAt,
          }),
        }
      );

      await readResponse(response);
      setCouponForm(EMPTY_COUPON);
      await loadData();
      setSuccess(`Coupon ${code} created successfully.`);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to create coupon."
      );
    } finally {
      setCreatingCoupon(false);
    }
  }

  function updateCouponEdit(code, patch) {
    setCouponEdits((previous) => ({
      ...previous,
      [code]: {
        ...previous[code],
        ...patch,
      },
    }));
    clearMessages();
  }

  async function patchCoupon(code, patch, successMessage) {
    if (busyCoupon) return;

    clearMessages();
    setBusyCoupon(code);

    try {
      const response = await authorizedFetch(
        firebaseUser,
        `/api/admin/coupons/${encodeURIComponent(code)}`,
        {
          method: "PATCH",
          body: JSON.stringify(patch),
        }
      );

      await readResponse(response);
      await loadData();
      setSuccess(successMessage);
    } catch (patchError) {
      setError(
        patchError instanceof Error
          ? patchError.message
          : "Unable to update coupon."
      );
    } finally {
      setBusyCoupon("");
    }
  }

  async function saveCouponEdits(coupon) {
    const edit = couponEdits[coupon.code];

    if (!edit) return;

    const discountPercent = Number(edit.discountPercent);

    if (
      !Number.isInteger(discountPercent) ||
      discountPercent < 1 ||
      discountPercent > 99
    ) {
      setError("Discount must be a whole number between 1 and 99.");
      return;
    }

    if (!edit.lifetime) {
      if (!isValidDateString(edit.expiresAt)) {
        setError("Select a valid expiration date.");
        return;
      }

      if (edit.expiresAt < localDateString()) {
        setError("Expiration date cannot be in the past.");
        return;
      }
    }

    const patch = {
      discountPercent,
      lifetime: Boolean(edit.lifetime),
    };

    if (!edit.lifetime) {
      patch.expiresAt = edit.expiresAt;
    }

    await patchCoupon(
      coupon.code,
      patch,
      `Coupon ${coupon.code} updated successfully.`
    );
  }

  if (!authReady || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-secondary">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-300" />
          <span>Loading promotion configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[80vh] overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(0,240,255,0.07),transparent_50%)]"
      />

      <div className="relative z-10 mx-auto max-w-6xl space-y-8 px-4 py-8 sm:py-12">
        <header>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-cyan-200">
            <TicketPercent className="h-4 w-4" />
            Store promotions
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Marquee & Multi-Coupon Engine
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-secondary sm:text-base">
            Manage storefront announcements and multiple independent
            coupon codes, including lifetime coupons.
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-400/25 bg-red-500/[0.08] p-4"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-red-300">
                Operation failed
              </p>
              <p className="mt-1 break-words text-sm text-red-200/90">
                {error}
              </p>
            </div>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.08] p-4"
          >
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <p className="text-sm font-medium text-emerald-200">
              {success}
            </p>
          </div>
        )}

        <section className="rounded-2xl border border-glass-border/70 bg-card/50 p-5 shadow-xl sm:p-7">
          <div className="mb-5 flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-cyan-300" />
            <h2 className="text-xl font-bold">Storefront marquee</h2>
          </div>

          <form onSubmit={saveMarquee} className="space-y-4">
            <label
              htmlFor="marqueeText"
              className="block text-sm font-semibold"
            >
              Announcement text
            </label>

            <textarea
              id="marqueeText"
              value={marqueeText}
              onChange={(event) => {
                setMarqueeText(event.target.value);
                clearMessages();
              }}
              maxLength={200}
              rows={3}
              required
              className="w-full resize-y rounded-xl border border-glass-border bg-black/20 px-4 py-3 text-primary outline-none focus:border-cyan-300/50"
              placeholder="Welcome to Nexus Gaming!"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-secondary">
                {marqueeText.length}/200 characters
              </p>

              <button
                type="submit"
                disabled={savingMarquee || !firebaseUser}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-sm font-bold text-cyan-100 transition hover:bg-cyan-300/20 disabled:opacity-50"
              >
                {savingMarquee ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save marquee
              </button>
            </div>
          </form>

          <div className="mt-5 rounded-xl border border-cyan-300/20 bg-gradient-to-r from-cyan-400/10 to-violet-400/10 p-4">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-cyan-300">
              Preview
            </p>
            <p className="break-words text-sm font-semibold">
              {marqueeText || "Your announcement appears here."}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-glass-border/70 bg-card/50 p-5 shadow-xl sm:p-7">
          <div className="mb-5 flex items-center gap-2">
            <Plus className="h-5 w-5 text-violet-300" />
            <h2 className="text-xl font-bold">Create a coupon</h2>
          </div>

          <form onSubmit={createCoupon} className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Coupon code
              <input
                value={couponForm.code}
                onChange={(event) => {
                  setCouponForm((previous) => ({
                    ...previous,
                    code: event.target.value.toUpperCase(),
                  }));
                  clearMessages();
                }}
                minLength={3}
                maxLength={30}
                pattern="[A-Za-z0-9_-]{3,30}"
                autoComplete="off"
                placeholder="GAMER25"
                required
                className="mt-2 w-full rounded-xl border border-glass-border bg-black/20 px-4 py-3 uppercase text-primary outline-none focus:border-cyan-300/50"
              />
            </label>

            <label className="block text-sm font-semibold">
              Discount percentage
              <input
                type="number"
                min={1}
                max={99}
                step={1}
                value={couponForm.discountPercent}
                onChange={(event) => {
                  setCouponForm((previous) => ({
                    ...previous,
                    discountPercent: event.target.value,
                  }));
                  clearMessages();
                }}
                required
                className="mt-2 w-full rounded-xl border border-glass-border bg-black/20 px-4 py-3 text-primary outline-none focus:border-cyan-300/50"
              />
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-glass-border p-3 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={couponForm.lifetime}
                onChange={(event) => {
                  setCouponForm((previous) => ({
                    ...previous,
                    lifetime: event.target.checked,
                  }));
                  clearMessages();
                }}
              />
              Lifetime coupon — never expires unless disabled
            </label>

            {!couponForm.lifetime && (
              <label className="block text-sm font-semibold sm:col-span-2">
                Expiration date
                <input
                  type="date"
                  min={localDateString()}
                  value={couponForm.expiresAt}
                  onChange={(event) => {
                    setCouponForm((previous) => ({
                      ...previous,
                      expiresAt: event.target.value,
                    }));
                    clearMessages();
                  }}
                  required
                  className="mt-2 w-full rounded-xl border border-glass-border bg-black/20 px-4 py-3 text-primary outline-none focus:border-cyan-300/50"
                />
                <span className="mt-1 block text-xs font-normal text-secondary">
                  Valid through the selected calendar date.
                </span>
              </label>
            )}

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={creatingCoupon || !firebaseUser}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-sm font-bold text-cyan-100 transition hover:bg-cyan-300/20 disabled:opacity-50"
              >
                {creatingCoupon ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Create coupon
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-glass-border/70 bg-card/50 p-5 shadow-xl sm:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Saved coupons</h2>
              <p className="mt-1 text-sm text-secondary">
                {coupons.length} saved coupon(s). Disabling a coupon
                preserves its record.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              className="inline-flex items-center gap-2 rounded-lg border border-glass-border px-3 py-2 text-sm font-semibold transition hover:bg-white/5"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          {coupons.length === 0 ? (
            <p className="rounded-xl border border-glass-border p-5 text-sm text-secondary">
              No coupons found. Create your first coupon above.
            </p>
          ) : (
            <div className="space-y-4">
              {coupons.map((coupon) => {
                const edit = couponEdits[coupon.code] || {
                  discountPercent: String(coupon.discountPercent ?? 10),
                  lifetime: Boolean(coupon.lifetime),
                  expiresAt: coupon.expiresAt || "",
                };

                const busy = busyCoupon === coupon.code;

                return (
                  <article
                    key={coupon.code}
                    className="rounded-xl border border-glass-border/70 bg-black/10 p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="break-all text-lg font-extrabold tracking-wider text-cyan-300">
                          {coupon.code}
                        </h3>
                        <p className="mt-1 text-sm text-secondary">
                          {coupon.discountPercent}% discount ·{" "}
                          {coupon.lifetime
                            ? "Lifetime"
                            : `Expires ${formatDisplayDate(coupon.expiresAt)}`}
                        </p>
                        <span
                          className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            coupon.isActive
                              ? "bg-emerald-400/10 text-emerald-300"
                              : "bg-amber-400/10 text-amber-300"
                          }`}
                        >
                          {coupon.isActive ? "Active" : "Disabled"}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={busy || Boolean(busyCoupon)}
                        onClick={() =>
                          patchCoupon(
                            coupon.code,
                            { isActive: !coupon.isActive },
                            `Coupon ${coupon.code} ${
                              coupon.isActive ? "disabled" : "enabled"
                            }.`
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-lg border border-glass-border px-3 py-2 text-sm font-semibold disabled:opacity-50"
                      >
                        {coupon.isActive ? (
                          <ToggleRight className="h-4 w-4" />
                        ) : (
                          <ToggleLeft className="h-4 w-4" />
                        )}
                        {busy ? "Saving..." : coupon.isActive ? "Disable" : "Enable"}
                      </button>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <label className="block text-xs font-semibold text-secondary">
                        Discount (%)
                        <input
                          type="number"
                          min={1}
                          max={99}
                          step={1}
                          value={edit.discountPercent}
                          onChange={(event) =>
                            updateCouponEdit(coupon.code, {
                              discountPercent: event.target.value,
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-glass-border bg-card px-3 py-2 text-sm text-primary"
                        />
                      </label>

                      <label className="flex items-center gap-2 text-xs font-semibold text-secondary">
                        <input
                          type="checkbox"
                          checked={Boolean(edit.lifetime)}
                          onChange={(event) =>
                            updateCouponEdit(coupon.code, {
                              lifetime: event.target.checked,
                            })
                          }
                        />
                        Lifetime coupon
                      </label>

                      <label className="block text-xs font-semibold text-secondary">
                        Expiration date
                        <input
                          type="date"
                          min={localDateString()}
                          value={edit.expiresAt || ""}
                          disabled={Boolean(edit.lifetime)}
                          onChange={(event) =>
                            updateCouponEdit(coupon.code, {
                              expiresAt: event.target.value,
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-glass-border bg-card px-3 py-2 text-sm text-primary disabled:opacity-50"
                        />
                      </label>
                    </div>

                    <button
                      type="button"
                      disabled={busy || Boolean(busyCoupon)}
                      onClick={() => saveCouponEdits(coupon)}
                      className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-300/10 px-4 py-2 text-sm font-bold text-cyan-100 transition hover:bg-cyan-300/20 disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save coupon changes
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Scroll to top"
        className="fixed bottom-6 right-6 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-cyan-300/20 bg-card text-cyan-200 shadow-lg transition hover:-translate-y-1 hover:bg-cyan-300/10"
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </div>
  );
}
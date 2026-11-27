
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
} from "lucide-react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
} from "firebase/firestore";
import { db } from "@/firebase";
import { useAuth } from "@/contexts/AuthContext";
import GameForm from "@/components/admin/GameForm";
import { apiUrl } from "@/lib/api";

const PAGE_SIZE = 50;

export default function AdminGames() {
  const { firebaseUser } = useAuth();

  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editGame, setEditGame] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [pageError, setPageError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  // Cursor-based pagination: no numeric offsets or full-catalog download.
  const [cursors, setCursors] = useState([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [nextCursor, setNextCursor] = useState(null);

  const currentCursor = cursors[pageIndex];

  const loadGames = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const gamesRef = collection(db, "games");

      let gamesQuery = query(
        gamesRef,
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE)
      );

      if (currentCursor) {
        gamesQuery = query(
          gamesRef,
          orderBy("createdAt", "desc"),
          startAfter(currentCursor),
          limit(PAGE_SIZE)
        );
      }

      const snapshot = await getDocs(gamesQuery);

      const gamesData = snapshot.docs.map((gameDoc) => ({
        id: gameDoc.id,
        ...gameDoc.data(),
      }));

      setGames(gamesData);
      setNextCursor(snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null);
      setHasNextPage(snapshot.docs.length === PAGE_SIZE);
    } catch (error) {
      console.error("Unable to load games:", error);
      setPageError(
        "Could not load games. Check your connection, Firestore permissions, and createdAt field."
      );
    } finally {
      setLoading(false);
    }
  }, [currentCursor, reloadKey]);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  const handleAddGame = () => {
    setEditGame({ id: null, isEditing: false });
  };

  const handleEditGame = (game) => {
    setEditGame({ ...game, isEditing: true });
  };

  const handleGameSaved = () => {
    // Refresh the current page after adding or editing a game.
    setEditGame(null);
    setReloadKey((value) => value + 1);
  };

  const handleStatusToggle = async (game, field) => {
    if (!firebaseUser || updatingId) return;

    setUpdatingId(`${game.id}:${field}`);
    setPageError("");

    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch(apiUrl("/api/admin/games"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          gameId: game.id,
          updates: { [field]: !Boolean(game[field]) },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || `Update failed (${response.status}).`);
      }
      setReloadKey((value) => value + 1);
    } catch (error) {
      console.error("Game status update failed:", error);
      setPageError(error instanceof Error ? error.message : "Could not update game status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteGame = async (gameId) => {
    if (
      !window.confirm(
        "Delete this game? This action cannot be undone."
      )
    ) {
      return;
    }

    if (!firebaseUser) {
      setPageError("Your session has expired. Sign in again.");
      return;
    }

    setDeletingId(gameId);
    setPageError("");

    try {
      const token = await firebaseUser.getIdToken();

      const response = await fetch(apiUrl("/api/admin/games"), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ gameId }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error || `Delete failed (${response.status}).`
        );
      }

      // Refresh Firestore results; no Firebase Storage calls are made.
      setReloadKey((value) => value + 1);
    } catch (error) {
      console.error("Error deleting game:", error);
      setPageError(
        `Could not delete game: ${
          error instanceof Error ? error.message : "Please retry."
        }`
      );
    } finally {
      setDeletingId(null);
    }
  };

  const goToNextPage = () => {
    if (!hasNextPage || games.length === 0) return;

    const lastGame = games[games.length - 1];

    // Reconstruct a Firestore DocumentSnapshot cursor from the last result
    // would require retaining the snapshot. The load routine below stores it.
    if (nextCursor) {
      setCursors((previous) => {
        const next = previous.slice(0, pageIndex + 1);
        next.push(nextCursor);
        return next;
      });
      setPageIndex((previous) => previous + 1);
    }
  };

  const goToPreviousPage = () => {
    if (pageIndex === 0) return;
    setPageIndex((previous) => previous - 1);
  };

  const filteredGames = games.filter((game) => {
    const searchableText =
      `${game.title || ""} ${game.category || ""}`.toLowerCase();

    return searchableText.includes(searchTerm.trim().toLowerCase());
  });

  const formatDate = (value) => {
    if (!value) return "—";

    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : value?.seconds
          ? new Date(value.seconds * 1000)
          : new Date(value);

    return Number.isNaN(date.getTime())
      ? "—"
      : date.toLocaleDateString();
  };

  return (
    <main className="min-h-[80vh] relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,var(--background)_0,var(--background)_30%,rgba(0,240,255,0.05)_70%)]" />

      <div className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-6 sm:py-8">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-accent">
              Game Manager
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Manage your game catalog.
            </p>
          </div>

          <button
            onClick={handleAddGame}
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-5 py-3 font-semibold text-cyan-200 transition hover:bg-cyan-300/20"
          >
            <Plus className="h-4 w-4" />
            Add New Game
          </button>
        </header>

        {pageError && (
          <div
            role="alert"
            className="mb-5 flex gap-3 rounded-xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-200"
          >
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{pageError}</span>
          </div>
        )}

        <label className="mb-5 flex items-center gap-3 rounded-xl border border-glass-border bg-card/50 px-4 py-3">
          <Search className="h-5 w-5 text-secondary" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search games on this page by title or category…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-secondary"
          />
        </label>

        {editGame && (
          <div
            className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/75 p-3 pt-16 backdrop-blur-sm sm:items-center sm:p-6 sm:pt-6"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setEditGame(null);
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={
                editGame.isEditing ? "Edit game" : "Add new game"
              }
              className="relative my-2 max-h-[calc(100dvh-5rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-glass-border bg-card p-4 shadow-2xl sm:p-6"
            >
              <GameForm
                game={editGame.isEditing ? editGame : null}
                onSave={handleGameSaved}
                onClose={() => setEditGame(null)}
                isEditing={editGame.isEditing}
              />
            </div>
          </div>
        )}

        {loading ? (
          <div
            className="space-y-4 py-10"
            role="status"
            aria-live="polite"
          >
            <div className="animate-pulse rounded-xl bg-white/5 p-8">
              Loading games…
            </div>
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="rounded-xl border border-glass-border bg-card/40 py-16 text-center">
            <p className="text-lg text-secondary">
              {games.length === 0
                ? "No games found on this page."
                : "No games on this page match your search."}
            </p>
            {games.length === 0 && pageIndex === 0 && (
              <button
                onClick={handleAddGame}
                className="mt-4 rounded-lg bg-accent/20 px-4 py-2 text-accent"
              >
                Add your first game
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredGames.map((game) => (
              <article
                key={game.id}
                className="glass rounded-xl border border-glass-border/50 p-4 transition-shadow hover:shadow-xl sm:p-6"
              >
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:gap-6">
                  <div className="h-24 w-24 shrink-0">
                    <img
                      src={game.imageUrl || "/placeholder-game.jpg"}
                      alt={`${game.title || "Game"} cover`}
                      loading="lazy"
                      className="h-full w-full rounded-lg object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 className="break-words text-lg font-semibold text-accent">
                        {game.title || "Untitled game"}
                      </h2>

                      <div className="flex flex-wrap gap-2 text-xs">
                        {game.featured && (
                          <span className="rounded bg-accent/20 px-2 py-1 text-accent">
                            Featured
                          </span>
                        )}
                        {game.draft && (
                          <span className="rounded bg-orange-500/20 px-2 py-1 text-orange-400">
                            Hidden
                          </span>
                        )}
                        {game.upcoming && (
                          <span className="rounded bg-sky-500/20 px-2 py-1 text-sky-300">
                            Upcoming
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="line-clamp-3 text-sm text-secondary">
                      {game.description || "No description"}
                    </p>

                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-medium">
                          ₹{Number(game.price || 0).toLocaleString("en-IN")}
                        </span>
                        <span className="text-secondary">
                          {game.category || "Uncategorized"}
                        </span>
                        <span className="text-secondary">
                          {game.stockCount ?? 0} in stock
                        </span>
                      </div>

                      <span className="text-xs text-secondary">
                        {formatDate(game.createdAt)}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => handleEditGame(game)}
                        className="flex-1 rounded-lg border border-accent/30 bg-accent/20 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/30"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusToggle(game, "draft")}
                        disabled={Boolean(updatingId)}
                        className="flex-1 rounded-lg border border-orange-400/30 bg-orange-400/10 px-4 py-2 text-sm font-medium text-orange-300 transition hover:bg-orange-400/20 disabled:opacity-50"
                      >
                        {updatingId === `${game.id}:draft` ? "Saving…" : game.draft ? "Show game" : "Hide game"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusToggle(game, "featured")}
                        disabled={Boolean(updatingId)}
                        className="flex-1 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-50"
                      >
                        {updatingId === `${game.id}:featured` ? "Saving…" : game.featured ? "Unfeature" : "Feature"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusToggle(game, "upcoming")}
                        disabled={Boolean(updatingId)}
                        className="flex-1 rounded-lg border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-200 transition hover:bg-sky-400/20 disabled:opacity-50"
                      >
                        {updatingId === `${game.id}:upcoming` ? "Saving…" : game.upcoming ? "Remove upcoming" : "Mark upcoming"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGame(game.id)}
                        disabled={deletingId === game.id}
                        className="flex-1 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === game.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <nav
          aria-label="Game pages"
          className="mt-6 flex items-center justify-between gap-3"
        >
          <button
            type="button"
            onClick={goToPreviousPage}
            disabled={loading || pageIndex === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-glass-border px-4 py-2 text-sm text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>

          <span className="text-sm text-secondary">
            Page {pageIndex + 1} · Up to {PAGE_SIZE} games per page
          </span>

          <button
            type="button"
            onClick={goToNextPage}
            disabled={loading || !hasNextPage}
            className="inline-flex items-center gap-2 rounded-lg border border-glass-border px-4 py-2 text-sm text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      </div>
    </main>
  );
}
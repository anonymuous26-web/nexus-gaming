"use client";

import { useEffect, useState } from "react";
import {
  onSnapshot,
  collection,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { Search } from "lucide-react";

import { db } from "@/firebase";
import { useCart } from "@/contexts/CartContext";
import GameCard from "@/components/GameCard";
import CartSlideout from "@/components/CartSlideout";
import MarqueeBanner from "@/components/MarqueeBanner";

export default function Home() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [gamesError, setGamesError] = useState(false);

  const {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
  } = useCart();

  // Fetch games in real time.
  // IMPORTANT: Hooks must run before any conditional return.
  useEffect(() => {
    let isMounted = true;

    setLoading(true);
    setGamesError(false);

    const gamesRef = collection(db, "games");
    const gamesQuery = query(
      gamesRef,
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      gamesQuery,
      (snapshot) => {
        if (!isMounted) return;

        const gamesData = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((game) => game.draft !== true && game.hidden !== true);

        setGames(gamesData);
        setLoading(false);
        setGamesError(false);
      },
      (error) => {
        console.error("Error fetching games:", error);

        if (!isMounted) return;

        setGamesError(true);
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Filter games based on search and category.
  const filteredGames = games.filter((game) => {
    const title = String(game.title || game.name || "");
    const category = String(game.category || "");

    const matchesSearch = title
      .toLowerCase()
      .includes(searchTerm.trim().toLowerCase());

    const matchesCategory =
      selectedCategory === "all" ||
      category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Preserve the original loading screen.
  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center py-12">
        <div className="h-6 w-48 mb-4 bg-accent/20 rounded-lg animate-pulse"></div>
        <div className="h-6 w-56 mb-2 bg-accent/20 rounded-lg animate-pulse"></div>
        <div className="h-6 w-40 bg-accent/20 rounded-lg animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] relative overflow-hidden">
      {/* Original animated background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--background)_0,_var(--background)_30%,rgba(0,240,255,0.05)_70%)]"></div>

        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width%3D%2260%22 height%3D%2260%22 viewBox%3D%220 0 60 60%22 xmlns%3D%22http://www.w3.org/2000/svg%22%3E%3Cg fill%3D%22none%22 fill-rule%3D%22evenodd%22%3E%3Cg fill%3D%22%2300F0FF%22 fill-opacity%3D%220.05%22%3E%3Ccircle cx%3D%2230%22 cy%3D%2230%22 r%3D%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]"></div>

        <div className="absolute inset-0 animate-[marquee_20s_linear_infinite] bg-[url('data:image/svg+xml,%3Csvg width%3D%22160%22 height%3D%2260%22 viewBox%3D%220 0 160 60%22 xmlns%3D%22http://www.w3.org/2000/svg%22%3E%3Cpath d%3D%22M0 30 Q 40 10 80 30 T 160 30 Z%22 stroke%3D%22%2300F0FF%22 stroke-width%3D%221%22 fill%3D%22none%22/%3E%3C/svg%3E')]"></div>
      </div>

      
<div className="relative z-10">

{/* Announcement marquee */}
<MarqueeBanner />

<div className="container mx-auto px-4 py-12">

  {/* Original header */}
  <div className="mb-12 text-center">
    <h1 className="text-4xl font-bold text-accent mb-4 relative inline-block">
      Nexus Gaming Marketplace


              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[120px] h-[4px] bg-gradient-to-r from-accent/0 via-accent to-accent/0 animate-[shine_3s_linear_infinite]"></span>
            </h1>

            <p className="text-xl text-secondary max-w-2xl mx-auto">
              Premium shared offline game accounts at unbeatable prices
            </p>
          </div>

          {/* Original search and filter layout */}
          <div className="mb-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Search bar */}
            <div className="relative group">
              <label className="block text-sm font-medium text-secondary mb-2">
                Search Games
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none group-hover:text-accent">
                  <Search className="h-4 w-4 text-secondary transition-colors duration-200" />
                </div>

                <input
                  type="text"
                  placeholder="Search games..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-card/70/80 border border-glass-border/50 rounded-xl text-primary placeholder-secondary/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/30 backdrop-blur-sm hover:bg-card/80/80 transition-all duration-300"
                />
              </div>
            </div>

            {/* Category filter */}
            <div className="relative group">
              <label className="block text-sm font-medium text-secondary mb-2">
                Category
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none group-hover:text-accent">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-secondary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 21V5a2 2 0 00-2-2H9a2 2 0 00-2 2v16"
                    />
                  </svg>
                </div>

                <select
                  value={selectedCategory}
                  onChange={(e) =>
                    setSelectedCategory(e.target.value)
                  }
                  className="w-full pl-10 pr-4 py-3 bg-card/70/80 border border-glass-border/50 rounded-xl text-primary placeholder-secondary/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/30 backdrop-blur-sm hover:bg-card/80/80 transition-all duration-300"
                >
                  <option value="all">All Categories</option>
                  <option value="Action">Action</option>
                  <option value="Adventure">Adventure</option>
                  <option value="RPG">RPG</option>
                  <option value="Sports">Sports</option>
                  <option value="Racing">Racing</option>
                  <option value="Strategy">Strategy</option>
                  <option value="Simulation">Simulation</option>
                  <option value="Indie">Indie</option>
                </select>
              </div>
            </div>

            {/* Original Featured Games badge */}
            <div className="flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center mb-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 22s8-4 8-10V5a3 3 0 00-3-3H8a3 3 0 00-3 3v7c0 6 8 10 8 10z"
                  />
                </svg>
              </div>

              <p className="text-sm text-accent font-medium">
                Featured Games
              </p>
            </div>
          </div>

          {/* Original game grid */}
          {gamesError ? (
            <div className="text-center py-16">
              <p className="text-lg text-secondary">
                Unable to load games. Please check your Firebase
                configuration and Firestore security rules.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-4 px-5 py-2 rounded-xl bg-accent/20 text-accent hover:bg-accent/30 transition-all duration-300"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredGames.map((game) => (
                <div key={game.id} className="relative group">
                  <GameCard
                    game={game}
                    onAddToCart={addToCart}
                    className="group-hover:-translate-y-2 group-hover:shadow-xl transition-all duration-300"
                  />

                  {/* Original animated accent lines */}
                  <div className="absolute -top-2 left-0 w-[calc(100%-1rem)] h-[2px] bg-gradient-to-r from-accent/0 via-accent/50 to-accent/0 group-hover:from-accent/20 group-hover:via-accent/80 group-hover:to-accent/20 transition-all duration-500"></div>

                  <div className="absolute -bottom-2 left-0 w-[calc(100%-1rem)] h-[2px] bg-gradient-to-r from-accent/0 via-accent/50 to-accent/0 group-hover:from-accent/20 group-hover:via-accent/80 group-hover:to-accent/20 transition-all duration-500"></div>
                </div>
              ))}
            </div>
          )}

          {/* Original empty state */}
          {!gamesError && filteredGames.length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-accent/50"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 11h6a2 2 0 012 2v2a2 2 0 01-2 2H9a2 2 0 01-2 2v-2z"
                  />
                </svg>
              </div>

              <p className="text-lg text-secondary">
                No games found matching your criteria.
              </p>

              <p className="text-sm text-secondary/60 mt-2">
                Try adjusting your search or category filters
              </p>
            </div>
          )}
        </div>

        {/* Original floating scroll-to-top button */}
        <div className="fixed bottom-6 right-6 flex items-center justify-center">
          <button
            type="button"
            aria-label="Scroll to top"
            onClick={() => {
              window.scrollTo({
                top: 0,
                behavior: "smooth",
              });
            }}
            className="w-12 h-12 bg-accent/20 text-accent flex items-center justify-center rounded-full hover:bg-accent/30 hover:text-white transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-1"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 10l7-7m0 0l7 7m-7-7v18"
              />
            </svg>
          </button>
        </div>

        {/* Original cart drawer */}
        <CartSlideout
          cartItems={cartItems}
          onRemoveFromCart={removeFromCart}
          onUpdateQuantity={updateQuantity}
        />
      </div>
    </div>
  );
}
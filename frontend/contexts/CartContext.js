
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { db } from '@/firebase';
import { useAuth } from '@/contexts/AuthContext';

import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

const CartContext = createContext(undefined);

const MAX_QUANTITY = 10;
const MAX_CART_LINES = 30;

function getGameId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeCart(items) {
  if (!Array.isArray(items)) return [];

  const normalized = [];
  const indexes = new Map();

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;

    const id = getGameId(item.id);
    if (!id || id.includes('/')) continue;

    const parsedQuantity = Number(item.quantity);
    const quantity = Number.isSafeInteger(parsedQuantity)
      ? parsedQuantity
      : 1;

    if (quantity < 1) continue;

    const parsedPrice = Number(item.price);
    const price =
      Number.isFinite(parsedPrice) && parsedPrice >= 0
        ? parsedPrice
        : 0;

    const existingIndex = indexes.get(id);

    if (existingIndex !== undefined) {
      const existing = normalized[existingIndex];
      existing.quantity = Math.min(
        MAX_QUANTITY,
        existing.quantity + quantity
      );
      continue;
    }

    if (normalized.length >= MAX_CART_LINES) continue;

    indexes.set(id, normalized.length);
    normalized.push({
      ...item,
      id,
      quantity: Math.min(quantity, MAX_QUANTITY),
      price,
    });
  }

  return normalized;
}

function addItem(items, game) {
  const id = getGameId(game?.id);

  if (!id || id.includes('/')) {
    throw new Error('A valid game ID is required.');
  }

  const existing = items.find((item) => item.id === id);

  if (existing) {
    if (existing.quantity >= MAX_QUANTITY) {
      throw new Error(
        `You can add a maximum of ${MAX_QUANTITY} copies of one game.`
      );
    }

    const stockCount = Number(game.stockCount);

    if (
      Number.isFinite(stockCount) &&
      stockCount >= 0 &&
      existing.quantity + 1 > stockCount
    ) {
      throw new Error('There is not enough stock for this quantity.');
    }

    return items.map((item) =>
      item.id === id
        ? { ...item, quantity: item.quantity + 1 }
        : item
    );
  }

  if (items.length >= MAX_CART_LINES) {
    throw new Error(
      `Your cart can contain a maximum of ${MAX_CART_LINES} different games.`
    );
  }

  if (game.available === false || game.inStock === false) {
    throw new Error('This game is currently unavailable.');
  }

  const stockCount = Number(game.stockCount);

  if (Number.isFinite(stockCount) && stockCount < 1) {
    throw new Error('This game is out of stock.');
  }

  const price = Number(game.price);

  if (!Number.isFinite(price) || price < 0) {
    throw new Error('This game has an invalid price.');
  }

  return [
    ...items,
    {
      ...game,
      id,
      price,
      quantity: 1,
    },
  ];
}

function validateCart(items) {
  if (!Array.isArray(items)) {
    throw new Error('Invalid cart data.');
  }

  if (items.length > MAX_CART_LINES) {
    throw new Error('Your cart contains too many different games.');
  }

  for (const item of items) {
    if (
      !item?.id ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > MAX_QUANTITY
    ) {
      throw new Error('Your cart contains an invalid item or quantity.');
    }
  }

  return items;
}

export function useCart() {
  const context = useContext(CartContext);

  if (context === undefined) {
    throw new Error(
      'useCart() must be used inside CartProvider. Check your layout provider hierarchy.'
    );
  }

  return context;
}

export function CartProvider({ children }) {
  const { currentUser, loading: authLoading } = useAuth();

  const [cartItems, setCartItems] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartError, setCartError] = useState(null);

  const userIdRef = useRef(null);
  const latestCartRef = useRef([]);
  const operationQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    latestCartRef.current = cartItems;
  }, [cartItems]);

  // Subscribe to the signed-in user's cart.
  useEffect(() => {
    if (authLoading) return undefined;

    let active = true;
    const userId = currentUser?.uid ?? null;

    userIdRef.current = userId;
    latestCartRef.current = [];
    setCartItems([]);
    setCartError(null);
    setIsInitialized(!userId);

    if (!userId) {
      return () => {
        active = false;
      };
    }

    const userRef = doc(db, 'users', userId);

    const unsubscribe = onSnapshot(
      userRef,
      async (snapshot) => {
        if (!active || userIdRef.current !== userId) return;

        try {
          if (!snapshot.exists()) {
            await setDoc(
              userRef,
              {
                uid: userId,
                cart: [],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );

            return;
          }

          const data = snapshot.data();
          const nextCart = normalizeCart(data.cart);

          if (!active || userIdRef.current !== userId) return;

          latestCartRef.current = nextCart;
          setCartItems(nextCart);
          setCartError(null);
        } catch (error) {
          console.error('Cart synchronization failed:', error);

          if (active) {
            setCartError('Unable to synchronize your cart.');
          }
        } finally {
          if (active) setIsInitialized(true);
        }
      },
      (error) => {
        console.error('Cart listener failed:', error);

        if (active) {
          setCartError(
            'Unable to load your cart. Check your connection and permissions.'
          );
          setIsInitialized(true);
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [currentUser?.uid, authLoading]);

  // Serialize this client's cart writes to prevent overlapping operations.
  const enqueueCartOperation = useCallback((operation) => {
    const nextOperation = operationQueueRef.current.then(
      operation,
      operation
    );

    operationQueueRef.current = nextOperation.catch(() => {});
    return nextOperation;
  }, []);

  // Persist an update transactionally using the latest database cart.
  const persistCart = useCallback(
    async (userId, transform) => {
      return enqueueCartOperation(async () => {
        if (userIdRef.current !== userId) {
          throw new Error('Your account changed. Please try again.');
        }

        const userRef = doc(db, 'users', userId);

        const nextCart = await runTransaction(db, async (transaction) => {
          const snapshot = await transaction.get(userRef);

          if (!snapshot.exists()) {
            throw new Error('Your user profile could not be found.');
          }

          const existingCart = normalizeCart(snapshot.data().cart);
          const updatedCart = validateCart(
            normalizeCart(transform(existingCart))
          );

          transaction.update(userRef, {
            cart: updatedCart,
            updatedAt: serverTimestamp(),
          });

          return updatedCart;
        });

        if (userIdRef.current === userId) {
          latestCartRef.current = nextCart;
          setCartItems(nextCart);
        }

        return nextCart;
      });
    },
    [enqueueCartOperation]
  );

  const addToCart = useCallback(
    async (game) => {
      if (!game?.id || typeof game.id !== 'string') {
        throw new Error('A valid game ID is required.');
      }

      const userId = currentUser?.uid;

      if (!userId) {
        const nextCart = addItem(
          normalizeCart(latestCartRef.current),
          game
        );

        latestCartRef.current = nextCart;
        setCartItems(nextCart);
        return nextCart;
      }

      setCartError(null);

      try {
        return await persistCart(userId, (items) =>
          addItem(items, game)
        );
      } catch (error) {
        setCartError(error?.message || 'Unable to add this game.');
        throw error;
      }
    },
    [currentUser?.uid, persistCart]
  );

  const removeFromCart = useCallback(
    async (gameId) => {
      const id = getGameId(gameId);
      if (!id) return;

      const userId = currentUser?.uid;

      if (!userId) {
        const nextCart = latestCartRef.current.filter(
          (item) => item.id !== id
        );

        latestCartRef.current = nextCart;
        setCartItems(nextCart);
        return nextCart;
      }

      setCartError(null);

      try {
        return await persistCart(userId, (items) =>
          items.filter((item) => item.id !== id)
        );
      } catch (error) {
        setCartError(error?.message || 'Unable to remove this game.');
        throw error;
      }
    },
    [currentUser?.uid, persistCart]
  );

  // amount is a delta: +1 increments, -1 decrements.
  const updateQuantity = useCallback(
    async (gameId, amount) => {
      const id = getGameId(gameId);
      const delta = Number(amount);

      if (
        !id ||
        !Number.isSafeInteger(delta) ||
        delta === 0
      ) {
        return;
      }

      const userId = currentUser?.uid;

      const transform = (items) => {
        const existing = items.find((item) => item.id === id);

        if (!existing) return items;

        const nextQuantity = existing.quantity + delta;

        if (nextQuantity > MAX_QUANTITY) {
          throw new Error(
            `You can add a maximum of ${MAX_QUANTITY} copies of one game.`
          );
        }

        // Quantity zero removes the item from the cart.
        if (nextQuantity <= 0) {
          return items.filter((item) => item.id !== id);
        }

        return items.map((item) =>
          item.id === id
            ? { ...item, quantity: nextQuantity }
            : item
        );
      };

      if (!userId) {
        try {
          const nextCart = validateCart(
            normalizeCart(transform(normalizeCart(latestCartRef.current)))
          );

          latestCartRef.current = nextCart;
          setCartItems(nextCart);
          setCartError(null);
          return nextCart;
        } catch (error) {
          setCartError(error?.message || 'Unable to update quantity.');
          throw error;
        }
      }

      setCartError(null);

      try {
        return await persistCart(userId, transform);
      } catch (error) {
        setCartError(error?.message || 'Unable to update quantity.');
        throw error;
      }
    },
    [currentUser?.uid, persistCart]
  );

  const clearCart = useCallback(async () => {
    const userId = currentUser?.uid;

    if (!userId) {
      latestCartRef.current = [];
      setCartItems([]);
      setCartError(null);
      return [];
    }

    setCartError(null);

    try {
      return await persistCart(userId, () => []);
    } catch (error) {
      setCartError(error?.message || 'Unable to clear your cart.');
      throw error;
    }
  }, [currentUser?.uid, persistCart]);

  // Records purchase history only. This does not verify payment.
  const purchaseCart = useCallback(async () => {
    const userId = currentUser?.uid;

    if (!userId) {
      setCartError('Please sign in before completing your purchase.');
      return false;
    }

    try {
      const result = await enqueueCartOperation(async () => {
        if (userIdRef.current !== userId) {
          throw new Error('Your account changed. Please try again.');
        }

        const userRef = doc(db, 'users', userId);
        const purchaseRef = doc(db, 'games_purchased', userId);

        const result = await runTransaction(db, async (transaction) => {
          const userSnapshot = await transaction.get(userRef);
          const purchaseSnapshot = await transaction.get(purchaseRef);

          if (!userSnapshot.exists()) {
            throw new Error('User profile not found.');
          }

          const currentCart = validateCart(
            normalizeCart(userSnapshot.data().cart)
          );

          if (currentCart.length === 0) {
            throw new Error('Your cart is empty.');
          }

          const totalAmount = currentCart.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          );

          const history = purchaseSnapshot.exists()
            ? purchaseSnapshot.data().purchaseHistory || []
            : [];

          const purchaseRecord = {
            items: currentCart,
            purchaseDate: new Date(),
            totalAmount,
          };

          transaction.set(
            purchaseRef,
            {
              uid: userId,
              purchaseHistory: [...history, purchaseRecord],
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          transaction.update(userRef, {
            cart: [],
            updatedAt: serverTimestamp(),
          });

          return true;
        });

        if (userIdRef.current === userId) {
          latestCartRef.current = [];
          setCartItems([]);
        }

        return result;
      });

      setCartError(null);
      return result;
    } catch (error) {
      console.error('Purchase history recording failed:', error);
      setCartError(
        error?.message || 'Unable to record the purchase.'
      );
      return false;
    }
  }, [currentUser?.uid, enqueueCartOperation]);

  const totalItems = useMemo(
    () =>
      cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const totalPrice = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      ),
    [cartItems]
  );

  const value = useMemo(
    () => ({
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      purchaseCart,
      totalItems,
      totalPrice,
      isInitialized,
      isCartOpen,
      setIsCartOpen,
      cartError,
    }),
    [
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      purchaseCart,
      totalItems,
      totalPrice,
      isInitialized,
      isCartOpen,
      cartError,
    ]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

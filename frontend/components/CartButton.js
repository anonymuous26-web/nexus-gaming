
'use client';

import { useCart } from '@/contexts/CartContext';
import { ShoppingCart } from 'lucide-react';

export default function CartButton({ onClick }) {
  const { totalItems } = useCart();

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        className="p-2 rounded hover:bg-accent/20 transition-all duration-200 transform hover:scale-105"
        aria-label={`View cart, ${totalItems} items`}
      >
        <ShoppingCart className="h-5 w-5 text-secondary" />

        {/* Cart count badge */}
        <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center bg-accent text-xs text-white rounded-full">
          {totalItems}
        </div>
      </button>
    </div>
  );
}

"use client";

import { db } from '@/firebase';
import { updateDoc, doc } from 'firebase/firestore';
import { CheckCircle, AlertTriangle } from 'lucide-react';

export default function RecentOrders({ orders }) {
  if (!orders || orders.length === 0) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center py-12">
        <div className="w-20 h-20 mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-accent/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" animate-pulse>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 11h6a2 2 0 012 2v2a2 2 0 01-2 2H9a2 2 0 01-2-2v-2z" />
          </svg>
        </div>
        <p className="text-secondary text-center">
          No recent orders
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="font-semibold mb-4 text-accent group hover:-translate-y-1 transition-transform duration-200">
        Recent Orders
      </h3>
      <div className="space-y-4">
        {orders.map((order, index) => (
          <div
            key={order.id}
            className={`p-4 bg-card/50 glass rounded-xl border border-glass-border/50
              group-hover:-translate-y-2 group-hover:shadow-xl transition-all duration-300
              ${index % 2 === 0 ? '' : 'translate-y-1'}`}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h4 className="font-medium text-accent group hover:text-accent/80 transition-colors duration-200">
                  Order #{order.orderId}
                </h4>
                <p className="text-sm text-secondary">
                  {new Date(order.createdAt.seconds * 1000).toLocaleDateString()}
                </p>
              </div>
              <div className="text-xs px-3 py-1.5 rounded-full ${
                order.status === 'Pending'
                  ? 'bg-accent/20 text-accent'
                  : order.status === 'Verified'
                    ? 'bg-green-500/20 text-green-400'
                    : order.status === 'Rejected'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-orange-500/20 text-orange-400'
              } group hover:-translate-y-1 transition-transform duration-200">
                {order.status}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="font-medium text-secondary mb-1">Items:</p>
                <p className="text-secondary">
                  {order.items?.length || 0} item${order.items?.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div>
                <p className="font-medium text-secondary mb-1">Amount:</p>
                <p className="text-accent font-bold">
                  ₹{order.totalAmount}
                </p>
              </div>
            </div>
            {order.status === 'Pending' && (
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => updateOrderStatus(order.id, 'Verified')}
                  className="flex-1 px-4 py-2 bg-green-500/20 text-green-400 flex items-center justify-center gap-2
                    border border-green-500/30 rounded text-sm font-medium transition-all duration-200
                    hover:bg-green-500/30 hover:text-white transform hover:scale-105"
                >
                  <CheckCircle className="h-4 w-4" />
                  Verify
                </button>
                <button
                  onClick={() => updateOrderStatus(order.id, 'Rejected')}
                  className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 flex items-center justify-center gap-2
                    border border-red-500/30 rounded text-sm font-medium transition-all duration-200
                    hover:bg-red-500/30 hover:text-white transform hover:scale-105"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Firebase functions for updating order status
async function updateOrderStatus(orderId, status) {
  try {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, {
      status,
      updatedAt: new Date()
    });
    // The onSnapshot in the parent component will automatically update
  } catch (error) {
    console.error('Error updating order status:', error);
    alert('Failed to update order status');
  }
}
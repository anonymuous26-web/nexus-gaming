# Firebase Firestore Schema for Nexus Gaming Marketplace

## Collections Structure

### 1. `users` Collection
Stores user profile and wishlist data.

| Field | Type | Description |
|-------|------|-------------|
| `uid` | string | Firebase Authentication UID (Primary Key) |
| `email` | string | User's email address |
| `displayName` | string | User's display name (from Google) |
| `photoURL` | string | User's profile picture URL |
| `wishlist` | array<string> | Array of game IDs that the user has wishlisted |
| `createdAt` | timestamp | Account creation timestamp |
| `updatedAt` | timestamp | Last profile update timestamp |

### 2. `games` Collection
Stores all available game listings.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Document ID (auto-generated) |
| `title` | string | Game title |
| `description` | string | Detailed game description |
| `price` | number | Price in currency units (e.g., INR) |
| `imageUrl` | string | Firebase Storage URL for game cover image |
| `category` | string | Game category (e.g., "Action", "RPG", "Sports") |
| `stockCount` | number | Available copies for sale |
| `featured` | boolean | Whether game appears in featured section |
| `draft` | boolean | Whether game is hidden from public view |
| `createdAt` | timestamp | Game listing creation timestamp |
| `updatedAt` | timestamp | Last game update timestamp |

**Indexes Needed:**
- Composite index: `category` (asc), `featured` (desc), `stockCount` (desc)
- Composite index: `price` (asc), `stockCount` (desc)

### 3. `orders` Collection
Stores all customer orders with payment tracking.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Document ID (auto-generated) |
| `userId` | string | Reference to `users.uid` |
| `gameId` | string | Reference to `games.id` |
| `quantity` | number | Number of copies purchased |
| `totalAmount` | number | Final amount paid after discounts |
| `paymentId` | string | Custom-generated payment ID (e.g., "PAY_12345") |
| `orderId` | string | Custom-generated order ID (e.g., "ORD_67890") |
| `status` | string | Order status: "Pending", "Verified", or "Rejected" |
| `promoCodeUsed` | string | Coupon code applied (nullable) |
| `discountAmount` | number | Discount amount applied (default: 0) |
| `expiresAt` | timestamp | 3-minute payment window expiration |
| `createdAt` | timestamp | Order creation timestamp |
| `updatedAt` | timestamp | Last status update timestamp |

**Indexes Needed:**
- Composite index: `userId` (asc), `createdAt` (desc)
- Composite index: `status` (asc), `createdAt` (desc)
- Single field index: `expiresAt` (asc) for cleanup jobs

### 4. `config` Collection (Singleton Document)
Stores global site configuration like marquee and coupon settings.
*Note: Only one document should exist in this collection.*

| Field | Type | Description |
|-------|------|-------------|
| `marqueeText` | string | Scrolling message displayed in marquee |
| `couponCode` | string | Active coupon code for discounts |
| `expiresAt` | timestamp | Exact expiration timestamp for coupon |
| `updatedAt` | timestamp | Last configuration update timestamp |

**Usage Notes:**
- Admin updates this document to change marquee/coupon
- Frontend reads this document on app load and subscribes to real-time updates
- Cart validation checks `Date.now() > expiresAt` to reject expired coupons

## Security Rules Recommendations

### Users Collection
```
allow read, update: if request.auth != null && request.auth.uid == resource.data.uid;
allow create: if request.auth != null;
```

### Games Collection
```
allow read: if true;  // Public read access
allow create, update, delete: if request.auth != null && isAdmin(request.auth.token);
```

### Orders Collection
```
allow create: if request.auth != null;
allow read, update: if request.auth != null && 
    (request.auth.uid == resource.data.userId || 
     isAdmin(request.auth.token));
```

### Config Collection
```
allow read: if true;
allow create, update, delete: if request.auth != null && isAdmin(request.auth.token);
```

## Data Validation Guidelines

1. **Games:**
   - `price` must be >= 0
   - `stockCount` must be >= 0
   - `title` and `description` required
   - `imageUrl` must be valid Firebase Storage URL

2. **Orders:**
   - `quantity` must be >= 1
   - `totalAmount` must be >= 0
   - `paymentId` and `orderId` must follow custom format
   - `status` must be one of: "Pending", "Verified", "Rejected"
   - `expiresAt` must be > `createdAt`

3. **Config:**
   - `expiresAt` must be in future when setting active coupon
   - `marqueeText` recommended length < 200 characters
   - `couponCode` recommended format: alphanumeric, 3-10 chars

## Relationships

- `orders.userId` → `users.uid`
- `orders.gameId` → `games.id`
- `users.wishlist` contains references to `games.id`

## Recommended Firestore Indexes

For optimal query performance, create these composite indexes:

1. **Games Query:** `category` (asc), `featured` (desc), `stockCount` (desc)
2. **Games Sorting:** `price` (asc), `stockCount` (desc)
3. **User Orders:** `userId` (asc), `createdAt` (desc)
4. **Admin Orders:** `status` (asc), `createdAt` (desc)
5. **Payment Cleanup:** `expiresAt` (asc)

## Storage Structure (Firebase Storage)

### Game Images
```
games/
  {gameId}/
    cover.jpg
    screenshot1.jpg
    screenshot2.jpg
```

### Rules for Storage
```
allow read: if true;
allow write: if request.auth != null && isAdmin(request.auth.token);
```

## Initial Data Setup

### Config Document (Initial)
```json
{
  "marqueeText": "Welcome to Nexus Gaming! Use code WELCOME10 for 10% off your first purchase!",
  "couponCode": "WELCOME10",
  "expiresAt": "2026-12-31T23:59:59.000Z",
  "updatedAt": "{SERVER_TIMESTAMP}"
}
```

### Sample Game Document
```json
{
  "title": "Grand Theft Auto V",
  "description": "Open-world action-adventure game set in the fictional state of San Andreas.",
  "price": 1499,
  "imageUrl": "gs://nexus-gaming.appspot.com/games/gta5/cover.jpg",
  "category": "Action",
  "stockCount": 12,
  "featured": true,
  "draft": false,
  "createdAt": "{SERVER_TIMESTAMP}",
  "updatedAt": "{SERVER_TIMESTAMP}"
}
```
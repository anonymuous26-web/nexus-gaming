# Nexus Gaming Marketplace

## Product Overview
Nexus Gaming Marketplace is a premium digital gaming platform for shared offline game accounts. Users can browse, purchase, and manage game collections through a modern web interface with real-time updates, secure authentication, and integrated AI chat support.

## Core Features
- **Game Catalog**: Browse featured games with filtering by category and search
- **Authentication**: Google sign-in with Firebase Auth
- **Shopping Cart**: Add/remove games, apply promo codes, proceed to payment
- **Wishlist System**: Save games for later viewing
- **AI Chat Support**: Integrated Gemini-powered chatbot for assistance
- **Admin Dashboard**: Manage games, orders, marquee announcements, and coupons
- **Order Management**: View order history, payment tracking via UPI/WhatsApp
- **Real-time Updates**: Firestore synchronization for live data
- **Responsive Design**: Mobile-friendly interface with adaptive layouts

## Target Audience
- Gamers looking for affordable access to premium game titles
- Users interested in shared/offline game accounts
- Casual and hardcore gamers seeking value purchases
- Tech-savvy consumers comfortable with digital marketplaces

## Key User Journeys
1. **Browsing & Discovery**: Visit homepage → Filter/search games → View game details
2. **Purchase Flow**: Add to cart → Apply promo code → Proceed to payment → Complete via UPI/WhatsApp
3. **Wishlist Management**: Add games to wishlist → View saved games → Remove or purchase later
4. **Authentication**: Sign in with Google → Access personalized features → Secure checkout
5. **Admin Operations**: Login as admin → Manage game inventory → Monitor orders → Update site announcements

## Technical Stack
- **Frontend**: Next.js 13+ (App Router), React, Tailwind CSS
- **Backend**: Firebase Firestore (database), Firebase Auth (authentication), Firebase Storage (file storage)
- **AI Integration**: Google Gemini API (chatbot)
- **State Management**: React Context (Auth, Cart)
- **UI Components**: Custom UI with shadcn.ai inspiration, Lucide React icons
- **Payment**: Manual UPI flow with WhatsApp verification

## Design Principles
- Clean, modern interface with gaming aesthetic
- Intuitive navigation and clear visual hierarchy
- Consistent component usage and styling
- Responsive design for mobile and desktop experiences
- Accessibility considerations (color contrast, keyboard navigation)
- Performance optimized with real-time updates and efficient data fetching

## Success Metrics
- User engagement (time on site, pages per visit)
- Conversion rate (visitors to purchasers)
- User retention and repeat visits
- Wishlist utilization and conversion to sales
- Positive user feedback and support interactions
- Admin efficiency in managing inventory and orders
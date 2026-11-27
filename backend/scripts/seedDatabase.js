import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import admin from "firebase-admin";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";

const serviceAccountPath = path.resolve(
  process.cwd(),
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "./serviceAccountKey.json"
);
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = getFirestore();

async function seedDatabase() {
  try {
    console.log("Starting database seeding...");

    const configRef = db.collection("config").doc("main");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await configRef.set({
      marqueeText: "Check out our latest gaming deals!",
      promoCode: "WELCOME10",
      expiresAt: Timestamp.fromDate(tomorrow),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log("✓ Config document created");

    const gamesRef = db.collection("games");

    await gamesRef.doc().set({
      title: "Cyberpunk 2077",
      description:
        "An open-world, action-adventure story set in Night City, a megalopolis obsessed with power, glamour and body modification.",
      price: 29.99,
      stockCount: 15,
      coverImage:
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Y3J5YmVwdW5rfGVufDB8fDB8fHww&auto=format&fit=crop&w=500&q=60",
      isFeatured: true,
      category: "RPG",
      createdAt: Timestamp.fromDate(
        new Date(Date.now() - 24 * 60 * 60 * 1000)
      ),
    });
    console.log("✓ Game 1 created (Cyberpunk 2077)");

    await gamesRef.doc().set({
      title: "FIFA 23",
      description:
        "The latest installment in the FIFA series with enhanced gameplay and realistic football simulation.",
      price: 39.99,
      stockCount: 10,
      coverImage:
        "https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8ZmFmYXxlbnwwfHwwfHx8MXw&auto=format&fit=crop&w=500&q=60",
      isFeatured: false,
      category: "Sports",
      createdAt: Timestamp.fromDate(new Date()),
    });
    console.log("✓ Game 2 created (FIFA 23)");

    console.log("🎉 Database seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

seedDatabase();

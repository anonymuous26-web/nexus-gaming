
"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl } from "@/lib/api";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const EMPTY_FORM = {
  title: "",
  description: "",
  price: "",
  imageUrl: "",
  category: "",
  stockCount: "",
  featured: false,
  draft: false,
  upcoming: false,
};

export default function GameForm({
  game,
  onSave,
  onClose,
  isEditing,
}) {
  const { firebaseUser } = useAuth();

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fileInputRef = useRef(null);
  const previewObjectUrlRef = useRef(null);

  useEffect(() => {
    if (game && isEditing) {
      setFormData({
        title: game.title || "",
        description: game.description || "",
        price:
          game.price !== undefined && game.price !== null
            ? String(game.price)
            : "",
        imageUrl: game.imageUrl || "",
        category: game.category || "",
        stockCount:
          game.stockCount !== undefined && game.stockCount !== null
            ? String(game.stockCount)
            : "",
        featured: Boolean(game.featured),
        draft: Boolean(game.draft),
        upcoming: Boolean(game.upcoming),
      });

      setImagePreview(game.imageUrl || null);
    } else {
      setFormData(EMPTY_FORM);
      setImagePreview(null);
    }

    setError("");
    setSuccess("");
  }, [game, isEditing]);

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    };
  }, []);

  const updateField = (field, value) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const setLocalPreview = (file) => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    previewObjectUrlRef.current = objectUrl;
    setImagePreview(objectUrl);
  };

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];

    // Allow selecting the same file again after a failed upload.
    event.target.value = "";

    if (!file) return;

    setError("");
    setSuccess("");

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size <= 0 || file.size > MAX_IMAGE_SIZE) {
      setError("The image must be larger than 0 bytes and no larger than 5 MB.");
      return;
    }

    setLocalPreview(file);
    updateField("imageUrl", "");

    await handleImageUpload(file);
  };

  const handleImageUpload = async (file) => {
    if (!firebaseUser) {
      setError("Your session has expired. Sign in again.");
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      const token = await firebaseUser.getIdToken();

      const signatureResponse = await fetch(
        apiUrl("/api/admin/cloudinary-signature"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
          body: JSON.stringify({
            size: file.size,
            format: file.name.split(".").pop()?.toLowerCase(),
          }),
        }
      );

      const signature = await signatureResponse.json().catch(() => ({}));

      if (!signatureResponse.ok) {
        throw new Error(
          signature.error || "Could not authorize the image upload."
        );
      }

      const {
        cloudName,
        apiKey,
        timestamp,
        publicId,
        signature: uploadSignature,
      } = signature;

      if (
        !cloudName ||
        !apiKey ||
        !timestamp ||
        !publicId ||
        !uploadSignature
      ) {
        throw new Error("The upload authorization response is incomplete.");
      }

      const uploadBody = new FormData();
      uploadBody.append("file", file);
      uploadBody.append("api_key", apiKey);
      uploadBody.append("timestamp", String(timestamp));
      uploadBody.append("public_id", publicId);
      uploadBody.append("signature", uploadSignature);

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(
          cloudName
        )}/image/upload`,
        {
          method: "POST",
          body: uploadBody,
        }
      );

      const uploaded = await uploadResponse.json().catch(() => ({}));

      if (!uploadResponse.ok) {
        throw new Error(
          uploaded.error?.message || "Cloudinary image upload failed."
        );
      }

      if (
        typeof uploaded.secure_url !== "string" ||
        !uploaded.secure_url.startsWith("https://res.cloudinary.com/")
      ) {
        throw new Error("Cloudinary returned an invalid image URL.");
      }

      updateField("imageUrl", uploaded.secure_url);
      setImagePreview(uploaded.secure_url);
      setSuccess("Image uploaded successfully to Cloudinary.");
    } catch (uploadError) {
      console.error("Cloudinary upload error:", uploadError);

      updateField("imageUrl", "");

      // If editing an existing game, restore its previous saved image.
      if (isEditing && game?.imageUrl) {
        setImagePreview(game.imageUrl);
      }

      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Image upload failed. Please try again."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving || uploading) {
      setError("Wait for the current operation to finish.");
      return;
    }

    setError("");
    setSuccess("");

    const title = formData.title.trim();
    const description = formData.description.trim();
    const category = formData.category.trim();
    const price = Number(formData.price);
    const stockCount = Number(formData.stockCount);
    const imageUrl = formData.imageUrl || (isEditing ? game?.imageUrl : "");

    if (!title) {
      setError("Game title is required.");
      return;
    }

    if (!description) {
      setError("Game description is required.");
      return;
    }

    if (
      formData.price.trim() === "" ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      setError("Enter a valid non-negative price.");
      return;
    }

    if (!category) {
      setError("Please select a category.");
      return;
    }

    if (
      formData.stockCount.trim() === "" ||
      !Number.isSafeInteger(stockCount) ||
      stockCount < 0
    ) {
      setError("Stock count must be a non-negative whole number.");
      return;
    }

    if (!imageUrl) {
      setError("Upload a game cover image before saving.");
      return;
    }

    if (!firebaseUser) {
      setError("Your session has expired. Sign in again.");
      return;
    }

    if (isEditing && !game?.id) {
      setError("The game ID is missing. Close the form and try again.");
      return;
    }

    setSaving(true);

    try {
      const gameData = {
        title,
        description,
        price,
        imageUrl,
        category,
        stockCount,
        featured: Boolean(formData.featured),
        draft: Boolean(formData.draft),
        upcoming: Boolean(formData.upcoming),
        updatedAt: new Date().toISOString(),
      };

      if (!isEditing) {
        gameData.createdAt = new Date().toISOString();
      }

      const token = await firebaseUser.getIdToken();

      const response = await fetch(apiUrl("/api/admin/games"), {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(
          isEditing
            ? { gameId: game.id, game: gameData }
            : { game: gameData }
        ),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error || `Could not save game (${response.status}).`
        );
      }

      setSuccess(
        isEditing ? "Game updated successfully!" : "Game added successfully!"
      );

      if (!isEditing) {
        setFormData(EMPTY_FORM);
        setImagePreview(null);

        if (previewObjectUrlRef.current) {
          URL.revokeObjectURL(previewObjectUrlRef.current);
          previewObjectUrlRef.current = null;
        }
      }

      // Close only after the API confirms success.
      onSave?.();
      onClose?.();
    } catch (saveError) {
      console.error("Game save error:", saveError);

      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save the game. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-accent">
          {isEditing ? "Edit Game" : "Add New Game"}
        </h2>

        <button
          type="button"
          onClick={onClose}
          disabled={saving || uploading}
          className="rounded-lg px-3 py-2 text-sm text-secondary hover:bg-white/10 disabled:opacity-50"
        >
          Close
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        aria-busy={uploading || saving}
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-secondary">
            Game Title
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(event) => updateField("title", event.target.value)}
            placeholder="Enter game title"
            className="w-full rounded-lg border border-glass-border bg-card/50 px-3 py-2 text-primary"
            maxLength={200}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-secondary">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(event) =>
              updateField("description", event.target.value)
            }
            placeholder="Describe the game..."
            rows={4}
            maxLength={10000}
            className="w-full rounded-lg border border-glass-border bg-card/50 px-3 py-2 text-primary"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-secondary">
            Price (₹)
          </label>
          <input
            type="number"
            value={formData.price}
            onChange={(event) => updateField("price", event.target.value)}
            min="0"
            step="0.01"
            placeholder="Enter price"
            className="w-full rounded-lg border border-glass-border bg-card/50 px-3 py-2 text-primary"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-secondary">
            Category
          </label>
          <select
            value={formData.category}
            onChange={(event) => updateField("category", event.target.value)}
            className="w-full rounded-lg border border-glass-border bg-card/50 px-3 py-2 text-primary"
            required
          >
            <option value="">Select a category</option>
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

        <div>
          <label className="mb-1 block text-sm font-medium text-secondary">
            Stock Count
          </label>
          <input
            type="number"
            value={formData.stockCount}
            onChange={(event) =>
              updateField("stockCount", event.target.value)
            }
            min="0"
            step="1"
            placeholder="Enter stock count"
            className="w-full rounded-lg border border-glass-border bg-card/50 px-3 py-2 text-primary"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-secondary">
            Game Cover Image
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageChange}
            className="block w-full text-sm text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-accent/20 file:px-4 file:py-2 file:text-accent"
          />

          <p className="mt-1 text-xs text-secondary">
            JPG, PNG, or WebP · Maximum 5 MB
          </p>

          {uploading && (
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"
              role="status"
              aria-live="polite"
            >
              <div className="h-full w-2/3 animate-pulse rounded-full bg-accent" />
              <p className="mt-2 text-sm text-secondary">
                Uploading image to Cloudinary…
              </p>
            </div>
          )}

          {imagePreview && (
            <div className="mt-3">
              <img
                src={imagePreview}
                alt="Game cover preview"
                className="h-48 w-full rounded-lg border border-glass-border object-contain"
              />
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            checked={formData.featured}
            onChange={(event) =>
              updateField("featured", event.target.checked)
            }
            className="h-4 w-4"
          />
          Featured Game
        </label>

        <label className="flex items-center gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            checked={formData.draft}
            onChange={(event) => updateField("draft", event.target.checked)}
            className="h-4 w-4"
          />
          Hide from public (Draft)
        </label>

        <label className="flex items-center gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            checked={formData.upcoming}
            onChange={(event) => updateField("upcoming", event.target.checked)}
            className="h-4 w-4"
          />
          Upcoming game (enable pre-order in store)
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-500">
            {error}
          </p>
        )}

        {success && (
          <p role="status" className="text-sm text-accent">
            {success}
          </p>
        )}

        <div className="flex justify-center">
          <button
            type="submit"
            disabled={uploading || saving}
            className="rounded-lg border border-accent/30 bg-accent/20 px-6 py-2 text-sm font-medium text-accent transition hover:bg-accent/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading
              ? "Uploading image…"
              : saving
                ? "Saving game…"
                : isEditing
                  ? "Update Game"
                  : "Add Game"}
          </button>
        </div>
      </form>
    </div>
  );
}
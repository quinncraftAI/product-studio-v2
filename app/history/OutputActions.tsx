"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OutputActions({
  outputId,
  filePath,
}: {
  outputId: string;
  filePath: string;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm("Are you sure you want to delete this output?")) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/outputs/${outputId}`, { method: "DELETE" });
      if (res.ok) {
        // Refresh the page to update the list
        router.refresh();
      } else {
        const json = await res.json();
        alert(json.error || "Failed to delete");
      }
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Delete failed");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
      <a
        href={filePath}
        download
        onClick={(e) => e.stopPropagation()}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md hover:bg-white/40"
        title="Download"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </a>
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md hover:bg-red-500 disabled:opacity-50"
        title="Delete"
      >
        {isDeleting ? (
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        )}
      </button>
    </div>
  );
}

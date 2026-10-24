"use client";

import { useState } from "react";
import { Modal, SmartImage } from "@/components/ui";
import { imagesForColor } from "@/lib/product";
import type { Product } from "@/types";
import { ProductPurchasePanel } from "./ProductPurchasePanel";

export function QuickAddModal({ product, brandName, initialColorId, onClose }: { product: Product; brandName?: string; initialColorId?: string; onClose: () => void }) {
  const [colorId, setColorId] = useState(initialColorId ?? product.colors[0]?.id ?? "");
  const image = imagesForColor(product, colorId)[0];
  return (
    <Modal open onClose={onClose} title={`Quick add: ${product.name}`} hideTitle className="sm:max-w-3xl">
      <div className="grid gap-6 sm:grid-cols-[1fr_1.2fr]">
        <div className="relative hidden aspect-[4/5] overflow-hidden rounded-card bg-[#F4F2F0] sm:block">
          {image && <SmartImage src={image.src} alt={image.alt} fill sizes="320px" className="object-cover" />}
        </div>
        <ProductPurchasePanel product={product} brandName={brandName} colorId={colorId} onColorChange={setColorId} compact onAdded={onClose} headingLevel="h2" />
      </div>
    </Modal>
  );
}

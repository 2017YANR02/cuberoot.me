import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Product, ProductInsert, ProductCategory } from "@/db/schema";

export type { ProductCategory };

export async function list(): Promise<Product[]> {
  return db.select().from(schema.products).all();
}

export async function findById(id: string): Promise<Product | undefined> {
  const rows = db.select().from(schema.products).where(eq(schema.products.id, id)).all();
  return rows[0];
}

export async function upsert(values: ProductInsert): Promise<void> {
  await db
    .insert(schema.products)
    .values(values)
    .onConflictDoUpdate({
      target: schema.products.id,
      set: {
        name: values.name,
        category: values.category,
        brand: values.brand,
        price: values.price,
        originalPrice: values.originalPrice ?? null,
        rating: values.rating,
        reviews: values.reviews,
        description: values.description,
        features: values.features,
        inStock: values.inStock,
      },
    });
}

export async function remove(id: string): Promise<void> {
  await db.delete(schema.products).where(eq(schema.products.id, id));
}

export type { Product };

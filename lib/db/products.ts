import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Product, ProductInsert, ProductCategory } from "@/db/schema";
import { searchProducts, searchProductsCount } from "@/lib/db/search";
import type { PagedResult, ListOpts } from "@/lib/db/courses";

export type { ProductCategory };

export async function list(): Promise<Product[]> {
  return db.select().from(schema.products).all();
}

export async function listPaged({
  q,
  page = 1,
  pageSize = 12,
  category,
}: ListOpts & { category?: ProductCategory } = {}): Promise<PagedResult<Product>> {
  const safePage = Math.max(1, Math.floor(page));
  const offset = (safePage - 1) * pageSize;
  const query = q?.trim() ?? "";

  // 关键词搜索走 FTS,跨全部分类(category 仅作用于浏览态)
  if (query) {
    const [items, total] = await Promise.all([
      searchProducts(query, { limit: pageSize, offset }),
      searchProductsCount(query),
    ]);
    return {
      items,
      total,
      page: safePage,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  const where = category ? eq(schema.products.category, category) : undefined;
  const totalRow = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.products)
    .where(where)
    .all();
  const total = totalRow[0]?.n ?? 0;
  const items = db
    .select()
    .from(schema.products)
    .where(where)
    .limit(pageSize)
    .offset(offset)
    .all();
  return {
    items,
    total,
    page: safePage,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
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

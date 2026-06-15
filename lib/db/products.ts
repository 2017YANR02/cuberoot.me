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

// 会员专享价:会员且配置了 memberPrice(且不高于原价)走会员价,否则常规价。
// 计价单一来源 —— 详情页展示、下单实付、admin 都从这里取,别各自重算。
export function effectivePrice(product: Product, isMember: boolean): number {
  if (
    isMember &&
    product.memberPrice != null &&
    product.memberPrice >= 0 &&
    product.memberPrice < product.price
  ) {
    return product.memberPrice;
  }
  return product.price;
}

// 开通会员后单件可省多少(元)。无 memberPrice 或不便宜则 0。
export function memberSavings(product: Product): number {
  if (product.memberPrice == null) return 0;
  return Math.max(0, product.price - product.memberPrice);
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
        memberOnly: values.memberOnly ?? false,
        memberPrice: values.memberPrice ?? null,
      },
    });
}

export async function remove(id: string): Promise<void> {
  await db.delete(schema.products).where(eq(schema.products.id, id));
}

export type { Product };

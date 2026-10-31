import type { Database } from '../../src/database/database.module.js';
import {
  categories,
  coupons,
  inventory,
  productImages,
  products,
  type Category,
  type Coupon,
  type Product,
} from '../../src/database/schema.js';

let seq = 0;
const next = () => ++seq;

type CouponInput = Partial<typeof coupons.$inferInsert>;
type CategoryInput = Partial<typeof categories.$inferInsert>;
type ProductInput = Partial<typeof products.$inferInsert> & {
  stock?: number;
  reserved?: number;
  images?: number;
};

export function factories(db: Database) {
  return {
    async category(input: CategoryInput = {}): Promise<Category> {
      const n = next();
      const [row] = await db
        .insert(categories)
        .values({
          name: `Categoria ${n}`,
          slug: `categoria-${n}`,
          position: n,
          ...input,
        })
        .returning();
      return row!;
    },

    async coupon(input: CouponInput = {}): Promise<Coupon> {
      const n = next();
      const [row] = await db
        .insert(coupons)
        .values({
          code: `CUPOM${n}`,
          type: 'percent',
          value: 10,
          minSubtotalCents: 5000,
          ...input,
        })
        .returning();
      return row!;
    },

    async product(input: ProductInput = {}): Promise<Product> {
      const n = next();
      const { stock = 25, reserved = 0, images = 0, ...columns } = input;
      const [row] = await db
        .insert(products)
        .values({
          name: `Produto ${n}`,
          slug: `produto-${n}`,
          sku: `SKU-${n}`,
          priceCents: 9990,
          publishedAt: new Date(Date.now() - 60_000),
          ...columns,
        })
        .returning();

      await db
        .insert(inventory)
        .values({ productId: row!.id, quantity: stock, reserved });

      if (images > 0) {
        await db.insert(productImages).values(
          Array.from({ length: images }, (_, i) => ({
            productId: row!.id,
            path: `https://picsum.photos/seed/${row!.slug}-${i}/800/800`,
            alt: row!.name,
            position: i,
          })),
        );
      }
      return row!;
    },
  };
}

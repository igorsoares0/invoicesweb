import type { Metadata } from "next";
import { NEW_PRODUCT } from "@/features/products/product-display";
import { ProductsScreen } from "@/features/products/products-screen";
import { firstValues } from "@/lib/url";
import { listProductsQuerySchema } from "@/lib/validation/product";
import { ApiError } from "@/server/api/errors";
import { requireBusiness } from "@/server/auth/session";
import { productService } from "@/server/services/product-service";

export const metadata: Metadata = { title: "Items & services" };

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const { user, business } = await requireBusiness();
  const context = { userId: user.id, businessId: business.id };
  const params = firstValues(await searchParams);
  const creating = params.product === NEW_PRODUCT;

  const query = listProductsQuerySchema.safeParse(params).success ? params : {};
  const [result, selected] = await Promise.all([
    productService.list(context, query),
    params.product && !creating
      ? productService.get(context, params.product).catch((error: unknown) => {
          if (error instanceof ApiError && error.code === "RESOURCE_NOT_FOUND") return null;
          throw error;
        })
      : null,
  ]);

  return (
    <ProductsScreen
      result={result}
      selected={selected}
      creating={creating}
      defaultCurrency={business.defaultCurrency}
      defaultTaxRate={business.defaultTaxRate}
    />
  );
}

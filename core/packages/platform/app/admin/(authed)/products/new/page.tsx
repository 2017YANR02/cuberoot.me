import { PageHeader } from "../../../_components/Shell";
import { ProductForm } from "../_Form";

export default function NewProductPage() {
  return (
    <div>
      <PageHeader title="新建商品" />
      <ProductForm />
    </div>
  );
}

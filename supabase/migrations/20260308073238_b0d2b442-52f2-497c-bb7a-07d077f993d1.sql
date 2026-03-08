
-- Add new columns to invoices
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS order_taker_id uuid,
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id),
  ADD COLUMN IF NOT EXISTS supply_date date,
  ADD COLUMN IF NOT EXISTS order_date date DEFAULT CURRENT_DATE;

-- Add discount to invoice_items
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0;

-- Add credit tracking to shops
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS credit_limit numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_balance numeric NOT NULL DEFAULT 0;

-- Create returns table
CREATE TABLE IF NOT EXISTS public.returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  invoice_id uuid REFERENCES public.invoices(id),
  shop_id uuid REFERENCES public.shops(id),
  return_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  total_refund numeric NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create return_items table
CREATE TABLE IF NOT EXISTS public.return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  invoice_item_id uuid REFERENCES public.invoice_items(id),
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;

-- RLS for returns
CREATE POLICY "Tenant users can view returns" ON public.returns
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert returns" ON public.returns
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Managers can update returns" ON public.returns
  FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid()) 
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  );

-- RLS for return_items
CREATE POLICY "View return items" ON public.return_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM returns WHERE returns.id = return_items.return_id AND returns.tenant_id = get_user_tenant_id(auth.uid())));

CREATE POLICY "Insert return items" ON public.return_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM returns WHERE returns.id = return_items.return_id AND returns.tenant_id = get_user_tenant_id(auth.uid())));

-- Update invoices policies to include order_taker
DROP POLICY IF EXISTS "Sales roles can insert invoices" ON public.invoices;
CREATE POLICY "Sales roles can insert invoices" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Sales roles can update invoices" ON public.invoices;
CREATE POLICY "Sales roles can update invoices" ON public.invoices
  FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid()) 
    AND (
      has_role(auth.uid(), 'owner'::app_role) 
      OR has_role(auth.uid(), 'manager'::app_role) 
      OR has_role(auth.uid(), 'salesman'::app_role)
      OR has_role(auth.uid(), 'order_taker'::app_role)
    )
  );

-- Update updated_at triggers
CREATE TRIGGER update_returns_updated_at BEFORE UPDATE ON public.returns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

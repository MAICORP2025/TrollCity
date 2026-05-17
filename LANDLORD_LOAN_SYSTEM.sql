-- Landlord Loan System Database Migration
-- Run this to create the necessary tables for the landlord loan system

-- Create landlord_applications table
CREATE TABLE IF NOT EXISTS landlord_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    business_plan TEXT NOT NULL,
    experience_years INTEGER NOT NULL DEFAULT 0,
    has_startup_capital BOOLEAN NOT NULL DEFAULT false,
    loan_amount_needed INTEGER NOT NULL DEFAULT 0,
    property_value_interest INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create landlord_loans table
CREATE TABLE IF NOT EXISTS landlord_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id),
    property_id UUID REFERENCES properties(id),
    property_value INTEGER NOT NULL DEFAULT 0,
    property_address TEXT NOT NULL,
    property_type TEXT NOT NULL,
    loan_amount INTEGER NOT NULL DEFAULT 0,
    remaining_balance INTEGER NOT NULL DEFAULT 0,
    down_payment INTEGER NOT NULL DEFAULT 0,
    monthly_payment INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid', 'defaulted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create landlord_loan_payments table (for tracking payments and 40% deduction)
CREATE TABLE IF NOT EXISTS landlord_loan_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES landlord_loans(id),
    user_id UUID NOT NULL REFERENCES user_profiles(id),
    amount INTEGER NOT NULL,
    admin_pool_amount INTEGER NOT NULL DEFAULT 0, -- 40% goes to admin pool
    loan_remaining_amount INTEGER NOT NULL,
    payment_type TEXT NOT NULL DEFAULT 'manual' CHECK (payment_type IN ('manual', 'rent_auto')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create landlord_pay_admin table (for admin to manage landlord payments)
CREATE TABLE IF NOT EXISTS landlord_pay_admin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES landlord_loans(id),
    landlord_id UUID NOT NULL REFERENCES user_profiles(id),
    total_collected INTEGER NOT NULL DEFAULT 0,
    admin_pool_amount INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE landlord_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE landlord_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE landlord_loan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE landlord_pay_admin ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own landlord applications" ON landlord_applications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own landlord applications" ON landlord_applications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own loans" ON landlord_loans
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own loans" ON landlord_loans
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own loan payments" ON landlord_loan_payments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own loan payments" ON landlord_loan_payments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admin policies
CREATE POLICY "Admins can view all landlord applications" ON landlord_applications
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
    );

CREATE POLICY "Admins can view all loans" ON landlord_loans
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
    );

CREATE POLICY "Admins can view all loan payments" ON landlord_loan_payments
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
    );

CREATE POLICY "Admins can view all landlord pay records" ON landlord_pay_admin
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
    );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_landlord_applications_user_id ON landlord_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_landlord_loans_user_id ON landlord_loans(user_id);
CREATE INDEX IF NOT EXISTS idx_landlord_loans_status ON landlord_loans(status);
CREATE INDEX IF NOT EXISTS idx_landlord_loan_payments_loan_id ON landlord_loan_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_landlord_pay_admin_landlord_id ON landlord_pay_admin(landlord_id);

-- Create RPC function for paying landlord loan with 40% auto-deduction to admin pool
CREATE OR REPLACE FUNCTION pay_landlord_loan(
    p_loan_id UUID,
    p_amount INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_loan RECORD;
    v_new_balance INTEGER;
    v_admin_pool_amount INTEGER;
    v_new_status TEXT;
BEGIN
    -- Get loan details
    SELECT * INTO v_loan FROM landlord_loans WHERE id = p_loan_id;
    
    IF v_loan IS NULL THEN
        RETURN JSON_BUILD_OBJECT('success', false, 'error', 'Loan not found');
    END IF;
    
    -- Calculate 40% for admin pool, 60% for loan repayment
    v_admin_pool_amount := FLOOR(p_amount * 0.4);
    v_new_balance := v_loan.remaining_balance - p_amount;
    
    -- Determine new status
    IF v_new_balance <= 0 THEN
        v_new_status := 'paid';
        v_new_balance := 0;
    ELSE
        v_new_status := 'active';
    END IF;
    
    -- Update loan balance and status
    UPDATE landlord_loans
    SET 
        remaining_balance = v_new_balance,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = p_loan_id;
    
    -- Record the payment with admin pool amount
    INSERT INTO landlord_loan_payments (
        loan_id,
        user_id,
        amount,
        admin_pool_amount,
        loan_remaining_amount,
        payment_type
    ) VALUES (
        p_loan_id,
        v_loan.user_id,
        p_amount,
        v_admin_pool_amount,
        v_new_balance,
        'manual'
    );
    
    -- Update or create landlord_pay_admin record
    INSERT INTO landlord_pay_admin (
        loan_id,
        landlord_id,
        total_collected,
        admin_pool_amount,
        status
    ) VALUES (
        p_loan_id,
        v_loan.user_id,
        p_amount,
        v_admin_pool_amount,
        'completed'
    )
    ON CONFLICT (loan_id) DO UPDATE SET
        total_collected = landlord_pay_admin.total_collected + p_amount,
        admin_pool_amount = landlord_pay_admin.admin_pool_amount + v_admin_pool_amount,
        updated_at = NOW();
    
    RETURN JSON_BUILD_OBJECT(
        'success', true,
        'new_balance', v_new_balance,
        'admin_pool_amount', v_admin_pool_amount,
        'status', v_new_status
    );
END;
$$;

-- Create RPC function for processing rent payment with 40% auto-deduction
CREATE OR REPLACE FUNCTION process_rent_with_loan_deduction(
    p_lease_id UUID,
    p_amount INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lease RECORD;
    v_landlord_loans RECORD;
    v_total_admin_pool INTEGER := 0;
    v_loan_payment_amount INTEGER;
    v_new_balance INTEGER;
    v_new_status TEXT;
BEGIN
    -- Get lease details
    SELECT * INTO v_lease FROM leases WHERE id = p_lease_id;
    
    IF v_lease IS NULL THEN
        RETURN JSON_BUILD_OBJECT('success', false, 'error', 'Lease not found');
    END IF;
    
    -- Find active loans for the landlord (property owner)
    FOR v_landlord_loans IN 
        SELECT * FROM landlord_loans 
        WHERE user_id = v_lease.property_owner_id 
        AND status = 'active'
        ORDER BY created_at ASC
    LOOP
        -- Deduct 40% from rent for loan repayment
        v_loan_payment_amount := FLOOR(p_amount * 0.4);
        
        IF v_loan_payment_amount > 0 AND v_landlord_loans.remaining_balance > 0 THEN
            -- Cap the payment at remaining loan balance
            IF v_loan_payment_amount > v_landlord_loans.remaining_balance THEN
                v_loan_payment_amount := v_landlord_loans.remaining_balance;
            END IF;
            
            v_total_admin_pool := v_total_admin_pool + FLOOR(v_loan_payment_amount * 0.4);
            
            -- Calculate new balance
            v_new_balance := v_landlord_loans.remaining_balance - v_loan_payment_amount;
            
            -- Determine new status
            IF v_new_balance <= 0 THEN
                v_new_status := 'paid';
                v_new_balance := 0;
            ELSE
                v_new_status := 'active';
            END IF;
            
            -- Update loan
            UPDATE landlord_loans
            SET 
                remaining_balance = v_new_balance,
                status = v_new_status,
                updated_at = NOW()
            WHERE id = v_landlord_loans.id;
            
            -- Record the payment
            INSERT INTO landlord_loan_payments (
                loan_id,
                user_id,
                amount,
                admin_pool_amount,
                loan_remaining_amount,
                payment_type
            ) VALUES (
                v_landlord_loans.id,
                v_landlord_loans.user_id,
                v_loan_payment_amount,
                FLOOR(v_loan_payment_amount * 0.4),
                v_new_balance,
                'rent_auto'
            );
        END IF;
    END LOOP;
    
    RETURN JSON_BUILD_OBJECT(
        'success', true,
        'total_loan_payment', v_total_admin_pool,
        'admin_pool_amount', v_total_admin_pool
    );
END;
$$;

-- Comment on tables and functions
COMMENT ON TABLE landlord_applications IS 'Stores landlord application submissions';
COMMENT ON TABLE landlord_loans IS 'Stores landlord property loans';
COMMENT ON TABLE landlord_loan_payments IS 'Tracks all loan payments with admin pool deductions';
COMMENT ON TABLE landlord_pay_admin IS 'Admin tracking of landlord loan payments';
COMMENT ON FUNCTION pay_landlord_loan IS 'Process manual loan payments with 40% admin pool deduction';
COMMENT ON FUNCTION process_rent_with_loan_deduction IS 'Process rent payments with automatic 40% loan repayment deduction';

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION pay_landlord_loan TO authenticated;
GRANT EXECUTE ON FUNCTION process_rent_with_loan_deduction TO authenticated;

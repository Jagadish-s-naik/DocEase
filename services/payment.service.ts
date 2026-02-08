import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase';
import { AppError, ErrorCode, SubscriptionStatus, PaymentStatus } from '@/types';

/**
 * Stripe Payment Service
 * Handles subscription creation, management, and webhooks
 */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export class PaymentService {
  /**
   * Create Stripe customer
   */
  async createCustomer(userId: string, email: string, name?: string): Promise<string> {
    try {
      const customer = await stripe.customers.create({
        email,
        metadata: {
          userId,
        },
        ...(name && { name }),
      });

      return customer.id;
    } catch (error) {
      throw new AppError(
        ErrorCode.PAYMENT_FAILED,
        'Failed to create customer',
        500
      );
    }
  }

  /**
   * Create checkout session for subscription
   */
  async createCheckoutSession(
    userId: string,
    email: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<string> {
    try {
      const supabase = createServerClient();

      // Get or create customer
      let customerId: string;
      
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .single();

      if (existingSub?.stripe_customer_id) {
        customerId = existingSub.stripe_customer_id;
      } else {
        customerId = await this.createCustomer(userId, email);
      }

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId,
        },
        subscription_data: {
          metadata: {
            userId,
          },
        },
        allow_promotion_codes: true,
        billing_address_collection: 'required',
      });

      return session.url!;
    } catch (error) {
      throw new AppError(
        ErrorCode.PAYMENT_FAILED,
        `Failed to create checkout session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * Create billing portal session
   */
  async createPortalSession(customerId: string, returnUrl: string): Promise<string> {
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      return session.url;
    } catch (error) {
      throw new AppError(
        ErrorCode.PAYMENT_FAILED,
        'Failed to create portal session',
        500
      );
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true): Promise<void> {
    try {
      if (cancelAtPeriodEnd) {
        await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
      } else {
        await stripe.subscriptions.cancel(subscriptionId);
      }
    } catch (error) {
      throw new AppError(
        ErrorCode.PAYMENT_FAILED,
        'Failed to cancel subscription',
        500
      );
    }
  }

  /**
   * Resume subscription
   */
  async resumeSubscription(subscriptionId: string): Promise<void> {
    try {
      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });
    } catch (error) {
      throw new AppError(
        ErrorCode.PAYMENT_FAILED,
        'Failed to resume subscription',
        500
      );
    }
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        'Subscription not found',
        404
      );
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    const supabase = createServerClient();

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          await this.handleCheckoutCompleted(session);
          break;
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          await this.handleSubscriptionUpdated(subscription);
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          await this.handleSubscriptionDeleted(subscription);
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice;
          await this.handlePaymentSucceeded(invoice);
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          await this.handlePaymentFailed(invoice);
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Webhook handler error:', error);
      throw error;
    }
  }

  /**
   * Handle checkout completed
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const supabase = createServerClient();
    const userId = session.metadata?.userId;

    if (!userId) {
      console.error('No userId in session metadata');
      return;
    }

    // Subscription will be created by subscription.created event
    // Just log the checkout completion
    await supabase.from('admin_logs').insert({
      event_type: 'checkout_completed',
      event_data: {
        session_id: session.id,
        customer_id: session.customer,
        amount: session.amount_total,
      },
      user_id: userId,
    });
  }

  /**
   * Handle subscription created/updated
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const supabase = createServerClient();
    const userId = subscription.metadata?.userId;

    if (!userId) {
      console.error('No userId in subscription metadata');
      return;
    }

    const status = this.mapStripeStatus(subscription.status);

    // Upsert subscription
    await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        stripe_customer_id: subscription.customer as string,
        stripe_subscription_id: subscription.id,
        plan_type: 'paid',
        status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
      }, {
        onConflict: 'stripe_subscription_id',
      });

    // Update usage limits
    const currentMonth = new Date().toISOString().slice(0, 7);
    await supabase
      .from('usage_limits')
      .upsert({
        user_id: userId,
        month: currentMonth,
        plan_type: 'paid',
        limit_value: 999999,
      }, {
        onConflict: 'user_id,month',
      });
  }

  /**
   * Handle subscription deleted
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const supabase = createServerClient();

    await supabase
      .from('subscriptions')
      .update({
        status: SubscriptionStatus.CANCELED,
      })
      .eq('stripe_subscription_id', subscription.id);
  }

  /**
   * Handle payment succeeded
   */
  private async handlePaymentSucceeded(invoice: Stripe.Invoice) {
    const supabase = createServerClient();

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', invoice.subscription as string)
      .single();

    if (!subscription) {
      console.error('No subscription found for invoice');
      return;
    }

    // Record payment
    await supabase.from('payments').insert({
      user_id: subscription.user_id,
      subscription_id: subscription.user_id,
      stripe_payment_intent_id: invoice.payment_intent as string,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: PaymentStatus.SUCCEEDED,
      payment_method: 'card',
      invoice_url: invoice.hosted_invoice_url,
    });
  }

  /**
   * Handle payment failed
   */
  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    const supabase = createServerClient();

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', invoice.subscription as string)
      .single();

    if (!subscription) return;

    // Record failed payment
    await supabase.from('payments').insert({
      user_id: subscription.user_id,
      subscription_id: subscription.user_id,
      stripe_payment_intent_id: invoice.payment_intent as string,
      amount: invoice.amount_due,
      currency: invoice.currency,
      status: PaymentStatus.FAILED,
      payment_method: 'card',
    });

    // Update subscription status
    await supabase
      .from('subscriptions')
      .update({
        status: SubscriptionStatus.PAST_DUE,
      })
      .eq('stripe_subscription_id', invoice.subscription as string);

    // TODO: Send email notification to user
  }

  /**
   * Map Stripe status to our enum
   */
  private mapStripeStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
    const statusMap: Record<string, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      incomplete: SubscriptionStatus.INCOMPLETE,
      incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
      trialing: SubscriptionStatus.TRIALING,
      unpaid: SubscriptionStatus.UNPAID,
    };

    return statusMap[stripeStatus] || SubscriptionStatus.ACTIVE;
  }
}

/**
 * Verify Stripe webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event {
  try {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'Invalid webhook signature',
      400
    );
  }
}

/**
 * Get payment service instance
 */
export function getPaymentService(): PaymentService {
  return new PaymentService();
}

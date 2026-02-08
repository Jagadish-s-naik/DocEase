import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getPaymentService, verifyWebhookSignature } from '@/services/payment.service';
import { createErrorResponse, createSuccessResponse } from '@/utils/helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = headers().get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        createErrorResponse(new Error('No signature provided')),
        { status: 400 }
      );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('Missing STRIPE_WEBHOOK_SECRET');
      return NextResponse.json(
        createErrorResponse(new Error('Webhook secret not configured')),
        { status: 500 }
      );
    }

    // Verify webhook signature
    const event = verifyWebhookSignature(body, signature, webhookSecret);

    console.log('Received webhook event:', event.type);

    // Handle the event
    const paymentService = getPaymentService();
    await paymentService.handleWebhook(event);

    return NextResponse.json(createSuccessResponse({ received: true }));

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      createErrorResponse(error),
      { status: error instanceof Error && error.message.includes('signature') ? 400 : 500 }
    );
  }
}

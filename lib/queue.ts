// ============================================
// BATCH PROCESSING & PRIORITY QUEUE SYSTEM
// For handling multiple documents efficiently
// ============================================

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { processDocument } from '@/lib/processing';

// ============================================
// QUEUE TYPES
// ============================================
export type QueuePriority = 'high' | 'normal' | 'low';

export interface QueueItem {
  id: string;
  documentId: string;
  userId: string;
  priority: QueuePriority;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
}

// ============================================
// IN-MEMORY PRIORITY QUEUE
// (For production, use Redis or Bull Queue)
// ============================================
class PriorityQueue {
  private queues: {
    high: QueueItem[];
    normal: QueueItem[];
    low: QueueItem[];
  } = {
    high: [],
    normal: [],
    low: [],
  };

  private processing = new Set<string>();
  private maxConcurrent = 5;

  // Add item to queue
  enqueue(item: QueueItem) {
    this.queues[item.priority].push(item);
    console.log(`📥 Queued document ${item.documentId} with ${item.priority} priority`);
  }

  // Get next item from queue (high priority first)
  dequeue(): QueueItem | null {
    // Check high priority first
    if (this.queues.high.length > 0) {
      return this.queues.high.shift()!;
    }
    // Then normal
    if (this.queues.normal.length > 0) {
      return this.queues.normal.shift()!;
    }
    // Finally low
    if (this.queues.low.length > 0) {
      return this.queues.low.shift()!;
    }
    return null;
  }

  // Check if queue is empty
  isEmpty(): boolean {
    return (
      this.queues.high.length === 0 &&
      this.queues.normal.length === 0 &&
      this.queues.low.length === 0
    );
  }

  // Get queue size
  size(): number {
    return (
      this.queues.high.length +
      this.queues.normal.length +
      this.queues.low.length
    );
  }

  // Check if document is being processed
  isProcessing(documentId: string): boolean {
    return this.processing.has(documentId);
  }

  // Mark document as processing
  markProcessing(documentId: string) {
    this.processing.add(documentId);
  }

  // Mark document as done
  markDone(documentId: string) {
    this.processing.delete(documentId);
  }

  // Check if we can process more
  canProcess(): boolean {
    return this.processing.size < this.maxConcurrent;
  }

  // Get queue stats
  getStats() {
    return {
      high: this.queues.high.length,
      normal: this.queues.normal.length,
      low: this.queues.low.length,
      processing: this.processing.size,
      total: this.size(),
    };
  }
}

// Global queue instance
const globalQueue = new PriorityQueue();

// ============================================
// ADD DOCUMENT TO QUEUE
// ============================================
export async function addToQueue(
  documentId: string,
  userId: string,
  priority: QueuePriority = 'normal'
): Promise<{ success: boolean; queuePosition?: number }> {
  try {
    const queueItem: QueueItem = {
      id: `${documentId}-${Date.now()}`,
      documentId,
      userId,
      priority,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
    };

    globalQueue.enqueue(queueItem);

    // Start processing if possible
    processQueue();

    return {
      success: true,
      queuePosition: globalQueue.size(),
    };
  } catch (error) {
    console.error('❌ Failed to add to queue:', error);
    return { success: false };
  }
}

// ============================================
// PROCESS QUEUE
// ============================================
async function processQueue() {
  // Check if we can process more items
  if (!globalQueue.canProcess() || globalQueue.isEmpty()) {
    return;
  }

  const item = globalQueue.dequeue();
  if (!item) return;

  // Mark as processing
  globalQueue.markProcessing(item.documentId);

  try {
    console.log(`⚙️ Processing document ${item.documentId}`);

    // Update document status in database
    const supabase = createRouteHandlerClient({ cookies });
    await supabase
      .from('documents')
      .update({ processing_status: 'queued', queue_priority: item.priority })
      .eq('id', item.documentId);

    // Process the document
    const result = await processDocument(item.documentId);

    if (!result.success) {
      throw new Error(result.error || 'Processing failed');
    }

    console.log(`✅ Document ${item.documentId} processed successfully`);
  } catch (error: any) {
    console.error(`❌ Processing failed for ${item.documentId}:`, error);

    // Retry logic
    if (item.retryCount < item.maxRetries) {
      item.retryCount++;
      console.log(`🔄 Retrying ${item.documentId} (attempt ${item.retryCount}/${item.maxRetries})`);
      
      // Re-queue with same priority
      globalQueue.enqueue(item);
    } else {
      console.error(`❌ Max retries reached for ${item.documentId}`);
      
      // Update document as failed
      const supabase = createRouteHandlerClient({ cookies });
      await supabase
        .from('documents')
        .update({ 
          processing_status: 'failed',
          error_message: error.message || 'Processing failed after retries'
        })
        .eq('id', item.documentId);
    }
  } finally {
    // Mark as done
    globalQueue.markDone(item.documentId);

    // Process next item
    setTimeout(() => processQueue(), 100);
  }
}

// ============================================
// BATCH PROCESS MULTIPLE DOCUMENTS
// ============================================
export async function batchProcess(
  documentIds: string[],
  userId: string,
  priority: QueuePriority = 'normal'
): Promise<{
  success: boolean;
  queued: number;
  failed: string[];
}> {
  const failed: string[] = [];
  let queued = 0;

  for (const documentId of documentIds) {
    const result = await addToQueue(documentId, userId, priority);
    if (result.success) {
      queued++;
    } else {
      failed.push(documentId);
    }
  }

  return {
    success: failed.length === 0,
    queued,
    failed,
  };
}

// ============================================
// GET QUEUE STATUS
// ============================================
export function getQueueStatus() {
  return globalQueue.getStats();
}

// ============================================
// CANCEL DOCUMENT PROCESSING
// ============================================
export async function cancelProcessing(documentId: string): Promise<boolean> {
  try {
    // Remove from queue if not yet processing
    // (This is simplified - production would need better queue management)
    
    const supabase = createRouteHandlerClient({ cookies });
    await supabase
      .from('documents')
      .update({ 
        processing_status: 'cancelled',
        error_message: 'Processing cancelled by user'
      })
      .eq('id', documentId);

    return true;
  } catch (error) {
    console.error('❌ Failed to cancel processing:', error);
    return false;
  }
}

// ============================================
// AUTO-RETRY FAILED DOCUMENTS
// ============================================
export async function retryFailedDocuments(userId: string): Promise<number> {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get all failed documents
    const { data: failedDocs, error } = await supabase
      .from('documents')
      .select('id')
      .eq('user_id', userId)
      .eq('processing_status', 'failed')
      .limit(10);

    if (error || !failedDocs) {
      throw error;
    }

    // Add them back to queue
    for (const doc of failedDocs) {
      await addToQueue(doc.id, userId, 'normal');
    }

    return failedDocs.length;
  } catch (error) {
    console.error('❌ Failed to retry documents:', error);
    return 0;
  }
}

// ============================================
// SCHEDULED QUEUE CLEANUP
// ============================================
setInterval(() => {
  const stats = getQueueStatus();
  console.log('📊 Queue Stats:', stats);
}, 60000); // Log every minute

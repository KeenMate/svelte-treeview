import type { Index } from 'flexsearch';
import type { LTreeNode } from './ltree-node.svelte.js';
import { isNotEmptyString } from '../helpers/string-helpers.js';

export class Indexer<T> {
	private treeId: string;
	private processingQueue: { node: LTreeNode<T>; index: number }[] = [];
	private batchSize: number;
	private searchIndex: Index;
	private isProcessing: boolean = false;
	private shouldCalculateSearchValue: boolean;
	private shouldDisplayDebugInformation: boolean;

	private searchValueMember?: string | null | undefined;
	private getSearchValueCallback?: (node: LTreeNode<T>) => string;
	private onProgressCallback?: (processed: number, total: number) => void;
	private onCompleteCallback?: () => void;
	private totalItemsAdded: number = 0;
	private totalItemsProcessed: number = 0;

	constructor(
		treeId: string,
		searchIndex: Index,
		shouldCalculateSearchValue: boolean,
		searchValueMember?: string | null | undefined,
		getSearchValueCallback?: (node: LTreeNode<T>) => string,
		batchSize: number = 25,
		private timeout: number = 50,
		shouldDisplayDebugInformation: boolean = false
	) {
		this.treeId = treeId;
		this.searchIndex = searchIndex;
		this.batchSize = batchSize;
		this.shouldCalculateSearchValue = shouldCalculateSearchValue;
		this.shouldDisplayDebugInformation = shouldDisplayDebugInformation;
		this.searchValueMember = searchValueMember;
		this.getSearchValueCallback = getSearchValueCallback;

		if (this.shouldDisplayDebugInformation)
			console.log(`[Tree ${this.treeId}] Indexer initialized with batch size: ${batchSize}`);
	}

	// Add items to the processing queue
	addToQueue(items: { node: LTreeNode<T>; index: number }[]): void {
		this.processingQueue.push(...items);
		this.totalItemsAdded += items.length;

		if (this.shouldDisplayDebugInformation)
			console.log(
				`[Tree ${this.treeId}] Added ${items.length} items to indexing queue. Queue size: ${this.processingQueue.length}`
			);

		// Start processing if not already running
		if (!this.isProcessing) {
			this.startProcessing();
		}
	}

	// Add a single item to queue
	addItem(item: { node: LTreeNode<T>; index: number }): void {
		this.processingQueue.push(item);
		this.totalItemsAdded++;

		if (!this.isProcessing) {
			this.startProcessing();
		}
	}

	// Set callbacks for progress tracking
	setCallbacks(
		onProgress?: (processed: number, total: number) => void,
		onComplete?: () => void
	): void {
		this.onProgressCallback = onProgress;
		this.onCompleteCallback = onComplete;
	}

	// Update batch size dynamically
	setBatchSize(newBatchSize: number): void {
		this.batchSize = newBatchSize;
		if (this.shouldDisplayDebugInformation)
			console.log(`[Tree ${this.treeId}] Batch size updated to: ${this.batchSize}`);
	}

	// Start the processing loop
	private startProcessing(): void {
		if (this.isProcessing || this.processingQueue.length === 0) {
			return;
		}

		this.isProcessing = true;
		if (this.shouldDisplayDebugInformation)
			console.log(
				`[Tree ${this.treeId}] Starting indexing. Queue size: ${this.processingQueue.length}`
			);

		this.processNextBatch();
	}

	// Process the next batch using requestIdleCallback
	private processNextBatch(): void {
		requestIdleCallback((deadline) => this.processBatch(deadline), { timeout: this.timeout });
	}

	// Process a batch of items from the queue
	private processBatch(deadline: IdleDeadline): void {
		const startTime = performance.now();
		let itemsProcessedInBatch = 0;
		const isTimeout = deadline.didTimeout;

		if (this.shouldDisplayDebugInformation)
			console.log(
				`[Tree ${this.treeId}] Processing batch: timeout=${isTimeout}, timeRemaining=${deadline.timeRemaining()}ms, queueSize=${this.processingQueue.length}`
			);

		// Determine how many items to process
		let maxItemsInBatch: number;

		if (isTimeout) {
			// Browser forced us to run - be conservative
			maxItemsInBatch = Math.min(5, Math.ceil(this.batchSize / 5));
		} else {
			// Browser has genuine idle time - use full batch size
			maxItemsInBatch = this.batchSize;
		}

		// Process items from the queue
		while (
			this.processingQueue.length > 0 &&
			itemsProcessedInBatch < maxItemsInBatch &&
			((!isTimeout && deadline.timeRemaining() > 1) || isTimeout)
		) {
			const item = this.processingQueue.shift()!;
			this.indexItem(item);
			itemsProcessedInBatch++;
			this.totalItemsProcessed++;

			// For timeout scenarios, break after processing the conservative amount
			if (isTimeout && itemsProcessedInBatch >= maxItemsInBatch) {
				break;
			}
		}

		const batchTime = performance.now() - startTime;
		if (this.shouldDisplayDebugInformation)
			console.log(
				`[Tree ${this.treeId}] Batch completed: indexed ${itemsProcessedInBatch} items in ${batchTime.toFixed(2)}ms`
			);

		// Report progress
		if (this.onProgressCallback) {
			this.onProgressCallback(this.totalItemsProcessed, this.totalItemsAdded);
		}

		// Check if more work needs to be done
		if (this.processingQueue.length > 0) {
			// More items in queue - schedule next batch
			this.processNextBatch();
		} else {
			// Queue is empty - processing complete
			this.finishProcessing();
		}
	}

	// Index a single item (customize this for your search index)
	private indexItem(item: { node: LTreeNode<T>; index: number }): void {
		// Type-safe indexing - customize based on your item structure
		const searchValue = !this.shouldCalculateSearchValue
			? this.searchValueMember && item.node.data[this.searchValueMember]?.toString()
			: this.getSearchValueCallback && this.getSearchValueCallback(item.node);

		if (isNotEmptyString(searchValue)) this.searchIndex!.add(item.index, searchValue);
	}

	// Finish processing
	private finishProcessing(): void {
		this.isProcessing = false;
		if (this.shouldDisplayDebugInformation)
			console.log(
				`[Tree ${this.treeId}] Indexing completed! Processed ${this.totalItemsProcessed} items total.`
			);

		if (this.onCompleteCallback) {
			this.onCompleteCallback();
		}
	}

	// Get current indexer status
	getStatus(): {
		queueSize: number;
		isProcessing: boolean;
		processed: number;
		total: number;
		batchSize: number;
	} {
		return {
			queueSize: this.processingQueue.length,
			isProcessing: this.isProcessing,
			processed: this.totalItemsProcessed,
			total: this.totalItemsAdded,
			batchSize: this.batchSize
		};
	}

	// Clear the queue and reset counters
	clearQueue(): void {
		this.processingQueue = [];
		this.isProcessing = false;
		this.totalItemsAdded = 0;
		this.totalItemsProcessed = 0;
		if (this.shouldDisplayDebugInformation)
			console.log(`[Tree ${this.treeId}] Indexing queue cleared`);
	}

	// Check if indexer is busy
	isBusy(): boolean {
		return this.isProcessing || this.processingQueue.length > 0;
	}

	// Wait for all current items to be processed
	async waitForCompletion(): Promise<void> {
		return new Promise<void>((resolve) => {
			if (!this.isBusy()) {
				resolve();
				return;
			}

			const originalCallback = this.onCompleteCallback;
			this.onCompleteCallback = () => {
				if (originalCallback) {
					originalCallback();
				}
				resolve();
			};
		});
	}
}

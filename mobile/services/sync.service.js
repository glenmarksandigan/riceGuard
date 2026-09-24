import AsyncStorage from '@react-native-async-storage/async-storage';
import { reportService } from './api.service';

const OFFLINE_QUEUE_KEY = '@riceguard_offline_reports';

export const syncService = {
    /**
     * Save a report locally when offline
     */
    async queueReport(reportData) {
        try {
            const existingQueue = await this.getQueue();
            const newItem = {
                id: Date.now().toString(),
                data: reportData, // FormData can't be stored directly, so we store the object
                timestamp: new Date().toISOString(),
                status: 'pending'
            };

            const newQueue = [...existingQueue, newItem];
            await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(newQueue));
            console.log('Report saved to offline queue');
            return true;
        } catch (error) {
            console.error('Failed to save report to queue:', error);
            return false;
        }
    },

    /**
     * Get all pending reports
     */
    async getQueue() {
        try {
            const data = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            return [];
        }
    },

    /**
     * Try to sync all pending reports to the server
     */
    async syncQueue() {
        const queue = await this.getQueue();
        if (queue.length === 0) return { success: true, count: 0 };

        console.log(`Attempting to sync ${queue.length} reports...`);
        let successCount = 0;
        const remainingQueue = [];

        for (const item of queue) {
            try {
                // Reconstruct FormData for the API
                const formData = new FormData();
                Object.keys(item.data).forEach(key => {
                    if (key === 'images') {
                        // Image URI should still be valid on the device
                        formData.append(key, item.data[key]);
                    } else {
                        formData.append(key, item.data[key]);
                    }
                });

                await reportService.createReport(formData);
                successCount++;
                console.log(`Successfully synced report ${item.id}`);
            } catch (error) {
                console.warn(`Failed to sync report ${item.id}:`, error);
                remainingQueue.push(item);
            }
        }

        // Update queue with remaining items
        await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remainingQueue));

        return {
            success: remainingQueue.length === 0,
            synced: successCount,
            remaining: remainingQueue.length
        };
    },

    /**
     * Clear the entire queue
     */
    async clearQueue() {
        await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
    }
};

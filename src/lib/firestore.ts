import { db } from "@/integrations/firebase/client";
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    orderBy,
    limit,
    serverTimestamp,
    getDoc,
    getCountFromServer,
    DocumentData,
    QueryConstraint
} from "firebase/firestore";

export const firestoreService = {
    // Count documents
    count: async (collectionName: string, userId?: string, extraConstraints: QueryConstraint[] = []) => {
        const constraints = userId ? [where("user_id", "==", userId), ...extraConstraints] : extraConstraints;
        const q = query(collection(db, collectionName), ...constraints);
        const snapshot = await getCountFromServer(q);
        return snapshot.data().count;
    },

    // List all from a collection for a specific user (optional)
    list: async (collectionName: string, userId?: string, extraConstraints: QueryConstraint[] = [], orderField = "created_at", limitCount = 100) => {
        const baseConstraints: QueryConstraint[] = userId ? [where("user_id", "==", userId)] : [];
        const constraints = [...baseConstraints, ...extraConstraints];

        if (orderField) {
            constraints.push(orderBy(orderField, "desc"));
        }

        if (limitCount) {
            constraints.push(limit(limitCount));
        }

        try {
            const q = query(collection(db, collectionName), ...constraints);
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                created_at: (doc.data() as any).created_at?.toDate?.()?.toISOString() || (doc.data() as any).created_at,
                updated_at: (doc.data() as any).updated_at?.toDate?.()?.toISOString() || (doc.data() as any).updated_at,
            }));
        } catch (error: any) {
            console.error(`Error listing ${collectionName}:`, error);
            // If it's an index error, try without ordering as a fallback
            if (error.code === 'failed-precondition' || error.message?.includes('index')) {
                console.warn(`Query for ${collectionName} failed due to missing index. Retrying without sorting.`);
                const fallbackQ = query(collection(db, collectionName), ...baseConstraints, ...extraConstraints, limit(limitCount));
                const fallbackSnapshot = await getDocs(fallbackQ);
                return fallbackSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    created_at: (doc.data() as any).created_at?.toDate?.()?.toISOString() || (doc.data() as any).created_at,
                    updated_at: (doc.data() as any).updated_at?.toDate?.()?.toISOString() || (doc.data() as any).updated_at,
                }));
            }
            throw error;
        }
    },

    // Get a single document
    get: async (collectionName: string, id: string) => {
        const docRef = doc(db, collectionName, id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        }
        return null;
    },

    // Add a document
    add: async (collectionName: string, userId: string, data: any) => {
        // Remove undefined values to avoid Firebase error
        const cleanData = Object.fromEntries(
            Object.entries(data).filter(([_, v]) => v !== undefined)
        );
        return await addDoc(collection(db, collectionName), {
            ...cleanData,
            user_id: userId,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp()
        });
    },

    // Update a document
    update: async (collectionName: string, id: string, data: any) => {
        const docRef = doc(db, collectionName, id);
        // Remove undefined values to avoid Firebase error
        const cleanData = Object.fromEntries(
            Object.entries(data).filter(([key, v]) => v !== undefined && key !== "id")
        );
        const updateData = { ...cleanData, updated_at: serverTimestamp() };
        return await updateDoc(docRef, updateData);
    },

    // Delete a document
    delete: async (collectionName: string, id: string) => {
        const docRef = doc(db, collectionName, id);
        return await deleteDoc(docRef);
    },

    // Special for lead_tags (many-to-many)
    // In Firestore, we might want to just store tags as an array in the lead doc
    // but if we want to keep the same structure, we need helper for it
    getLeadTags: async (leadIds: string[]) => {
        if (leadIds.length === 0) return {};

        const leadTags: Record<string, any[]> = {};

        // Firestore 'in' query limit is 30 items
        const chunks = [];
        for (let i = 0; i < leadIds.length; i += 30) {
            chunks.push(leadIds.slice(i, i + 30));
        }

        for (const chunk of chunks) {
            const q = query(collection(db, "lead_tags"), where("lead_id", "in", chunk));
            const querySnapshot = await getDocs(q);

            for (const d of querySnapshot.docs) {
                const data = d.data();
                if (!leadTags[data.lead_id]) leadTags[data.lead_id] = [];

                // Fetch tag details
                const tagSnap = await getDoc(doc(db, "tags", data.tag_id));
                if (tagSnap.exists()) {
                    leadTags[data.lead_id].push({ id: tagSnap.id, ...tagSnap.data() });
                }
            }
        }
        return leadTags;
    }
};

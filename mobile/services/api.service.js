// RiceGuard API Service Layer
import { apiFetch } from './api.config';
import { ENDPOINTS } from './api.config';

// ── Auth ──────────────────────────────────────────────────
export const authService = {
    async login(contactNumber, password) {
        const res = await apiFetch(ENDPOINTS.LOGIN, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contact_number: contactNumber, password }),
        });
        return res.json();
    },

    async register(userData) {
        const res = await apiFetch(ENDPOINTS.REGISTER, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
        });
        return res.json();
    },
};

// ── Reports ───────────────────────────────────────────────
export const reportService = {
    async getReports(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const res = await apiFetch(`${ENDPOINTS.REPORTS}?${params}`);
        return res.json();
    },

    async getReport(reportId) {
        const res = await apiFetch(`${ENDPOINTS.REPORTS}?report_id=${reportId}`);
        return res.json();
    },

    async createReport(formData) {
        const res = await apiFetch(ENDPOINTS.REPORTS, {
            method: 'POST',
            body: formData, // FormData with images
        });
        return res.json();
    },

    async updateStatus(reportId, status) {
        const res = await apiFetch(ENDPOINTS.REPORTS, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ report_id: reportId, status }),
        });
        return res.json();
    },
};

const safeJsonParse = async (res) => {
    if (!res.ok) {
        if (res.status === 503) {
            throw new Error('503 Tunnel Unavailable — Please check if localtunnel is running on your laptop or update your tunnel URL.');
        }
        const errText = await res.text();
        throw new Error(`Server Error (${res.status}): ${errText.substring(0, 80)}`);
    }
    const text = await res.text();
    try {
        const cleanText = text
            .replace(/:\s*-NaN\b/g, ': 0.0')
            .replace(/:\s*NaN\b/g, ': 0.0')
            .replace(/:\s*-Infinity\b/g, ': 0.0')
            .replace(/:\s*Infinity\b/g, ': 0.0');
        return JSON.parse(cleanText);
    } catch (e) {
        console.error('Raw Server Response:', text);
        throw new Error(`Server returned invalid response: ${text.substring(0, 80)}`);
    }
};

// ── AI Diagnosis ──────────────────────────────────────────
export const aiService = {
    async getModels() {
        const res = await apiFetch(ENDPOINTS.AI_MODELS);
        return safeJsonParse(res);
    },

    async getDiseases() {
        const res = await apiFetch(ENDPOINTS.DISEASES);
        return safeJsonParse(res);
    },

    async predict(imageUri, modelName, reportId = null) {
        const formData = new FormData();
        formData.append('image', {
            uri: imageUri,
            type: 'image/jpeg',
            name: 'leaf_photo.jpg',
        });
        formData.append('model', modelName);
        if (reportId) formData.append('report_id', reportId.toString());

        const res = await apiFetch(ENDPOINTS.AI_PREDICT, {
            method: 'POST',
            body: formData,
        });
        return safeJsonParse(res);
    },

    async compare(imageUri, reportId = null) {
        const formData = new FormData();
        formData.append('image', {
            uri: imageUri,
            type: 'image/jpeg',
            name: 'leaf_photo.jpg',
        });
        if (reportId) formData.append('report_id', reportId.toString());

        const res = await apiFetch(ENDPOINTS.AI_COMPARE, {
            method: 'POST',
            body: formData,
        });
        return safeJsonParse(res);
    },

    async predictYolo(imageUri, reportId = null) {
        const formData = new FormData();
        formData.append('image', {
            uri: imageUri,
            type: 'image/jpeg',
            name: 'leaf_photo.jpg',
        });
        if (reportId) formData.append('report_id', reportId.toString());

        const res = await apiFetch(ENDPOINTS.AI_YOLO_PREDICT, {
            method: 'POST',
            body: formData,
        });
        return safeJsonParse(res);
    },

    async getDiagnosis(reportId) {
        const res = await apiFetch(`${ENDPOINTS.DIAGNOSIS}?report_id=${reportId}`);
        return res.json();
    },
};

// ── Verification ──────────────────────────────────────────
export const verificationService = {
    async getVerifications(reportId = null) {
        const params = reportId ? `?report_id=${reportId}` : '';
        const res = await apiFetch(`${ENDPOINTS.VERIFICATION}${params}`);
        return res.json();
    },

    async createVerification(data) {
        const res = await apiFetch(ENDPOINTS.VERIFICATION, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return res.json();
    },
};

// ── Treatments ────────────────────────────────────────────
export const treatmentService = {
    async getTreatments(diseaseId = null) {
        const params = diseaseId ? `?disease_id=${diseaseId}` : '';
        const res = await apiFetch(`${ENDPOINTS.TREATMENTS}${params}`);
        return res.json();
    },

    async getRecommendations(reportId) {
        const res = await apiFetch(`${ENDPOINTS.TREATMENTS}?action=recommendations&report_id=${reportId}`);
        return res.json();
    },

    async createRecommendation(data) {
        const res = await apiFetch(ENDPOINTS.TREATMENTS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return res.json();
    },
};

// ── Insurance Claims ──────────────────────────────────────
export const claimService = {
    async getClaims(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const res = await apiFetch(`${ENDPOINTS.CLAIMS}?${params}`);
        return res.json();
    },

    async createClaim(data, proofImages = []) {
        const formData = new FormData();
        formData.append('user_id', data.user_id.toString());
        formData.append('report_id', data.report_id.toString());
        formData.append('damage_type', data.damage_type);
        if (data.rsbsa_num) formData.append('rsbsa_num', data.rsbsa_num);
        if (data.policy_num) formData.append('policy_num', data.policy_num);

        // Attach proof images
        proofImages.forEach((img, i) => {
            formData.append('proof_images[]', {
                uri: img.uri,
                type: 'image/jpeg',
                name: `proof_${i}.jpg`,
            });
            formData.append('image_types[]', img.type || 'Other');
        });

        const res = await apiFetch(ENDPOINTS.CLAIMS, {
            method: 'POST',
            body: formData,
        });
        return res.json();
    },
};

// ── Field Visit Requests ──────────────────────────────────
export const fieldVisitService = {
    async getVisits(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const res = await apiFetch(`${ENDPOINTS.FIELD_VISITS}?${params}`);
        return res.json();
    },

    async createVisit(data, proofImages = []) {
        const formData = new FormData();
        formData.append('farmer_id', data.farmer_id.toString());
        formData.append('report_id', data.report_id.toString());
        if (data.reason) formData.append('reason', data.reason);
        if (data.preferred_date) formData.append('preferred_date', data.preferred_date);
        if (data.farmer_notes) formData.append('farmer_notes', data.farmer_notes);

        // Attach proof images
        proofImages.forEach((img, i) => {
            formData.append('proof_images[]', {
                uri: img.uri,
                type: 'image/jpeg',
                name: `visit_proof_${i}.jpg`,
            });
        });

        const res = await apiFetch(ENDPOINTS.FIELD_VISITS, {
            method: 'POST',
            body: formData,
        });
        return res.json();
    },

    async updateVisit(data) {
        const res = await apiFetch(ENDPOINTS.FIELD_VISITS, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return res.json();
    },
};

// ── Users ─────────────────────────────────────────────────
export const userService = {
    async getUser(userId) {
        const res = await apiFetch(`${ENDPOINTS.USERS}?user_id=${userId}`);
        return res.json();
    },

    async updateUser(data) {
        const res = await apiFetch(ENDPOINTS.USERS, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return res.json();
    },
};

// ── Stats ─────────────────────────────────────────────────
export const statsService = {
    async getOverview() {
        const res = await apiFetch(`${ENDPOINTS.STATS}?action=overview`);
        return res.json();
    },

    async getDiseases() {
        const res = await apiFetch(`${ENDPOINTS.STATS}?action=diseases`);
        return res.json();
    },
};

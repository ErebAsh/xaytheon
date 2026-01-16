/**
 * LLM Service for AI features
 */
class LlmService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
    }

    /**
     * Generates a response based on code context and user query.
     */
    async generateResponse(query, context) {
        // System prompt to guide the AI
        const systemPrompt = `You are the XAYTHEON AI Assistant, a specialist in code review and repository analysis. 
        Use the following context from the repository to answer the user's query.
        If you don't know the answer, say "I don't have enough information about this repository yet."
        
        CONTEXT:
        ${context}
        `;

        // Mocking the AI response for demonstration to avoid API key dependency during setup
        return this.getMockResponse(query);
    }

    async getSummary(context) {
        return this.getMockSummary();
    }

    getMockResponse(query) {
        const queryLower = query.toLowerCase();
        if (queryLower.includes('run') || queryLower.includes('start')) {
            return "Based on the repository structure, you can run the backend using `npm start` in the `/backend` directory and the frontend by serving the root HTML files. Ensure you have Node.js installed and configured the `.env` file.";
        }
        if (queryLower.includes('structure') || queryLower.includes('folder')) {
            return "The project follows a clean MVC structure. `/backend/src` contains the controllers, routes, and services, while the root directory holds the frontend HTML/CSS/JS files.";
        }
        return "That's an interesting question about the repository! I see references to sophisticated analytics and 3D visualizations. Is there a specific part of the code you'd like me to review or explain further?";
    }

    getMockSummary() {
        return "XAYTHEON is a high-performance GitHub analytics and collaboration platform. It features real-time shared workspaces, 3D dependency visualizations, and detailed activity heatmaps. The codebase is built with Node.js on the backend and modern vanilla JS/CSS on the frontend, integrating seamlessly with Supabase for authentication.";
    }
}

module.exports = new LlmService();

const llmService = require('../services/llm.service');

exports.chat = async (req, res) => {
    try {
        const { query, repoContext } = req.body;

        if (!query) {
            return res.status(400).json({ message: "Query is required" });
        }

        // In a real RAG implementation, we would search/index the repo metadata here
        const context = repoContext || "README: XAYTHEON - Open Source Analytics";
        const response = await llmService.generateResponse(query, context);

        res.json({ response });
    } catch (error) {
        console.error("AI Chat Error:", error);
        res.status(500).json({ message: "AI Assistant is currently offline." });
    }
};

exports.summarize = async (req, res) => {
    try {
        const { repo } = req.query;
        // Mocking fetching README content
        const context = `Repository: ${repo}. Features: Heatmap, Sentiment, Collaboration.`;
        const summary = await llmService.getSummary(context);

        res.json({ summary });
    } catch (error) {
        console.error("AI Summary Error:", error);
        res.status(500).json({ message: "Failed to generate summary." });
    }
};

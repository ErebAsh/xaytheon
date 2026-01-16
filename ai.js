/**
 * XAYTHEON AI - Chat Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const summarizeBtn = document.getElementById('summarize-btn');
    const repoSummaryEl = document.getElementById('repo-summary');
    const clearChatBtn = document.getElementById('clear-chat');
    const quickButtons = document.querySelectorAll('.suggest-btn');

    // Load history
    loadChatHistory();

    // Event Listeners
    sendBtn.addEventListener('click', handleSend);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    summarizeBtn.addEventListener('click', handleSummarize);

    clearChatBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear chat history?')) {
            chatMessages.innerHTML = '';
            localStorage.removeItem('xaytheon_chat_history');
            addBotMessage("Chat history cleared. How can I help you today?");
        }
    });

    quickButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            userInput.value = btn.innerText;
            handleSend();
        });
    });

    // Auto-resize textarea
    userInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    async function handleSend() {
        const text = userInput.value.trim();
        if (!text) return;

        // Add user message
        addUserMessage(text);
        userInput.value = '';
        userInput.style.height = 'auto';

        // Show typing indicator
        const indicator = addTypingIndicator();

        try {
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: text })
            });
            const data = await response.json();

            indicator.remove();
            addBotMessage(data.response || "Something went wrong. Let's try again!");
            saveChatHistory();
        } catch (error) {
            indicator.remove();
            addBotMessage("I'm having trouble connecting to the network right now.");
        }
    }

    async function handleSummarize() {
        summarizeBtn.disabled = true;
        summarizeBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Processing...';

        try {
            const res = await fetch('/api/ai/summarize?repo=SatyamPandey-07/xaytheon');
            const data = await res.json();

            repoSummaryEl.innerText = data.summary;
        } catch (err) {
            repoSummaryEl.innerText = "Error generating summary.";
        } finally {
            summarizeBtn.disabled = false;
            summarizeBtn.innerHTML = '<i class="ri-magic-line"></i> Explain Repo';
        }
    }

    function addUserMessage(text) {
        const div = document.createElement('div');
        div.className = 'msg user-msg';
        div.innerHTML = `<div class="msg-content">${text}</div>`;
        chatMessages.appendChild(div);
        scrollToBottom();
    }

    function addBotMessage(text) {
        const div = document.createElement('div');
        div.className = 'msg bot-msg';
        div.innerHTML = `<div class="msg-content"></div>`;
        chatMessages.appendChild(div);

        const contentDiv = div.querySelector('.msg-content');
        typeEffect(contentDiv, text);
        scrollToBottom();
    }

    function addTypingIndicator() {
        const div = document.createElement('div');
        div.className = 'msg bot-msg typing-indicator';
        div.innerHTML = `<div class="msg-content"><i>Typing...</i></div>`;
        chatMessages.appendChild(div);
        scrollToBottom();
        return div;
    }

    function typeEffect(element, text) {
        let i = 0;
        const speed = 20;
        function type() {
            if (i < text.length) {
                element.innerHTML += text.charAt(i);
                i++;
                setTimeout(type, speed);
                scrollToBottom();
            }
        }
        type();
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function saveChatHistory() {
        localStorage.setItem('xaytheon_chat_history', chatMessages.innerHTML);
    }

    function loadChatHistory() {
        const history = localStorage.getItem('xaytheon_chat_history');
        if (history) {
            chatMessages.innerHTML = history;
            scrollToBottom();
        }
    }
});

// Query Controller - handles validation and sending prompts to Ollama models

// Validate that the prompt is not empty
function validatePrompt(prompt) {
    if (!prompt || prompt.trim() === "") {
        return { valid: false, error: "Please enter a prompt" };
    }
    return { valid: true };
}

// Validate that at least one model is selected
function validateModels(models) {
    if (!models || models.length === 0) {
        return { valid: false, error: "Please select at least one model" };
    }
    return { valid: true };
}

// Send prompt to a single Ollama model and return the reply
async function queryModel(model, prompt) {
    const response = await fetch("http://127.0.0.1:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: model,
            messages: [{ role: "user", content: prompt }],
            stream: false
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `Error from ${model}`);
    }

    return data.message?.content || "No response from model.";
}

// Query all selected models simultaneously using Promise.all()
async function queryModels(models, prompt) {
    // Send all requests at the same time
    const results = await Promise.all(
        models.map(async (model) => {
            try {
                const reply = await queryModel(model, prompt);
                return { model, reply, error: null };
            } catch (err) {
                return { model, reply: null, error: err.message };
            }
        })
    );
    return results;
}

module.exports = { validatePrompt, validateModels, queryModel, queryModels };
// Jasmine unit tests for query validation and model selection
// These tests are written BEFORE the implementation (TDD)

const { validatePrompt, validateModels } = require("../queryController");

// Test suite for prompt validation
describe("validatePrompt", () => {

    it("should return invalid if prompt is empty", () => {
        const result = validatePrompt("");
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Please enter a prompt");
    });

    it("should return invalid if prompt is only whitespace", () => {
        const result = validatePrompt("   ");
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Please enter a prompt");
    });

    it("should return valid if prompt has content", () => {
        const result = validatePrompt("What is gravity?");
        expect(result.valid).toBe(true);
    });

});

// Test suite for model selection validation
describe("validateModels", () => {

    it("should return invalid if no models are selected", () => {
        const result = validateModels([]);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Please select at least one model");
    });

    it("should return invalid if models is null", () => {
        const result = validateModels(null);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Please select at least one model");
    });

    it("should return valid if one model is selected", () => {
        const result = validateModels(["llama3"]);
        expect(result.valid).toBe(true);
    });

    it("should return valid if both models are selected", () => {
        const result = validateModels(["llama3", "mistral"]);
        expect(result.valid).toBe(true);
    });

});